# interYT - YouTube Q&A Chrome Extension 🎥✨

**v0.2.0** - Enhanced with Settings Page & Better UX

Ask questions about any YouTube video's transcript and get AI-powered answers with comment summarization!

## ✨ What's New in v0.2.0

### Easy API Key Management
No more editing code files! The extension now has a built-in settings page:
- Right-click extension icon → **Options**
- Paste your Gemini API key
- Click Save - Done!

### Enhanced Features
- 🔒 Secure API key storage using Chrome's encrypted storage
- 🎯 Better error messages and user guidance
- 🔄 Improved transcript/comment extraction with fallback selectors
- 📝 Helpful hints if API key is missing

## Features

- **Smart Q&A**: Ask questions about video transcripts with AI-powered responses
- **Comment Summarization**: Fetch top comments and get AI-generated sentiment analysis
- **Context-Aware**: Distinguishes between directly related, contextually related, and unrelated questions
- **Google Search Integration**: Enriches answers with real-time information
- **Question History**: Saves your last 5 Q&A sessions
- **Settings Page**: Easy API key configuration (NEW!)

## Quick Start

### 1. Get a Google Gemini API Key
1. Visit [Google AI Studio](https://aistudio.google.com)
2. Sign in with your Google account
3. Click "Get API key" → "Create API key in new project"
4. Copy the generated key

### 2. Install the Extension
1. Download all extension files from this repository
2. Go to `chrome://extensions` in Chrome/Edge/Brave
3. Enable "Developer mode" (toggle in top-right)
4. Click "Load unpacked"
5. Select the folder containing the extension files

### 3. Configure Your API Key
1. Right-click the extension icon in your browser toolbar
2. Select "Options"
3. Paste your API key and click "Save"

### 4. Use the Extension
1. Navigate to any YouTube video
2. Click "..." under the video → "Show transcript"
3. Click the interYT extension icon
4. Ask questions or fetch comments!

## Files Included

**Required Files** (include all of these):
- `manifest.json` - Extension configuration
- `popup.html`, `popup.js`, `popup.css` - Main popup UI
- `settings.html`, `settings.js` - Settings page (NEW!)
- `content.js` - YouTube page content scraper
- `images/` - Extension icons (icon16.png, icon48.png, icon128.png)

**Optional/Demo Files** (don't include in extension):
- `demo/` - Web-based demo for Replit
- `server.py` - Development server
- `README.md`, `REPLIT_SETUP.md` - Documentation

## How It Works

1. **Transcript Extraction**: The extension scrapes the visible transcript from YouTube's page
2. **Question Analysis**: Gemini AI categorizes your question (directly related, contextual, or unrelated)
3. **AI Response**: Uses Gemini 2.5 Flash with Google Search to provide comprehensive answers
4. **Comment Summarization**: Fetches top comments and generates sentiment analysis

## Privacy & Security

- API keys are stored **locally** in your browser using Chrome's secure storage API
- Keys are **encrypted** and only accessible to this extension
- Your key is **never sent** anywhere except directly to Google's Gemini API
- No data collection or tracking

## Troubleshooting

**"API key not configured"**
→ Right-click extension icon → Options → Enter your API key

**"Could not find transcript"**
→ Make sure transcript is open: Click "..." → "Show transcript" on YouTube

**"No comments found"**
→ Scroll down on the YouTube page to load comments first

**Extension won't load**
→ Ensure you downloaded ALL required files, including settings.html and settings.js

**API calls failing**
→ Check your API key is correct in Settings; verify it's active at Google AI Studio

## Development

This extension uses:
- **Manifest V3** (latest Chrome extension standard)
- **Vanilla JavaScript** (no frameworks required)
- **Google Gemini 2.5 Flash API**
- **Chrome Storage API** for secure key storage

## License

See LICENSE file for details.

## Credits

Original project by [dangerouslyconfident](https://github.com/dangerouslyconfident/interYT)

Enhanced version with settings page, improved UX, and better error handling.

---

**Enjoy smarter YouTube watching! 🎬🤖**
