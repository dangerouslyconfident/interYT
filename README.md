# interYT - YouTube Q&A Chrome Extension

> AI-powered YouTube video analysis using Google's Gemini 2.5 Flash API

[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](https://github.com/dangerouslyconfident/interYT)
[![Chrome Extension](https://img.shields.io/badge/chrome-extension-green.svg)](https://developer.chrome.com/docs/extensions)
[![License](https://img.shields.io/badge/license-MIT-orange.svg)](LICENSE)

**interYT** is a powerful Chrome browser extension that transforms how you interact with YouTube content. Get instant answers about video transcripts, analyze comments sentiment, generate summaries, and discover related content - all powered by Google's Gemini 2.5 Flash API.

---

## ✨ Features

### Core Functionality
- 🤖 **AI-Powered Q&A** - Ask questions about video content with context-aware answers using Gemini 2.5 Flash
- 📝 **Video Summarization** - Generate concise bullet-point summaries (up to 1536 tokens for comprehensive coverage)
- 💬 **Comment Analysis** - Fetch and analyze top comments with AI-powered sentiment summaries (512 tokens)
- 🔗 **Related Videos** - Get AI-suggested videos with direct YouTube links (🔗) or search fallback (🔍)
- 🔍 **Google Search Integration** - Enriched answers with real-time external information

### Enhanced Context
- 🎯 **Metadata Extraction** - Automatically includes channel name and video description for richer AI responses
- 📋 **Auto-Fetch Transcripts** - Seamlessly detects and loads YouTube transcripts
- 🔗 **Timestamp Links** - AI responses include clickable timestamps to jump to video moments

### User Experience
- 🎨 **Modern Dark UI** - Clean, professional interface with gradient accents
- 📊 **3-Tab Interface** - Organized tabs for Q&A, Comments, and Tools
- 📜 **Question History** - Saves your last 5 Q&A sessions locally
- 🔒 **Secure Settings** - Built-in settings page for easy API key management (encrypted by Chrome)

### Export & Share
- 📄 **PDF Export** - Save Q&A history and summaries to PDF
- 📤 **Social Sharing** - Share insights via WhatsApp or Telegram

### Maximum Token Limits (v0.7.2+)
- Q/A Answers: **2048 tokens** (~1500 words) - Complete, detailed responses
- Video Summaries: **1536 tokens** (~1150 words) - Comprehensive summaries
- Comment Summaries: **512 tokens** (~380 words) - Detailed sentiment analysis

---

## 📦 Installation

### Prerequisites
- Chrome, Edge, or Brave browser
- Google Gemini API key ([Get one free at AI Studio](https://aistudio.google.com))

### Steps

1. **Download Extension Files**
   ```bash
   git clone https://github.com/dangerouslyconfident/interYT.git
   cd interYT
   ```

2. **Load Extension in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable **Developer mode** (toggle in top-right corner)
   - Click **Load unpacked**
   - Select the `interYT` folder

3. **Configure API Key**
   - Right-click the interYT extension icon
   - Select **Options**
   - Paste your Gemini API key
   - Click **Save**

4. **Start Using**
   - Visit any YouTube video
   - Click "..." below the video → **Show transcript**
   - Click the interYT extension icon to start asking questions!

---

## 🚀 Usage

### Asking Questions
1. Open a YouTube video with transcripts available
2. Click the interYT extension icon
3. The transcript will auto-load
4. Type your question in the input field
5. Get AI-powered answers with Google Search integration

**Example Questions:**
- "What are the main points discussed?"
- "Summarize the video's conclusion"
- "What examples were given about AI?"

### Generating Summaries
1. Go to the **Tools** tab
2. Click **Summarize Video**
3. Get a concise bullet-point summary (5-7 points)

### Analyzing Comments
1. Go to the **Comments** tab
2. Click **Fetch Comments**
3. View top comments and AI sentiment summary

### Related Videos
1. Go to the **Tools** tab
2. Click **Find Related Videos**
3. Get AI-suggested videos on similar topics

---

## 🏗️ Project Structure

```
interYT/
├── manifest.json          # Extension configuration (Manifest V3)
├── popup.html            # Main popup UI
├── popup.js              # Core logic & Gemini API calls
├── popup.css             # Styling with gradients & animations
├── settings.html         # Settings page UI
├── settings.js           # API key management
├── content.js            # YouTube page scraper
├── lib/
│   └── jspdf.umd.min.js  # PDF export library (364KB)
├── images/               # Extension icons (16px, 48px, 128px)
├── demo/                 # Web-based demo interface
├── server.py             # Python HTTP server for local testing
└── README.md             # This file
```

---

## 🔧 Technical Details

### API Integration
- **Model**: Google Gemini 2.5 Flash (gemini-2.5-flash-preview-09-2025)
- **Features**: System instructions, Google Search tool, context enrichment
- **Error Handling**: Exponential backoff retry logic for 429/5xx errors
- **Token Limits**: Maximized for complete responses (Q/A: 2048, Summaries: 1536, Comments: 512)

### Security
- API keys stored in `chrome.storage.local` (encrypted by Chrome)
- Never transmitted except to Gemini API
- No hardcoded credentials
- Secure settings page with validation

### Content Scraping
- Multiple fallback DOM selectors for YouTube's changing structure
- Resilient comment extraction
- Automatic transcript detection
- Console logging with `[interYT]` prefix for debugging

---

## 📋 Changelog

### v1.1.0 - Clickable YouTube Links (November 08, 2025)
- 🔗 **Added**: Related videos now include direct YouTube links when Gemini provides URLs
- 🎯 **Enhanced**: Smart URL parser handles 9 different Gemini response formats (numbered lists, bullets, with/without URLs)
- ✨ **Visual Indicators**: 🔗 icon for direct video links, 🔍 icon for YouTube search fallback
- 🛡️ **Backward Compatible**: Gracefully falls back to YouTube search when URLs not available
- 🚀 **Improved UX**: Click opens exact video directly instead of searching - instant access!

### v1.0.0 - Production Release - Share & Export Fixes (November 08, 2025)
- 🎉 **Stable Release**: First production-ready version with all major features working reliably
- 🐛 **Fixed**: Comment summary now properly stored for sharing/export (was showing "gemini-preview...")
- 📤 **Enhanced**: Share feature text limit increased from 150 to 400 characters for better context
- 💬 **Added**: Comment sentiment summary now included in shared content
- ✨ **Complete**: All features (Q&A, summaries, comments, export, share) fully functional

### v0.9.0 - Loading Spinners & API Debugging Fix (November 08, 2025)
- 🔄 **Fixed**: Loading spinners now ALWAYS stop - centralized `hideCommentsLoaders()` function
- 🛡️ **Enhanced**: 10-second timeout fallback prevents infinite spinners
- 🔍 **Debugging**: Comprehensive Gemini API response logging (full structure, finish reasons, extraction paths)
- 🧪 **functionCall Handling**: Added explicit support for `functionCall` responses with args parsing
- 📊 **Traverse ALL Properties**: Enhanced `findTextInObject` with cycle detection to search entire response
- ✨ **Reliability**: All exit paths (timeout, early returns, errors) properly hide loaders

### v0.7.2 - Maximum Token Limits Update (November 08, 2025)
- 🚀 **Maximized**: Q/A answers → 2048 tokens (~1500 words) - no more cut-offs!
- 📝 **Expanded**: Video summaries → 1536 tokens (~1150 words) - comprehensive coverage
- 💬 **Doubled**: Comment summaries → 512 tokens (~380 words) - detailed sentiment analysis
- ✨ **Complete**: All features now use maximum token limits for full-length responses

### v0.7.1 - Summary Generation Hotfix (November 08, 2025)
- 🐛 **Fixed**: Video summary generation (increased tokens 400→600, softened strict prompts)
- 🔧 **Enhanced**: Comprehensive error logging for API response debugging
- 🛠️ **Fixed**: Regex bug in related videos Pattern 4 (escaped dash in character class)

### v0.7.0 - Conciseness & Related Videos Fix (November 08, 2025)
- 📝 **Improved**: Video summaries limited to 5-7 concise bullet points (400 tokens)
- 🎥 **Fixed**: Related videos feature with robust multi-pattern parser (5 formats supported)
- 🔧 **Enhanced**: Better Gemini prompts for "Title - Description" format
- 🎯 **UX**: Summaries no longer feel overwhelming or cut off

### v0.5.0 - Bug Fix & Stability Release (November 08, 2025)
- 🐛 **Fixed**: Comment summary with intelligent fallback logic and validation
- 📜 **Fixed**: Proper scrolling for all content containers (no more cut-offs)
- ✨ **Enhanced**: Uniform gradient scrollbars across all scrollable areas
- 🔧 **Improved**: Smart API response parsing with whitelisted text-bearing keys
- 🛡️ **Stability**: Better error messages and graceful degradation

### v0.4.1 - Professional Polish Update (November 08, 2025)
- 🎨 **Polished**: Professional UI with abstract gradients and warm accents
- ✨ **Enhanced**: Smooth crossfade transitions between tabs (150ms)
- 📜 **Fixed**: Overflow issues with custom gradient scrollbars
- 💫 **Added**: Micro-interactions (ripple effects, tactile feedback, smooth hovers)
- 🎯 **Improved**: Professional cubic-bezier easing for all transitions

### v0.4.0 - Context Enrichment Update (November 08, 2025)
- ✨ **Added**: Video metadata extraction (channel name & description)
- 🧠 **Enhanced**: AI context now includes channel/description for more accurate answers
- 📋 **Added**: 3-tab interface (Q&A, Comments, Tools)
- 🛡️ **Resilient**: Multiple fallback selectors for YouTube's changing DOM

### v0.3.0 - Major Feature Update (November 08, 2025)
- ✨ **Added**: Video summarization, timestamp-linked answers, related videos, PDF export
- 📤 **Added**: WhatsApp and Telegram sharing
- 🔒 **Security**: Settings page for API key management (no more hardcoded keys)
- 🐛 **Fixed**: Improved DOM selectors, better error messages, bundled jsPDF locally

---

## 🐛 Known Issues & Limitations

- **Browser Extension Only**: Cannot run directly in web browsers' built-in viewers (requires installation)
- **YouTube DOM Changes**: YouTube frequently updates their page structure - extension uses multiple fallback selectors
- **Transcript Required**: Videos must have transcripts enabled (auto-generated or manual)
- **API Key Required**: Users must obtain their own free Gemini API key from Google AI Studio

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/AmazingFeature`)
3. **Commit your changes** (`git commit -m 'Add some AmazingFeature'`)
4. **Push to the branch** (`git push origin feature/AmazingFeature`)
5. **Open a Pull Request**

### Development Workflow
1. Edit files in your IDE/Replit
2. Go to `chrome://extensions` in your browser
3. Click the reload icon on interYT extension card
4. Test on YouTube videos

### Testing Checklist
- [ ] Extension loads without errors
- [ ] Settings page opens and saves API key
- [ ] Transcript auto-fetches correctly
- [ ] Q&A generates accurate responses
- [ ] Comment fetching and summarization works
- [ ] No console errors (check DevTools)
- [ ] All spinners stop properly

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Google Gemini API** - Powers all AI features
- **jsTXT** - Enables TXT export functionality
- **YouTube** - For the platform and content
- **Chrome Extensions Team** - For the Manifest V3 platform

---

## 📞 Support & Resources

- **GitHub Issues**: [Report bugs or request features](https://github.com/dangerouslyconfident/interYT/issues)
- **Google AI Studio**: [Get your free Gemini API key](https://aistudio.google.com)
- **Chrome Extensions Docs**: [Learn about extension development](https://developer.chrome.com/docs/extensions)

---

## 🎯 Future Roadmap

- [ ] Export/import Q&A history
- [ ] Custom AI prompt templates
- [ ] Support for more video platforms (Vimeo, Dailymotion)
- [ ] Batch comment analysis
- [ ] Bookmark favorite Q&A sessions
- [ ] Dark/light theme toggle
- [ ] Keyboard shortcuts
- [ ] Multi-language support

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/dangerouslyconfident">dangerouslyconfident</a>
</p>

<p align="center">
  <sub>If you found this helpful, consider giving it a ⭐ on GitHub!</sub>
</p>

