document.addEventListener('DOMContentLoaded', () => {

    let qaHistory = [];

    const qaTabButton = document.getElementById('tab-qa');
    const commentsTabButton = document.getElementById('tab-comments');
    const qaTabContent = document.getElementById('qa-tab-content');
    const commentsTabContent = document.getElementById('comments-tab-content');

    const askButton = document.getElementById('ask-button');
    const transcriptInput = document.getElementById('transcript');
    const questionInput = document.getElementById('question');
    const answerContainer = document.getElementById('answer-container');
    const answerText = document.getElementById('answer-text');
    const loader = document.getElementById('loader');
    const transcriptStatus = document.getElementById('transcript-status');
    const historyContainer = document.getElementById('history-container');
    const historyList = document.getElementById('history-list');
    const clearHistoryButton = document.getElementById('clear-history-button');

    const fetchCommentsButton = document.getElementById('fetch-comments-button');
    const commentsContainer = document.getElementById('comments-container');
    const commentsLoader = document.getElementById('comments-loader');
    const commentsList = document.getElementById('comments-list');
    const commentsStatus = document.getElementById('comments-status');
    const commentSummaryContainer = document.getElementById('comment-summary-container');
    const commentSummaryLoader = document.getElementById('comment-summary-loader');
    const commentSummaryText = document.getElementById('comment-summary-text');

    if (qaTabButton) {
        qaTabButton.addEventListener('click', () => switchTab('qa'));
    }
    if (commentsTabButton) {
        commentsTabButton.addEventListener('click', () => switchTab('comments'));
    }
    if (askButton) {
        askButton.addEventListener('click', handleAskQuestion);
    }
    if (fetchCommentsButton) {
        fetchCommentsButton.addEventListener('click', handleFetchComments);
    }
    if (clearHistoryButton) {
        clearHistoryButton.addEventListener('click', handleClearHistory);
    }

    autoFetchTranscript();
    loadHistory();

    function loadHistory() {
        chrome.storage.local.get(['qaHistory'], (result) => {
            if (result.qaHistory) {
                qaHistory = result.qaHistory;
                renderHistory();
            }
        });
    }

    function renderHistory() {
        if (!historyList) return;
        historyList.innerHTML = ""; 

        if (qaHistory.length > 0) {
            historyContainer.classList.remove('hidden');
            qaHistory.forEach(item => {
                const historyItem = document.createElement('div');
                historyItem.className = 'history-item';

                const questionEl = document.createElement('div');
                questionEl.className = 'history-question';
                questionEl.textContent = item.question;

                const answerEl = document.createElement('div');
                answerEl.className = 'history-answer';
                answerEl.innerHTML = formatAnswerForDisplay(item.answer); 

                historyItem.appendChild(questionEl);
                historyItem.appendChild(answerEl);
                historyList.appendChild(historyItem);
            });
        } else {
            historyContainer.classList.add('hidden');
        }
    }

    function saveToHistory(question, answer) {
        qaHistory.unshift({ question, answer }); 
        if (qaHistory.length > 5) {
            qaHistory.pop(); 
        }
        chrome.storage.local.set({ qaHistory: qaHistory });
        renderHistory();
    }

    function handleClearHistory() {
        qaHistory = [];
        chrome.storage.local.remove('qaHistory', () => {
            renderHistory();
        });
    }

    function switchTab(tab) {
        if (tab === 'qa') {
            qaTabButton.classList.add('active');
            commentsTabButton.classList.remove('active');
            qaTabContent.classList.remove('hidden');
            commentsTabContent.classList.add('hidden');
        } else if (tab === 'comments') {
            qaTabButton.classList.remove('active');
            commentsTabButton.classList.add('active');
            qaTabContent.classList.add('hidden');
            commentsTabContent.classList.remove('hidden');
        }
    }

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
                            transcriptStatus.classList.add("text-red-400");
                        } else if (response && response.transcript) {
                            transcriptInput.value = response.transcript;
                            transcriptStatus.textContent = `Successfully fetched ${response.transcript.split(' ').length} words.`;
                            transcriptStatus.classList.add("text-green-400");
                        } else {
                            transcriptInput.placeholder = "No transcript found. Please open it on the page.";
                            transcriptStatus.textContent = response.error || "Could not find an open transcript on the page.";
                            transcriptStatus.classList.add("text-yellow-400");
                        }
                    });
                } else {
                    transcriptInput.placeholder = "Not a YouTube video page.";
                    transcriptStatus.textContent = "Please navigate to a YouTube video to use this.";
                    transcriptStatus.classList.add("text-yellow-400");
                }
            } else {
                transcriptStatus.textContent = "Could not find an active tab.";
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
            saveToHistory(question, aiResponse); 

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
        
        const apiKey = "PASTE_YOUR_NEW_KEY_HERE"; 
    
        
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

    function formatAnswerForDisplay(message) {
        return message
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-cyan-400 hover:underline">$1</a>')
            .replace(/\n/g, "<br>")
            .replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');
    }

    function showMessage(message, type = "success") {
        if (type === "success") {
            answerText.innerHTML = formatAnswerForDisplay(message);
        } else {
            let formattedMessage = message
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/\n/g, "<br>");
            answerText.innerHTML = `<p class="text-red-400">${formattedMessage}</p>`;
        }
    }
    
    function handleFetchComments() {
        commentsContainer.classList.remove('hidden');
        commentsLoader.classList.remove('hidden');
        commentsList.classList.add('hidden');
        commentsList.innerHTML = "";
        commentsStatus.textContent = "Attempting to fetch comments...";
        commentsStatus.classList.remove('text-red-400');
        
        commentSummaryContainer.classList.add('hidden');
        commentSummaryText.innerHTML = "";
        
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
             if (tabs && tabs[0]) {
                const activeTab = tabs[0];
                chrome.tabs.sendMessage(activeTab.id, { type: "FETCH_COMMENTS" }, (response) => {
                    commentsLoader.classList.add('hidden');
                    commentsList.classList.remove('hidden');

                    if (chrome.runtime.lastError) {
                        const errorMsg = chrome.runtime.lastError.message || "Unknown connection error.";
                        console.warn("Error sending message:", errorMsg);
                        commentsStatus.textContent = `Error: ${errorMsg}. Please reload the YouTube page.`;
                        commentsStatus.classList.add("text-red-400");
                    } else if (response && response.comments) {
                        if (response.comments.length === 0) {
                            commentsStatus.textContent = "Could not find any comments. (Is the comment section loaded on the page?)";
                            commentsStatus.classList.add('text-red-400');
                            return;
                        }
                        
                        commentsStatus.textContent = `Successfully fetched ${response.comments.length} comments.`;
                        commentsStatus.classList.remove('text-red-400');
                        
                        response.comments.forEach(comment => {
                            const commentEl = document.createElement('div');
                            commentEl.className = 'comment-item';
                            
                            const authorEl = document.createElement('div');
                            authorEl.className = 'comment-author';
                            authorEl.textContent = comment.author;
                            
                            const textEl = document.createElement('div');
                            textEl.className = 'comment-text';
                            textEl.textContent = comment.text;
                            
                            commentEl.appendChild(authorEl);
                            commentEl.appendChild(textEl);
                            commentsList.appendChild(commentEl);
                        });

                        callGeminiForCommentSummary(response.comments);
                        
                    } else {
                        commentsStatus.textContent = response.error || "Could not find any comments.";
                        commentsStatus.classList.add("text-red-400");
                    }
                });
             } else {
                commentsLoader.classList.add('hidden');
                commentsStatus.textContent = "Could not find an active tab.";
                commentsStatus.classList.add("text-red-400");
             }
        });
    }

    async function callGeminiForCommentSummary(comments) {
        commentSummaryContainer.classList.remove('hidden');
        commentSummaryLoader.classList.remove('hidden');
        commentSummaryText.classList.add('hidden');
        commentSummaryText.innerHTML = "";

        const commentsString = comments
            .slice(0, 20) 
            .map(c => `Author: ${c.author}\nComment: ${c.text}`)
            .join('\n\n---\n\n');

        const systemPrompt = `You are a YouTube channel analyst. You will be given a list of top comments from a video.
Your job is to read them and provide a brief, 2-3 sentence summary of the overall viewer sentiment and opinion.
Focus on the main themes. Are people generally positive, negative, or mixed? What are they talking about?
Do not list individual comments. Provide a high-level summary.`;

        const userQuery = `
Here are the top comments:
---
${commentsString}
---

Please provide a brief summary of the viewer opinion:
`;

        const apiKey = "PASTE_YOUR_NEW_KEY_HERE"; 

        
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 256,
            }
        };

        try {
            const response = await fetchWithBackoff(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }
            
            const result = await response.json();
            const summary = result.candidates?.[0]?.content?.parts?.[0]?.text;

            if (summary) {
                commentSummaryText.innerHTML = formatAnswerForDisplay(summary);
            } else {
                throw new Error("No summary text found in API response.");
            }

        } catch (error) {
            console.error("Error summarizing comments:", error);
            commentSummaryText.innerHTML = `<p class="text-red-400">Could not generate a summary. ${error.message}</p>`;
        } finally {
            commentSummaryLoader.classList.add('hidden');
            commentSummaryText.classList.remove('hidden');
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