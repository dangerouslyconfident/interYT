/**
 * Helper function to retrieve API key from chrome.storage
 * @returns {Promise<string>} The API key
 * @throws {Error} If no API key is configured
 */
async function getApiKey() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(["geminiApiKey"], (result) => {
            if (chrome.runtime.lastError) {
                reject(new Error("Failed to retrieve API key: " + chrome.runtime.lastError.message));
            } else if (!result.geminiApiKey) {
                reject(new Error("API key not configured. Please right-click the extension icon and select Options to add your Gemini API key."));
            } else {
                resolve(result.geminiApiKey);
            }
        });
    });
}

/**
 * Store active timeouts for smooth transitions
 */
const hideTimeouts = new WeakMap();

/**
 * Smooth show helper - displays element with fade-in animation
 */
function smoothShow(element) {
    if (!element) return;
    
    // Cancel any pending hide for this element
    const timeout = hideTimeouts.get(element);
    if (timeout) {
        clearTimeout(timeout);
        hideTimeouts.delete(element);
    }
    
    element.classList.remove('hiding');
    element.classList.remove('hidden');
}

/**
 * Smooth hide helper - fades out element then hides it
 */
function smoothHide(element) {
    if (!element) return;
    
    // Cancel any existing timeout first
    const existingTimeout = hideTimeouts.get(element);
    if (existingTimeout) {
        clearTimeout(existingTimeout);
    }
    
    element.classList.add('hiding');
    
    // Schedule the actual hide
    const timeout = setTimeout(() => {
        element.classList.remove('hiding');
        element.classList.add('hidden');
        hideTimeouts.delete(element);
    }, 300); // Match CSS transition duration
    
    hideTimeouts.set(element, timeout);
}


document.addEventListener('DOMContentLoaded', () => {
    // Verify jsPDF library loads correctly
    console.log('[interYT] Checking jsPDF library...');
    if (window.jspdf && window.jspdf.jsPDF) {
        console.log('[interYT] ✓ jsPDF loaded successfully (window.jspdf.jsPDF)');
    } else if (window.jsPDF) {
        console.log('[interYT] ✓ jsPDF loaded successfully (window.jsPDF)');
    } else {
        console.error('[interYT] ✗ jsPDF library not found! PDF export will not work.');
    }

    let qaHistory = [];
    let activeTab = 'qa'; // Track current active tab
    let videoChannelName = null; // Store channel name for context
    let videoDescription = null; // Store video description for context

    const qaTabButton = document.getElementById('tab-qa');
    const commentsTabButton = document.getElementById('tab-comments');
    const toolsTabButton = document.getElementById('tab-tools');
    const qaTabContent = document.getElementById('qa-tab-content');
    const commentsTabContent = document.getElementById('comments-tab-content');
    const toolsTabContent = document.getElementById('tools-tab-content');

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
    if (toolsTabButton) {
        toolsTabButton.addEventListener('click', () => switchTab('tools'));
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
        activeTab = tab; // Update active tab state
        
        // Remove active class from all tabs
        qaTabButton.classList.remove('active');
        commentsTabButton.classList.remove('active');
        toolsTabButton.classList.remove('active');
        
        // Smoothly hide all tab contents
        smoothHide(qaTabContent);
        smoothHide(commentsTabContent);
        smoothHide(toolsTabContent);
        
        // Show selected tab with smooth transition
        setTimeout(() => {
            if (tab === 'qa') {
                qaTabButton.classList.add('active');
                smoothShow(qaTabContent);
            } else if (tab === 'comments') {
                commentsTabButton.classList.add('active');
                smoothShow(commentsTabContent);
            } else if (tab === 'tools') {
                toolsTabButton.classList.add('active');
                smoothShow(toolsTabContent);
            }
        }, 150); // Small delay for smooth transition between tabs
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
                            videoChannelName = response.channelName;
                            videoDescription = response.description;
                            
                            let statusMsg = `Successfully fetched ${response.transcript.split(' ').length} words.`;
                            if (videoChannelName) statusMsg += ` (${videoChannelName})`;
                            
                            transcriptStatus.textContent = statusMsg;
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

    function getEnrichedTranscript(transcript) {
        if (!transcript) return transcript;
        
        let enriched = "";
        
        if (videoChannelName) {
            enriched += `CHANNEL: ${videoChannelName}\n\n`;
        }
        
        if (videoDescription) {
            enriched += `VIDEO DESCRIPTION: ${videoDescription}\n\n`;
        }
        
        enriched += `TRANSCRIPT:\n${transcript}`;
        
        return enriched;
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
            const enrichedTranscript = getEnrichedTranscript(transcript);
            const aiResponse = await callGeminiApi(enrichedTranscript, question);
            
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
1.  **Directly Related:** The question can be answered using the text of the Video Transcript. Even include questions based on the words used in the transcript (e.g "what is the meaning of X?" or "how many times is X used here?" etc.)
2.  **Contextually Related:** The question is *about* the video's main topic or speaker (e.g., "Who is this YouTuber?", "How old are they?", "What other videos have they made?"), but the answer is *not* found in the transcript text.
3.  **Unrelated:** The question is completely random and has no connection to the video transcript (e.g., "What's the weather?", "How do I bake a cake?").

Your actions will be based on this evaluation:

* **If the question is in Category 1 or 2 (Directly or Contextually Related):**
    * Use the transcript as the primary context (if relevant).
    * Use your built-in knowledge and Google Search tools to provide a comprehensive, detailed answer.
    * Just give the answer directly. Do not add any disclaimers about it being from general knowledge.
    * Format your answer with bullet points for clarity when appropriate.
    * When referencing specific moments in the video, include timestamps in MM:SS or HH:MM:SS format (e.g., "at 2:15" or "at 1:23:45").

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
        
        const apiKey = await getApiKey(); 
    
        
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            tools: [{ "google_search": {} }], 
            generationConfig: {
                temperature: 0.2, 
                maxOutputTokens: 2048,
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
    
    // Centralized function to hide ALL comment-related loaders
    function hideCommentsLoaders() {
        if (commentsLoader) commentsLoader.classList.add('hidden');
        if (commentSummaryLoader) commentSummaryLoader.classList.add('hidden');
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
        
        // Fallback timeout to hide ALL loaders if callback never fires
        const timeoutId = setTimeout(() => {
            hideCommentsLoaders(); // Hide both loaders
            commentsStatus.textContent = "Request timed out. Please try again.";
            commentsStatus.classList.add("text-red-400");
        }, 10000); // 10 second timeout
        
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
             if (tabs && tabs[0]) {
                const activeTab = tabs[0];
                chrome.tabs.sendMessage(activeTab.id, { type: "FETCH_COMMENTS" }, (response) => {
                    clearTimeout(timeoutId);
                    hideCommentsLoaders(); // Always hide loaders when callback fires
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
                        commentsStatus.textContent = response?.error || "Could not find any comments.";
                        commentsStatus.classList.add("text-red-400");
                    }
                });
             } else {
                clearTimeout(timeoutId);
                hideCommentsLoaders(); // Hide both loaders in else block
                commentsStatus.textContent = "Could not find an active tab.";
                commentsStatus.classList.add("text-red-400");
             }
        });
    }

    // Helper function to find text - now traverses ALL properties with cycle detection
    function findTextInObject(obj, maxDepth = 5, currentDepth = 0, visited = new WeakSet()) {
        if (currentDepth > maxDepth) return null;
        if (typeof obj !== 'object' || obj === null) return null;
        
        // Cycle detection
        if (visited.has(obj)) return null;
        visited.add(obj);
        
        // Priority keys - check these first for better performance
        const priorityKeys = ['text', 'output', 'content', 'summary', 'message', 'result', 'answer', 'response'];
        
        for (const key of priorityKeys) {
            if (obj[key]) {
                if (typeof obj[key] === 'string' && obj[key].length > 10 && !obj[key].startsWith('HARM_') && !obj[key].startsWith('BLOCK_')) {
                    return obj[key];
                }
                if (typeof obj[key] === 'object') {
                    const result = findTextInObject(obj[key], maxDepth, currentDepth + 1, visited);
                    if (result) return result;
                }
            }
        }
        
        // Traverse ALL other keys (not just whitelisted ones)
        for (const key in obj) {
            if (obj.hasOwnProperty(key) && !priorityKeys.includes(key)) {
                const value = obj[key];
                
                // Check if it's a valid text string
                if (typeof value === 'string' && value.length > 10 && !value.startsWith('HARM_') && !value.startsWith('BLOCK_')) {
                    return value;
                }
                
                // Recurse into objects and arrays
                if (typeof value === 'object' && value !== null) {
                    const result = findTextInObject(value, maxDepth, currentDepth + 1, visited);
                    if (result) return result;
                }
            }
        }
        
        return null;
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

        const apiKey = await getApiKey(); 

        
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 512,
            }
        };

        try {
            const response = await fetchWithBackoff(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("[interYT] Comment summary API error:", response.status, errorText);
                throw new Error(`API request failed with status ${response.status}`);
            }
            
            const result = await response.json();
            
            console.log("[interYT] Comment summary full API response:", JSON.stringify(result, null, 2));
            
            // Check for safety ratings or blocked content
            if (result.candidates?.[0]?.finishReason === 'SAFETY') {
                console.error("[interYT] Content blocked by safety filters:", result.candidates[0]);
                throw new Error("Content was blocked by safety filters. Try with different comments.");
            }
            
            // Check for other finish reasons that might indicate issues
            const finishReason = result.candidates?.[0]?.finishReason;
            if (finishReason && finishReason !== 'STOP') {
                console.warn("[interYT] Unusual finish reason:", finishReason);
            }
            
            // Check for functionCall responses - text might be in functionCall.arguments
            if (result.candidates?.[0]?.content?.parts?.[0]?.functionCall) {
                const functionCall = result.candidates[0].content.parts[0].functionCall;
                console.log("[interYT] Detected functionCall response:", functionCall);
                
                if (functionCall.args || functionCall.arguments) {
                    try {
                        const args = functionCall.args || functionCall.arguments;
                        // Args might be a JSON string or already parsed object
                        const argsObj = typeof args === 'string' ? JSON.parse(args) : args;
                        console.log("[interYT] Parsed functionCall args:", argsObj);
                        
                        // Try to extract text from the args object
                        const textFromArgs = findTextInObject(argsObj);
                        if (textFromArgs) {
                            console.log("[interYT] Found summary in functionCall.args");
                            commentSummary = textFromArgs; // Store globally for sharing/export
                            commentSummaryText.innerHTML = formatAnswerForDisplay(textFromArgs);
                            commentSummaryText.classList.remove('hidden');
                            return; // Exit early if we found it
                        }
                    } catch (e) {
                        console.warn("[interYT] Error parsing functionCall args:", e);
                    }
                }
            }
            
            // Try multiple paths to extract the summary text
            let summary = null;
            
            // Path 1: Standard structure
            if (!summary && result.candidates?.[0]?.content?.parts?.[0]?.text) {
                summary = result.candidates[0].content.parts[0].text;
                console.log("[interYT] Found summary via Path 1 (standard structure)");
            }
            
            // Path 2: Direct text property
            if (!summary && result.candidates?.[0]?.text) {
                summary = result.candidates[0].text;
                console.log("[interYT] Found summary via Path 2 (direct text)");
            }
            
            // Path 3: Output property
            if (!summary && result.candidates?.[0]?.output) {
                summary = result.candidates[0].output;
                console.log("[interYT] Found summary via Path 3 (output)");
            }
            
            // Path 4: Check if there's text anywhere in the first candidate
            if (!summary && result.candidates?.[0]) {
                const candidate = result.candidates[0];
                const textValue = findTextInObject(candidate);
                if (textValue) {
                    summary = textValue;
                    console.log("[interYT] Found summary via Path 4 (findTextInObject in candidate)");
                }
            }
            
            // Path 5: Search the entire response object as final fallback
            if (!summary) {
                const textValue = findTextInObject(result);
                if (textValue) {
                    summary = textValue;
                    console.log("[interYT] Found summary via Path 5 (findTextInObject in full result - final fallback)");
                }
            }

            if (summary && summary.trim()) {
                console.log("[interYT] Successfully extracted summary:", summary.substring(0, 100) + "...");
                commentSummary = summary; // Store globally for sharing/export
                commentSummaryText.innerHTML = formatAnswerForDisplay(summary);
                commentSummaryText.classList.remove('hidden');
            } else {
                console.error("[interYT] Could not find summary text in any known path");
                console.error("[interYT] Candidates array:", result.candidates);
                console.error("[interYT] Full response structure:", JSON.stringify(result, null, 2));
                throw new Error("API returned no text content. Response structure may have changed.");
            }

        } catch (error) {
            console.error("[interYT] Error summarizing comments:", error);
            commentSummaryText.innerHTML = `<p class="text-red-400">😕 Could not generate a summary. ${error.message}</p>`;
            commentSummaryText.classList.remove('hidden');
        } finally {
            // Always hide the summary loader in finally block
            if (commentSummaryLoader) commentSummaryLoader.classList.add('hidden');
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

    // Global state for summaries
    let videoSummary = null;
    let currentVideoUrl = null;
    let commentSummary = null;

    // Get current video URL
    function getCurrentVideoUrl() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs[0]) {
                currentVideoUrl = tabs[0].url;
            }
        });
    }
    getCurrentVideoUrl();



    // Timestamp linking - parse and link timestamps in answers
    function parseTimestamps(text) {
        // Match patterns like "at 1:23", "at 12:34", "12:45", etc.
        const timestampPattern = /(?:at\s+)?(\d{1,2}):(\d{2})(?::(\d{2}))?/g;
        
        return text.replace(timestampPattern, (match, h, m, s) => {
            let seconds;
            if (s !== undefined) {
                // Format: HH:MM:SS
                seconds = parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s);
            } else {
                // Format: MM:SS
                seconds = parseInt(h) * 60 + parseInt(m);
            }
            
            if (currentVideoUrl) {
                const url = new URL(currentVideoUrl);
                const videoId = url.searchParams.get('v');
                if (videoId) {
                    const timestampUrl = `https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`;
                    return `<a href="${timestampUrl}" target="_blank" class="timestamp-link">${match}</a>`;
                }
            }
            return `<span class="timestamp-link">${match}</span>`;
        });
    }

    // Update formatAnswerForDisplay to include timestamp parsing
    const originalFormatAnswerForDisplay = window.formatAnswerForDisplay || formatAnswerForDisplay;
    window.formatAnswerForDisplay = function(text) {
        let formatted = originalFormatAnswerForDisplay ? originalFormatAnswerForDisplay(text) : text;
        return parseTimestamps(formatted);
    };

    // Summarize Video Feature
    const summarizeBtn = document.getElementById('summarize-video-btn');
    const summaryContainer = document.getElementById('summary-container');
    const summaryLoader = document.getElementById('summary-loader');
    const summaryText = document.getElementById('summary-text');
    const closeSummaryBtn = document.getElementById('close-summary-btn');

    if (summarizeBtn) {
        summarizeBtn.addEventListener('click', async () => {
            const transcript = transcriptInput.value.trim();
            if (!transcript) {
                alert('Please load a transcript first');
                return;
            }

            summaryContainer.classList.remove('hidden');
            summaryLoader.classList.remove('hidden');
            summaryText.innerHTML = '';

            try {
                const enrichedTranscript = getEnrichedTranscript(transcript);
                const summary = await generateVideoSummary(enrichedTranscript);
                videoSummary = summary;
                summaryText.innerHTML = formatSummary(summary);
            } catch (error) {
                summaryText.innerHTML = `<p class="text-red-400">Error: ${error.message}</p>`;
            } finally {
                summaryLoader.classList.add('hidden');
            }
        });
    }

    if (closeSummaryBtn) {
        closeSummaryBtn.addEventListener('click', () => {
            summaryContainer.classList.add('hidden');
        });
    }

    async function generateVideoSummary(transcript) {
        const apiKey = await getApiKey();
        const systemPrompt = `You are a video summarization expert. Generate a concise summary with 5-7 bullet points.

Keep each bullet point brief (1-2 sentences) and focused on:
- Main topic/theme
- Key points covered
- Important takeaways

Use markdown bullet points (-) for formatting.`;

        const userQuery = `Summarize this video transcript:\n\n${transcript}`;
        
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 1536,
            }
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[interYT] Summary API error:', response.status, errorText);
            throw new Error('Summary generation failed');
        }
        
        const result = await response.json();
        console.log('[interYT] Summary API response:', result);
        
        const summaryText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!summaryText) {
            console.warn('[interYT] No summary text in response:', result);
            return 'Could not generate summary';
        }
        
        return summaryText;
    }

    function formatSummary(text) {
        // Convert markdown-style formatting to HTML
        let html = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
            .replace(/^(\d+\.)\s+(.+)$/gm, '<li>$2</li>');
        
        // Wrap consecutive <li> elements in <ul>
        html = html.replace(/(<li>.*<\/li>\n?)+/gs, (match) => `<ul>${match}</ul>`);
        
        // Wrap paragraphs
        html = html.split('\n\n').map(para => {
            if (!para.startsWith('<ul>') && !para.startsWith('<li>')) {
                return `<p>${para}</p>`;
            }
            return para;
        }).join('');
        
        return html;
    }

    // Related Videos Feature
    const relatedBtn = document.getElementById('related-videos-btn');
    const relatedContainer = document.getElementById('related-videos-container');
    const relatedLoader = document.getElementById('related-loader');
    const relatedList = document.getElementById('related-videos-list');
    const closeRelatedBtn = document.getElementById('close-related-btn');

    if (relatedBtn) {
        relatedBtn.addEventListener('click', async () => {
            const transcript = transcriptInput.value.trim();
            if (!transcript) {
                alert('Please load a transcript first');
                return;
            }

            relatedContainer.classList.remove('hidden');
            relatedLoader.classList.remove('hidden');
            relatedList.innerHTML = '';

            try {
                const enrichedTranscript = getEnrichedTranscript(transcript);
                const videos = await findRelatedVideos(enrichedTranscript);
                displayRelatedVideos(videos);
            } catch (error) {
                relatedList.innerHTML = `<p class="text-red-400">Error: ${error.message}</p>`;
            } finally {
                relatedLoader.classList.add('hidden');
            }
        });
    }

    if (closeRelatedBtn) {
        closeRelatedBtn.addEventListener('click', () => {
            relatedContainer.classList.add('hidden');
        });
    }

    async function findRelatedVideos(transcript) {
        const apiKey = await getApiKey();
        const systemPrompt = `Suggest 4-5 related YouTube videos for deeper learning on this topic.

REQUIRED FORMAT (follow exactly):
1. Title of First Video - Brief reason why it's relevant - https://youtube.com/watch?v=VIDEO_ID
2. Title of Second Video - Brief reason why it's relevant - https://youtube.com/watch?v=VIDEO_ID
3. Title of Third Video - Brief reason why it's relevant - https://youtube.com/watch?v=VIDEO_ID
4. Title of Fourth Video - Brief reason why it's relevant - https://youtube.com/watch?v=VIDEO_ID
5. Title of Fifth Video - Brief reason why it's relevant - https://youtube.com/watch?v=VIDEO_ID

IMPORTANT: Include actual YouTube video URLs. Use numbered list starting with "1." and separate title, description, and URL with " - "`;

        const userQuery = `Suggest related videos for:\n\n${transcript.substring(0, 1000)}...`;
        
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            tools: [{ "google_search": {} }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 512,
            }
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error('Failed to find related videos');
        
        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        console.log('[interYT] Related videos raw response:', text);
        
        // Parse the response into video suggestions
        return parseVideoSuggestions(text);
    }

    function parseVideoSuggestions(text) {
        const videos = [];
        const lines = text.split('\n').filter(l => l.trim());
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // Pattern 1: "1. Title - Description - URL" (new format with URL)
            let match = trimmed.match(/^\d+\.\s*(.+?)\s*-\s*(.+?)\s*-\s*(https?:\/\/[^\s]+)$/);
            if (match) {
                videos.push({
                    title: match[1].trim().replace(/\*\*/g, ''),
                    description: match[2].trim().replace(/\*\*/g, ''),
                    url: match[3].trim()
                });
                continue;
            }
            
            // Pattern 2: "1. Title - Description" (fallback without URL)
            match = trimmed.match(/^\d+\.\s*(.+?)\s*-\s*(.+)$/);
            if (match) {
                videos.push({
                    title: match[1].trim().replace(/\*\*/g, ''),
                    description: match[2].trim().replace(/\*\*/g, ''),
                    url: null
                });
                continue;
            }
            
            // Pattern 3: "1. Title: Description - URL"
            match = trimmed.match(/^\d+\.\s*(.+?)\s*:\s*(.+?)\s*-\s*(https?:\/\/[^\s]+)$/);
            if (match) {
                videos.push({
                    title: match[1].trim().replace(/\*\*/g, ''),
                    description: match[2].trim().replace(/\*\*/g, ''),
                    url: match[3].trim()
                });
                continue;
            }
            
            // Pattern 4: "1. Title: Description" (fallback without URL)
            match = trimmed.match(/^\d+\.\s*(.+?)\s*:\s*(.+)$/);
            if (match) {
                videos.push({
                    title: match[1].trim().replace(/\*\*/g, ''),
                    description: match[2].trim().replace(/\*\*/g, ''),
                    url: null
                });
                continue;
            }
            
            // Pattern 5: "1. **Title** - Description - URL" or "1. **Title**: Description - URL"
            match = trimmed.match(/^\d+\.\s*\*\*(.+?)\*\*\s*[-:]\s*(.+?)\s*-\s*(https?:\/\/[^\s]+)$/);
            if (match) {
                videos.push({
                    title: match[1].trim(),
                    description: match[2].trim().replace(/\*\*/g, ''),
                    url: match[3].trim()
                });
                continue;
            }
            
            // Pattern 6: "1. **Title** - Description" (fallback without URL)
            match = trimmed.match(/^\d+\.\s*\*\*(.+?)\*\*\s*[-:]\s*(.+)$/);
            if (match) {
                videos.push({
                    title: match[1].trim(),
                    description: match[2].trim().replace(/\*\*/g, ''),
                    url: null
                });
                continue;
            }
            
            // Pattern 7: Bullet points with URL
            match = trimmed.match(/^[•\-]\s*(.+?)\s*[-:]\s*(.+?)\s*-\s*(https?:\/\/[^\s]+)$/);
            if (match) {
                videos.push({
                    title: match[1].trim().replace(/\*\*/g, ''),
                    description: match[2].trim().replace(/\*\*/g, ''),
                    url: match[3].trim()
                });
                continue;
            }
            
            // Pattern 8: Bullet points without URL
            match = trimmed.match(/^[•\-]\s*(.+?)\s*[\-:]\s*(.+)$/);
            if (match) {
                videos.push({
                    title: match[1].trim().replace(/\*\*/g, ''),
                    description: match[2].trim().replace(/\*\*/g, ''),
                    url: null
                });
                continue;
            }
            
            // Pattern 9: Just numbered item with title only "1. Some Title"
            match = trimmed.match(/^\d+\.\s*(.+)$/);
            if (match) {
                const content = match[1].trim().replace(/\*\*/g, '');
                // Split on common separators if present
                const parts = content.split(/\s*[-:]\s*/);
                if (parts.length >= 2) {
                    videos.push({
                        title: parts[0].trim(),
                        description: parts.slice(1).join(' - ').trim(),
                        url: null
                    });
                } else {
                    videos.push({
                        title: content,
                        description: 'Related to this topic',
                        url: null
                    });
                }
            }
        }
        
        if (videos.length === 0) {
            console.warn('[interYT] Failed to parse any videos from response:', text);
        } else {
            console.log(`[interYT] Successfully parsed ${videos.length} related videos`);
        }
        
        return videos.slice(0, 5);
    }

    function displayRelatedVideos(videos) {
        if (videos.length === 0) {
            relatedList.innerHTML = '<p class="text-gray-400">No related videos found.</p>';
            return;
        }

        relatedList.innerHTML = videos.map((video, index) => {
            const hasUrl = video.url && video.url.trim();
            const linkUrl = hasUrl 
                ? video.url 
                : `https://www.youtube.com/results?search_query=${encodeURIComponent(video.title)}`;
            const linkText = hasUrl ? '🔗 Watch Video' : '🔍 Search on YouTube';
            
            return `
                <div class="related-video-item">
                    <div class="related-video-title">${index + 1}. ${video.title}</div>
                    <div class="related-video-description">${video.description}</div>
                    <a href="${linkUrl}" target="_blank" rel="noopener noreferrer" class="related-video-link">
                        ${linkText} →
                    </a>
                </div>
            `;
        }).join('');
    }

    window.searchYouTube = function(query) {
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        window.open(searchUrl, '_blank');
    };

    // Export to PDF Feature
    const exportBtn = document.getElementById('export-btn');
    const exportModal = document.getElementById('export-modal');
    const closeExportModal = document.getElementById('close-export-modal');
    const confirmExportBtn = document.getElementById('confirm-export-btn');

    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            exportModal.classList.remove('hidden');
        });
    }

    if (closeExportModal) {
        closeExportModal.addEventListener('click', () => {
            exportModal.classList.add('hidden');
        });
    }

    if (confirmExportBtn) {
        confirmExportBtn.addEventListener('click', () => {
            generatePDF();
            exportModal.classList.add('hidden');
        });
    }

    function generatePDF() {
        // Check for jsPDF in multiple possible locations
        let jsPDF;
        
        if (window.jspdf && window.jspdf.jsPDF) {
            jsPDF = window.jspdf.jsPDF;
        } else if (window.jsPDF) {
            jsPDF = window.jsPDF;
        } else {
            alert('PDF library not loaded. Please reload the extension and try again.');
            console.error('[interYT] jsPDF library not available. Checked window.jspdf.jsPDF and window.jsPDF');
            return;
        }
        
        const doc = new jsPDF();
        
        const includeQA = document.getElementById('export-qa').checked;
        const includeSummary = document.getElementById('export-summary').checked;
        const includeComments = document.getElementById('export-comments').checked;

        let yPos = 20;
        const lineHeight = 7;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 20;

        // Title
        doc.setFontSize(18);
        doc.setFont(undefined, 'bold');
        doc.text('interYT - Video Insights Export', margin, yPos);
        yPos += lineHeight * 2;

        // Video URL
        if (currentVideoUrl) {
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.text(`Video: ${currentVideoUrl}`, margin, yPos);
            yPos += lineHeight * 2;
        }

        // Q&A History
        if (includeQA && qaHistory.length > 0) {
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text('Q&A History', margin, yPos);
            yPos += lineHeight;

            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');

            qaHistory.forEach((item, index) => {
                if (yPos > pageHeight - margin) {
                    doc.addPage();
                    yPos = margin;
                }

                doc.setFont(undefined, 'bold');
                doc.text(`Q${index + 1}: ${item.question}`, margin, yPos);
                yPos += lineHeight;

                doc.setFont(undefined, 'normal');
                const answerLines = doc.splitTextToSize(stripHtml(item.answer), 170);
                answerLines.forEach(line => {
                    if (yPos > pageHeight - margin) {
                        doc.addPage();
                        yPos = margin;
                    }
                    doc.text(line, margin, yPos);
                    yPos += lineHeight;
                });
                yPos += lineHeight;
            });
        }

        // Video Summary
        if (includeSummary && videoSummary) {
            if (yPos > pageHeight - margin - 20) {
                doc.addPage();
                yPos = margin;
            }

            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text('Video Summary', margin, yPos);
            yPos += lineHeight;

            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            const summaryLines = doc.splitTextToSize(stripHtml(videoSummary), 170);
            summaryLines.forEach(line => {
                if (yPos > pageHeight - margin) {
                    doc.addPage();
                    yPos = margin;
                }
                doc.text(line, margin, yPos);
                yPos += lineHeight;
            });
        }

        // Comment Summary
        if (includeComments && commentSummary) {
            if (yPos > pageHeight - margin - 20) {
                doc.addPage();
                yPos = margin;
            }

            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text('Comment Summary', margin, yPos);
            yPos += lineHeight;

            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            const commentLines = doc.splitTextToSize(stripHtml(commentSummary), 170);
            commentLines.forEach(line => {
                if (yPos > pageHeight - margin) {
                    doc.addPage();
                    yPos = margin;
                }
                doc.text(line, margin, yPos);
                yPos += lineHeight;
            });
        }

        // Save
        doc.save('interYT-export.pdf');
    }

    function stripHtml(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    }

    // Share Feature
    const shareBtn = document.getElementById('share-btn');
    const shareModal = document.getElementById('share-modal');
    const closeShareModal = document.getElementById('close-share-modal');
    const shareWhatsappBtn = document.getElementById('share-whatsapp-btn');
    const shareTelegramBtn = document.getElementById('share-telegram-btn');

    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            shareModal.classList.remove('hidden');
        });
    }

    if (closeShareModal) {
        closeShareModal.addEventListener('click', () => {
            shareModal.classList.add('hidden');
        });
    }

    if (shareWhatsappBtn) {
        shareWhatsappBtn.addEventListener('click', () => {
            shareToWhatsApp();
        });
    }

    if (shareTelegramBtn) {
        shareTelegramBtn.addEventListener('click', () => {
            shareToTelegram();
        });
    }

    function formatShareText() {
        let text = '🎥 *YouTube Video Insights*\n\n';
        
        if (currentVideoUrl) {
            text += `Video: ${currentVideoUrl}\n\n`;
        }

        if (videoSummary) {
            text += `📝 Summary:\n${stripHtml(videoSummary)}\n\n`;
        }

        if (commentSummary) {
            text += `💬 Comment Sentiment:\n${stripHtml(commentSummary)}\n\n`;
        }

        if (qaHistory.length > 0) {
            text += `❓ Q&A Highlights:\n`;
            qaHistory.slice(0, 3).forEach((item, index) => {
                text += `\nQ: ${item.question}\nA: ${stripHtml(item.answer).substring(0, 10000)}...\n`;
            });
        }

        text += '\n\n✨ Powered by interYT Extension';
        
        return text;
    }

    function shareToWhatsApp() {
        const text = formatShareText();
        const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
        shareModal.classList.add('hidden');
    }

    function shareToTelegram() {
        const text = formatShareText();
        const url = `https://t.me/share/url?url=${encodeURIComponent(currentVideoUrl || '')}&text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
        shareModal.classList.add('hidden');
    }

    // Store comment summary when it's generated
    const originalSummarizeComments = window.summarizeComments || (() => {});
    window.summarizeComments = function(comments) {
        const result = originalSummarizeComments(comments);
        if (result) {
            result.then(summary => {
                commentSummary = summary;
            });
        }
        return result;
    };
});
// Add handler for opening settings
document.addEventListener('DOMContentLoaded', () => {
    const settingsLink = document.getElementById('open-settings');
    if (settingsLink) {
        settingsLink.addEventListener('click', (e) => {
            e.preventDefault();
            chrome.runtime.openOptionsPage();
        });
    }
});
