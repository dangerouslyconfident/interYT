/**
 * interYT Content Script
 * Runs on YouTube pages to extract transcripts and comments
 * Injected via manifest.json content_scripts
 */

console.log("[interYT] Content script loaded");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("[interYT] Message received:", request.type);

    // Handle transcript fetch request
    if (request.type === "FETCH_TRANSCRIPT") {
        fetchTranscript(sendResponse);
        return true; // Keep message channel open for async response
    }
    
    // Handle comments fetch request
    if (request.type === "FETCH_COMMENTS") {
        fetchComments(sendResponse);
        return true; // Keep message channel open for async response
    }
    
    console.warn("[interYT] Unknown message type:", request.type);
});

/**
 * Fetch transcript from YouTube page with multiple fallback selectors
 */
function fetchTranscript(sendResponse) {
    // Multiple selectors to try (YouTube changes their DOM frequently)
    const selectors = [
        "ytd-transcript-segment-renderer yt-core-attributed-string",
        "ytd-transcript-segment-renderer yt-formatted-string",
        "ytd-transcript-segment-renderer .segment-text",
        "#segments-container ytd-transcript-segment-renderer"
    ];

    let segmentElements = null;
    let usedSelector = null;

    // Try each selector until one works
    for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements && elements.length > 0) {
            segmentElements = elements;
            usedSelector = selector;
            console.log(`[interYT] Found ${elements.length} transcript segments using: ${selector}`);
            break;
        }
    }
    
    if (!segmentElements || segmentElements.length === 0) {
        console.warn("[interYT] No transcript found with any selector");
        sendResponse({ 
            transcript: null, 
            error: "Could not find an open transcript. Please click '...' and 'Show transcript' on the YouTube page." 
        });
        return;
    }

    try {
        const fullTranscript = Array.from(segmentElements)
            .map(segment => segment.textContent.trim())
            .filter(text => text.length > 0) // Remove empty segments
            .join(" ");
        
        console.log(`[interYT] Extracted transcript: ${fullTranscript.length} characters`);
        
        if (fullTranscript.length === 0) {
            sendResponse({ 
                transcript: null, 
                error: "Transcript is empty. Please ensure the transcript is visible." 
            });
        } else {
            sendResponse({ transcript: fullTranscript });
        }
    } catch (e) {
        console.error("[interYT] Error processing transcript:", e);
        sendResponse({ 
            transcript: null, 
            error: `Error reading transcript: ${e.message}` 
        });
    }
}

/**
 * Fetch comments from YouTube page with fallback strategies
 */
function fetchComments(sendResponse) {
    // Multiple selectors for comments (YouTube's DOM changes frequently)
    const selectors = [
        "ytd-comment-thread-renderer",
        "#comments ytd-comment-thread-renderer",
        "ytd-comment-renderer"
    ];

    let commentElements = null;
    let usedSelector = null;

    // Try each selector
    for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements && elements.length > 0) {
            commentElements = elements;
            usedSelector = selector;
            console.log(`[interYT] Found ${elements.length} comments using: ${selector}`);
            break;
        }
    }
    
    if (!commentElements || commentElements.length === 0) {
        console.warn("[interYT] No comments found with any selector");
        sendResponse({
            comments: null,
            error: "Could not find any comments. Try scrolling down to load them, then try again."
        });
        return;
    }

    try {
        const commentsData = Array.from(commentElements)
            .map(commentThread => {
                // Try multiple author selectors
                const authorEl = commentThread.querySelector("#author-text") || 
                                commentThread.querySelector(".ytd-comment-renderer #author-text") ||
                                commentThread.querySelector("[id='author-text']");
                
                // Try multiple text content selectors
                const textEl = commentThread.querySelector("#content-text") || 
                              commentThread.querySelector("#comment-content") ||
                              commentThread.querySelector(".ytd-comment-renderer #content-text");
                
                return {
                    author: authorEl ? authorEl.textContent.trim() : "Unknown Author",
                    text: textEl ? textEl.textContent.trim() : ""
                };
            })
            .filter(c => c.text && c.text.length > 0); // Only include valid comments
        
        console.log(`[interYT] Extracted ${commentsData.length} valid comments`);
        
        if (commentsData.length === 0) {
            sendResponse({
                comments: null,
                error: "Comments were found but couldn't extract text. The page structure may have changed."
            });
        } else {
            sendResponse({ comments: commentsData });
        }
    } catch (e) {
        console.error("[interYT] Error processing comments:", e);
        sendResponse({ 
            comments: null, 
            error: `Error reading comments: ${e.message}` 
        });
    }
}
