/**
 * This script runs on the YouTube video page.
 * It listens for messages from the popup.js script.
 */
console.log("--- YouTube Q&A [content.js]: Script loaded. ---");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("--- YouTube Q&A [content.js]: Message received:", request);

    // --- Handle Transcript Fetch Request ---
    if (request.type === "FETCH_TRANSCRIPT") {
        console.log("YouTube Q&A [content.js]: 'FETCH_TRANSCRIPT' request confirmed.");
        
        // Selector for transcript text segments
        const segmentSelector = "ytd-transcript-segment-renderer yt-core-attributed-string, ytd-transcript-segment-renderer yt-formatted-string";
        console.log(`YouTube Q&A [content.js]: Attempting selector: "${segmentSelector}"`);
        
        let segmentElements = document.querySelectorAll(segmentSelector);
        console.log(`YouTube Q&A [content.js]: Found ${segmentElements.length} transcript elements.`);
        
        if (!segmentElements || segmentElements.length === 0) {
            console.warn("YouTube Q&A [content.js]: Transcript selector FAILED. Sending error to popup.");
            sendResponse({ 
                transcript: null, 
                error: "Could not find an open transcript. Please click '...' and 'Show transcript' on the YouTube page." 
            });
            return true; // Indicate async response
        }

        try {
            console.log(`YouTube Q&A [content.js]: SUCCESS. Processing ${segmentElements.length} transcript segments...`);
            const fullTranscript = Array.from(segmentElements)
                .map(segment => segment.textContent.trim())
                .join(" "); // Join lines with a space
            
            console.log(`YouTube Q&A [content.js]: Processed transcript (${fullTranscript.length} chars). Sending to popup.`);
            sendResponse({ transcript: fullTranscript });
        } catch (e) {
            console.error("YouTube Q&A [content.js]: Error processing transcript elements:", e);
            sendResponse({ transcript: null, error: `Error scraping transcript: ${e.message}` });
        }
        
        // This `return true` is CRITICAL for async.
        // It tells Chrome to keep the message channel open.
        return true; 
    }
    
    // --- Handle Comments Fetch Request ---
    if (request.type === "FETCH_COMMENTS") {
        console.log("YouTube Q&A [content.js]: 'FETCH_COMMENTS' request confirmed.");

        // NOTE: This is notoriously unreliable as YouTube's classes change.
        // This selector targets the main comment thread.
        const commentSelector = "ytd-comment-thread-renderer";
        console.log(`YouTube Q&A [content.js]: Attempting selector: "${commentSelector}"`);
        
        let commentElements = document.querySelectorAll(commentSelector);
        console.log(`YouTube Q&A [content.js]: Found ${commentElements.length} comment threads.`);
        
        if (!commentElements || commentElements.length === 0) {
             console.warn("YouTube Q&A [content.js]: Comment selector FAILED. Sending error to popup.");
             sendResponse({
                 comments: null,
                 error: "Could not find any comments. Try scrolling down on the page to load them, then try again."
             });
             return true; // Indicate async response
        }

        try {
            console.log(`YouTube Q&A [content.js]: SUCCESS. Processing ${commentElements.length} comments...`);
            const commentsData = Array.from(commentElements).map(commentThread => {
                const authorEl = commentThread.querySelector("#author-text");
                const textEl = commentThread.querySelector("#content-text");
                
                return {
                    author: authorEl ? authorEl.textContent.trim() : "Unknown Author",
                    text: textEl ? textEl.textContent.trim() : ""
                };
            }).filter(c => c.text); // Only include comments that have text
            
            console.log(`YouTube Q&A [content.js]: Processed ${commentsData.length} valid comments. Sending to popup.`);
            sendResponse({ comments: commentsData });

        } catch (e) {
            console.error("YouTube Q&A [content.js]: Error processing comment elements:", e);
            sendResponse({ comments: null, error: `Error scraping comments: ${e.message}` });
        }
        
        // This `return true` is CRITICAL for async.
        // It tells Chrome to keep the message channel open.
        return true; 
    }
    
    // If no message type matched, we don't return true.
    // This was the source of the bug.
    console.warn("YouTube Q&A [content.js]: Received unknown message type:", request.type);
    // We do not return true here, which allows the channel to close.
});
