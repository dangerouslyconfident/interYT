/**
 * This script runs on the YouTube video page.
 * It listens for a message from the popup.js script.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Check if the message is asking to fetch the transcript
    if (request.type === "FETCH_TRANSCRIPT") {
        
        // --- THIS IS THE PART THAT BREAKS ---
        // YouTube changes its class names all the time.
        // The old selector was: "ytd-transcript-segment-renderer .segment-text"
        // We are trying a new, slightly more general selector.
        // This new selector looks for the 'yt-formatted-string' element
        // that lives inside each 'ytd-transcript-segment-renderer'.
        const segmentSelector = "ytd-transcript-segment-renderer yt-formatted-string";
        const segmentElements = document.querySelectorAll(segmentSelector);
        
        if (!segmentElements || segmentElements.length === 0) {
            // If it's not open, this will be empty
            sendResponse({ 
                transcript: null, 
                error: "Could not find an open transcript. Please click '...' and 'Show transcript' on the YouTube page." 
            });
            return true; // Indicate async response
        }

        // If we found elements, join all their text content
        try {
            const fullTranscript = Array.from(segmentElements)
                .map(segment => segment.textContent.trim())
                .join(" "); // Join lines with a space
            
            sendResponse({ transcript: fullTranscript });
        } catch (e) {
            sendResponse({ transcript: null, error: `Error scraping transcript: ${e.message}` });
        }
    }
    
    // This `return true` is CRITICAL.
    // It tells Chrome to keep the message channel open for an asynchronous response.
    return true; 
});