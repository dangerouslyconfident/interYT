document.addEventListener('DOMContentLoaded', () => {

    const askButton = document.getElementById('ask-button');
    const transcriptInput = document.getElementById('transcript');
    const questionInput = document.getElementById('question');
    const answerContainer = document.getElementById('answer-container');
    const answerText = document.getElementById('answer-text');
    const loader = document.getElementById('loader');
    const transcriptStatus = document.getElementById('transcript-status');

    if (askButton) {
        askButton.addEventListener('click', handleAskQuestion);
    }

    autoFetchTranscript();

    function autoFetchTranscript() {
        transcriptStatus.textContent = "Attempting to fetch transcript...";
        transcriptStatus.classList.remove("text-green-400", "text-yellow-400", "text-red-400");
        transcriptStatus.classList.add("text-gray-500");

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs[0]) {
                const activeTab = tabs[0];
                
                if (activeTab.url && (activeTab.url.includes("youtube.com/watch") || activeTab.url.includes("youtube.com/shorts") || activeTab.url.includes("youtube.com/live"))) {
                    chrome.tabs.sendMessage(activeTab.id, { type: "FETCH_TRANSCRIPT" }, (response) => {
                        if (chrome.runtime.lastError) {
                            const errorMsg = chrome.runtime.lastError.message || "Unknown connection error.";
                            console.warn("Error sending message:", errorMsg);
                            transcriptInput.placeholder = "Couldn't connect to page. Reload page & try again.";
                            transcriptStatus.textContent = `Error: ${errorMsg}. Please reload the YouTube page.`;
                            transcriptStatus.classList.remove("text-gray-500");
                            transcriptStatus.classList.add("text-red-400");
                        } else if (response && response.transcript) {
                            transcriptInput.value = response.transcript;
                            transcriptStatus.textContent = `Successfully fetched ${response.transcript.split(' ').length} words.`;
                            transcriptStatus.classList.remove("text-gray-500");
                            transcriptStatus.classList.add("text-green-400");
                        } else {
                            transcriptInput.placeholder = "No transcript found. Please open it on the page.";
                            transcriptStatus.textContent = response.error || "Could not find an open transcript on the page.";
                            transcriptStatus.classList.remove("text-gray-500");
                            transcriptStatus.classList.add("text-yellow-400");
                        }
                    });
                } else {
                    transcriptInput.placeholder = "Not a YouTube video page.";
                    transcriptStatus.textContent = "Please navigate to a YouTube video to use this.";
                    transcriptStatus.classList.remove("text-gray-500");
                    transcriptStatus.classList.add("text-yellow-400");
                }
            } else {
                transcriptStatus.textContent = "Could not find an active tab.";
                transcriptStatus.classList.remove("text-gray-500");
                transcriptStatus.classList.add("text-red-400");
            }
        });
    }

    async function handleAskQuestion() {
        if (!transcriptInput || !questionInput) {
            console.error("Input elements not found");
            return;
        }

        const transcript = transcriptInput.value;
        const question = questionInput.value;

        if (!transcript.trim()) {
            showMessage("Please fetch or paste a transcript first.", "error");
            return;
        }
        if (!question.trim()) {
            showMessage("Please enter a question.", "error");
            return;
        }

        answerContainer.classList.remove('hidden');
        answerText.classList.add('hidden'); 
        loader.classList.remove('hidden'); 
        answerText.innerHTML = ""; 

        try {
            const aiResponse = await callGeminiApi(transcript, question);
            showMessage(aiResponse, "success");

        } catch (error) {
            console.error("Error calling Gemini API:", error);
            showMessage(`Error: ${error.message}`, "error");
            
        } finally {
            loader.classList.add('hidden');
            answerText.classList.remove('hidden');
        }
    }

    async function callGeminiApi(transcript, question) {
        
        const systemPrompt = `You are an expert Q&A assistant. You will be given a Video Transcript and a User Question.

Your first task is to silently evaluate the User Question and place it into one of three categories:
1.  **Directly Related:** The question can be answered using the text of the Video Transcript.
2.  **Contextually Related:** The question is *about* the video's main topic or speaker (e.g., "Who is this YouTuber?", "How old are they?", "What other videos have they made?"), but the answer is *not* found in the transcript text.
3.  **Unrelated:** The question is completely random and has no connection to the video transcript (e.g., "What's the weather?", "How do I bake a cake?").

Your actions will be based on this evaluation:

* **If the question is in Category 1 or 2 (Directly or Contextually Related):**
    * Use the transcript as the primary context (if relevant).
    * Use your built-in knowledge and Google Search tools to provide a comprehensive, detailed answer.
    * Just give the answer directly. Do not add any disclaimers about it being from general knowledge.

* **If the question is in Category 3 (Unrelated):**
    * You MUST NOT answer the question.
    * You MUST respond *only* with this exact message: \`(This question seems unrelated to the video. Please ask a question about the video's content or topic.)\``;
        
        const userQuery = `
Here is the transcript:
---
${transcript}
---

Here is my question:
${question}
`;
        
        const apiKey = "AIzaSyDRjeRt5gKiNWzj9Ump7RXapwkAGm0mQgw"; 
        
        
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            tools: [{ "google_search": {} }],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 1024,
            }
        };

        const response = await fetchWithBackoff(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
        }

        const result = await response.json();
        
        let sources = [];
        const candidate = result.candidates?.[0];
        const groundingMetadata = candidate?.groundingMetadata;

        if (groundingMetadata && groundingMetadata.groundingAttributions) {
            sources = groundingMetadata.groundingAttributions
                .map(attribution => ({
                    uri: attribution.web?.uri,
                    title: attribution.web?.title,
                }))
                .filter(source => source.uri && source.title); 
        }

        if (candidate && candidate.content?.parts?.[0]?.text) {
            let answerText = candidate.content.parts[0].text;
            
            if (sources.length > 0) {
                answerText += "\n\n**Sources:**\n";
                sources.forEach((source, index) => {
                    answerText += `${index + 1}. [${source.title}](${source.uri})\n`;
                });
            }
            return answerText;
        } else {
            console.warn("Unexpected API response structure:", result);
            return "Could not find a valid answer in the API response.";
        }
    }

    function showMessage(message, type = "success") {
        let formattedMessage = message;

        if (type === "success") {
            formattedMessage = formattedMessage.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-purple-400 hover:underline">$1</a>');
            formattedMessage = formattedMessage.replace(/\n/g, "<br>");
            formattedMessage = formattedMessage.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');
            
            answerText.innerHTML = formattedMessage;
        } else {
            formattedMessage = formattedMessage
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/\n/g, "<br>");
            answerText.innerHTML = `<p class="text-red-400">${formattedMessage}</p>`;
        }
    }

    async function fetchWithBackoff(url, options, maxRetries = 5) {
        let delay = 1000;
        for (let i = 0; i < maxRetries; i++) {
            try {
                const response = await fetch(url, options);
                if (!response.ok && (response.status === 429 || response.status >= 500)) {
                    throw new Error(`Retryable error: ${response.status}`);
                }
                return response;
            } catch (error) {
                if (i === maxRetries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, delay * (2 ** i)));
            }
        }
    }
});