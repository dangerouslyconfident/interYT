# YouTube Q&A (Gemini Extension)

A browser extension that uses the Google Gemini API to answer questions about any YouTube video.

This tool automatically fetches the video's transcript, uses it as context, and leverages Google Search to provide comprehensive, context-aware answers to your questions.

## Features

Smart Transcript Fetching: Automatically detects and loads the open transcript on a YouTube video, short, or live stream.

AI-Powered Answers: Uses gemini-2.5-flash to understand and answer your questions.

Context-Aware: Intelligently determines if a question is directly related to the transcript, contextually related (e.g., "who is this YouTuber?"), or completely unrelated.

Google Search Integration: Enriches answers by fetching real-time, external information for contextually related questions.

Sleek UI: A clean, dark-mode popup that's easy to use.

Polite Rejection: Won't answer completely random, unrelated questions (e.g., "what's the weather?").

# Local Development & Installation

### Since this is not yet on the Chrome Web Store, you'll need to load it as an "unpacked" extension.

## 1. Get the Code

Clone this repository to your local machine:

git clone [https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git](https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git)


...or just download the ZIP and unzip it.

## 2. Get Your API Key (CRITICAL)

This extension requires a Google Gemini API key to function.

Go to the Google AI Studio website.

Sign in and click "Get API key".

Click "Create API key in new project" and copy the generated key.

## 3. Add Your API Key

Open the project folder in your code editor.

Find and open the popup.js file.

On line 90 (or search for PASTE_YOUR_NEW_KEY_HERE), paste your API key inside the quotes:

// Before:
const apiKey = "PASTE_YOUR_NEW_KEY_HERE"; 

// After:
const apiKey = "A1zaS...YOUR_LONG_API_KEY_...s7B4"; 


Save the popup.js file.

## 4. Create Icon Placeholders (Optional)

The extension manifest (manifest.json) points to icon files that are not in this repo. To avoid a broken icon, you should:

Inside the main folder, create a new folder named images.

Create and save three simple PNG icons (even just colored squares) in this folder:

images/icon16.png (16x16)

images/icon48.png (48x48)

images/icon128.png (128x128)

## 5. Load the Extension in Your Browser

Open Chrome, Edge, or any Chromium-based browser.

Type chrome://extensions into your address bar and press Enter.

Turn on the "Developer mode" toggle (usually in the top-right corner).

Click the "Load unpacked" button.

Select the entire project folder from your computer.

The "YouTube Q&A" extension will now appear, and its icon will be in your browser's toolbar.

# How to Use

Go to any YouTube video (or Short/Live) that has a transcript.

Click the "..." (More) button under the video player.

Click "Show transcript". The transcript will open on the side.

Click the YouTube Q&A extension icon in your toolbar.

The popup will open, and the "Video Transcript" box should automatically fill up. The status message will turn green.

Ask a question (e.g., "What was the main point?", "How old is this YouTuber?") and click "Get Answer".
