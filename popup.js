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
    if (questionInput) {
        questionInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault(); // Prevent form submission or new line
                handleAskQuestion();
            }
        });
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
        answerText.innerHTML = ""; 
        loader.classList.remove('hidden'); 
        
        // Force a reflow to ensure loader is visible
        void loader.offsetHeight;

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
        commentsList.classList.add('hidden');
        commentsList.innerHTML = "";
        commentsStatus.textContent = "Attempting to fetch comments...";
        commentsStatus.classList.remove('text-red-400');
        commentsLoader.classList.remove('hidden');
        
        // Force a reflow to ensure loader is visible
        void commentsLoader.offsetHeight;
        
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
                        
                        // Store comments for export
                        currentComments = response.comments;
                        
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

    // Helper function to validate if a string is actual content (not metadata)
    function isValidContentText(str) {
        if (!str || typeof str !== 'string') return false;
        if (str.length < 10) return false;
        if (str.startsWith('HARM_') || str.startsWith('BLOCK_')) return false;
        
        // Exclude all-uppercase strings with underscores (like MAX_TOKENS, API_KEY, etc.)
        if (/^[A-Z_]+$/.test(str)) return false;
        
        // Exclude model names and API-related strings
        const excludePatterns = [
            /^gemini-[\d.]+/i,  // Model names like "gemini-2.5-flash-preview-09-2025"
            /^https?:\/\//i,   // URLs
            /^[a-z]+:\/\/[a-z]/i,  // Protocol URLs
            /^[a-z0-9-]+\.googleapis\.com/i,  // API endpoints
            /^[a-z]+-[a-z]+-[a-z]+-[a-z]+-[a-z]+/i,  // Long hyphenated identifiers (model names)
            /^[a-z0-9-]+\.[a-z0-9-]+\.[a-z0-9-]+/i,  // Domain-like strings
            /\b(maxOutputTokens|max_tokens|MAX_TOKENS|temperature|apiKey|api_key|API_KEY)\b/i,  // API config keys
            /^[A-Z_]+$/,  // All uppercase with underscores (constants)
        ];
        
        for (const pattern of excludePatterns) {
            if (pattern.test(str)) return false;
        }
        
        // Exclude strings that are mostly uppercase constants
        const uppercaseRatio = (str.match(/[A-Z_]/g) || []).length / str.length;
        if (uppercaseRatio > 0.7 && str.length < 50) return false;
        
        // Must contain at least some letters (not just numbers/symbols/hyphens)
        if (!/[a-zA-Z]{3,}/.test(str)) return false;
        
        // Exclude strings that are mostly hyphens and numbers (like model versions)
        const nonHyphenChars = str.replace(/[-_]/g, '').length;
        if (nonHyphenChars < str.length * 0.5) return false;
        
        // Must have some lowercase letters (actual content usually has lowercase)
        if (!/[a-z]/.test(str) && str.length < 100) return false;
        
        return true;
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
                if (typeof obj[key] === 'string' && isValidContentText(obj[key])) {
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
                
                // Skip known metadata keys
                const metadataKeys = [
                    'model', 'name', 'id', 'version', 'apiVersion', 'modelVersion', 'modelName',
                    'token', 'tokens', 'maxTokens', 'maxOutputTokens', 'max_tokens', 'MAX_TOKENS',
                    'temperature', 'apiKey', 'api_key', 'API_KEY', 'endpoint', 'url', 'uri',
                    'status', 'code', 'error', 'message', 'type', 'finishReason', 'finish_reason'
                ];
                if (metadataKeys.some(mk => key.toLowerCase().includes(mk.toLowerCase()))) {
                    continue;
                }
                
                // Check if it's a valid text string
                if (typeof value === 'string' && isValidContentText(value)) {
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
        commentSummaryText.classList.add('hidden');
        commentSummaryText.innerHTML = "";
        commentSummaryLoader.classList.remove('hidden');
        
        // Force a reflow to ensure loader is visible
        void commentSummaryLoader.offsetHeight;

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
                const errorBody = await response.text();
                throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
            }

            const result = await response.json();
            const candidate = result.candidates?.[0];

            // EXACTLY like Q&A function - simple extraction
            if (candidate && candidate.content?.parts?.[0]?.text) {
                const summary = candidate.content.parts[0].text;
                console.log("[interYT] Successfully extracted summary");
                commentSummary = summary;
                commentSummaryText.innerHTML = formatAnswerForDisplay(summary);
                commentSummaryText.classList.remove('hidden');
            } else {
                console.warn("[interYT] Unexpected API response structure:", result);
                throw new Error("Could not extract summary from API response.");
            }

        } catch (error) {
            console.error("[interYT] Error summarizing comments:", error);
            commentSummaryText.innerHTML = `<p class="text-red-400">😕 Could not generate a summary. ${error.message}</p>`;
            commentSummaryText.classList.remove('hidden');
        } finally {
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
            summaryText.innerHTML = '';
            summaryLoader.classList.remove('hidden');
            
            // Force a reflow to ensure loader is visible
            void summaryLoader.offsetHeight;

            // Smooth scroll to summary container
            setTimeout(() => {
                summaryContainer.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }, 100);

            try {
                const enrichedTranscript = getEnrichedTranscript(transcript);
                const summary = await generateVideoSummary(enrichedTranscript);
                videoSummary = summary;
                summaryText.innerHTML = formatSummary(summary);
                
                // Scroll again after content is loaded to ensure we're at the bottom
                setTimeout(() => {
                    summaryContainer.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }, 100);
            } catch (error) {
                summaryText.innerHTML = `<p class="text-red-400">Error: ${error.message}</p>`;
                // Scroll to error message
                setTimeout(() => {
                    summaryContainer.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }, 100);
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
            relatedList.innerHTML = '';
            relatedLoader.classList.remove('hidden');
            
            // Force a reflow to ensure loader is visible
            void relatedLoader.offsetHeight;

            // Smooth scroll to related videos container
            setTimeout(() => {
                relatedContainer.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }, 100);

            try {
                const enrichedTranscript = getEnrichedTranscript(transcript);
                const videos = await findRelatedVideos(enrichedTranscript);
                displayRelatedVideos(videos);
                
                // Scroll again after content is loaded to ensure we're at the bottom
                setTimeout(() => {
                    relatedContainer.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }, 100);
            } catch (error) {
                relatedList.innerHTML = `<p class="text-red-400">Error: ${error.message}</p>`;
                // Scroll to error message
                setTimeout(() => {
                    relatedContainer.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }, 100);
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
        const systemPrompt = `Suggest 1-3 related videos on this topic. extrapolate the topic from the transcript and the question. make sure the videos are related to the topic.

REQUIRED FORMAT (follow exactly):
1. Title of First Video - Brief reason why it's relevant - https://youtube.com/watch?v=VIDEO_ID
2. Title of Second Video - Brief reason why it's relevant - https://youtube.com/watch?v=VIDEO_ID
3. Title of Third Video - Brief reason why it's relevant - https://youtube.com/watch?v=VIDEO_ID

IMPORTANT: 
- Provide 1-3 videos (minimum 1, maximum 3)
- Include actual YouTube video URLs
- Use numbered list starting with "1." 
- Separate title, description, and URL with " - "
- Make sure URLs are complete and clickable`;

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
        
        // Return min 1, max 3 videos
        const filteredVideos = videos.filter(v => v.title && v.title.trim().length > 0);
        return filteredVideos.slice(0, 3);
    }

    function displayRelatedVideos(videos) {
        if (videos.length === 0) {
            relatedList.innerHTML = '<p class="text-gray-400">No related videos found.</p>';
            return;
        }

        relatedList.innerHTML = videos.map((video, index) => {
            const hasUrl = video.url && video.url.trim() && video.url.includes('youtube.com');
            const linkUrl = hasUrl 
                ? video.url 
                : `https://www.youtube.com/results?search_query=${encodeURIComponent(video.title)}`;
            const linkText = hasUrl ? '🔗 Watch Video' : '🔍 Search on YouTube';
            
            // Escape HTML to prevent XSS
            const escapeHtml = (text) => {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            };
            
            return `
                <div class="related-video-item">
                    <div class="related-video-title">${index + 1}. ${escapeHtml(video.title)}</div>
                    <div class="related-video-description">${escapeHtml(video.description || 'Related to this topic')}</div>
                    <a href="${linkUrl}" target="_blank" rel="noopener noreferrer" class="related-video-link" style="display: inline-block; margin-top: 0.5rem; color: #22D3EE; text-decoration: underline; font-weight: 600;">
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
            generateTXT();
            exportModal.classList.add('hidden');
        });
    }

    // Store comments data globally
    let currentComments = [];

    function generateTXT() {
        const includeQA = document.getElementById('export-qa').checked;
        const includeSummary = document.getElementById('export-summary').checked;
        const includeComments = document.getElementById('export-comments').checked;
        const includeFullComments = document.getElementById('export-full-comments').checked;

        let textContent = '';

        // Title
        textContent += '='.repeat(60) + '\n';
        textContent += 'interYT - Video Insights Export\n';
        textContent += '='.repeat(60) + '\n\n';

        // Video URL
        if (currentVideoUrl) {
            textContent += `Video: ${currentVideoUrl}\n\n`;
        }

        // Q&A History
        if (includeQA && qaHistory.length > 0) {
            textContent += '-'.repeat(60) + '\n';
            textContent += 'Q&A History\n';
            textContent += '-'.repeat(60) + '\n\n';

            qaHistory.forEach((item, index) => {
                textContent += `Q${index + 1}: ${item.question}\n`;
                textContent += `A${index + 1}: ${stripHtml(item.answer)}\n\n`;
            });
        }

        // Video Summary
        if (includeSummary && videoSummary) {
            textContent += '-'.repeat(60) + '\n';
            textContent += 'Video Summary\n';
            textContent += '-'.repeat(60) + '\n\n';
            textContent += `${stripHtml(videoSummary)}\n\n`;
        }

        // Comment Summary
        if (includeComments && commentSummary) {
            textContent += '-'.repeat(60) + '\n';
            textContent += 'Comment Summary\n';
            textContent += '-'.repeat(60) + '\n\n';
            textContent += `${stripHtml(commentSummary)}\n\n`;
        }

        // Full Comments
        if (includeFullComments && currentComments && currentComments.length > 0) {
            textContent += '-'.repeat(60) + '\n';
            textContent += `Full Comments (${currentComments.length})\n`;
            textContent += '-'.repeat(60) + '\n\n';
            
            currentComments.forEach((comment, index) => {
                textContent += `[${index + 1}] ${comment.author}:\n`;
                textContent += `${comment.text}\n\n`;
            });
            textContent += '\n';
        }

        // Create and download the text file
        const blob = new Blob([textContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'interYT-export.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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
