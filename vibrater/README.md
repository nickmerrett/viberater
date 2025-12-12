# Vibrater 🎤✨

A conversational mobile-first PWA for quickly capturing vibe coding ideas through voice or text.

## Features

- 🎤 **Voice Input** - Tap and talk to capture ideas naturally
- 💬 **Conversational Interface** - Chat-based interaction, not forms
- 🤖 **Smart Extraction** - Auto-detects vibes, tech stack, complexity
- 📱 **Mobile-First PWA** - Installable on iOS, Android, and desktop
- 💾 **Offline-First** - All data stored locally, works without internet
- 🌙 **Dark Mode** - Easy on the eyes
- 📥 **Export** - Save ideas as markdown

## How to Use

### Quick Capture
1. Tap the mic button (or type)
2. Describe your idea naturally
3. Answer follow-up questions
4. Rate your excitement level
5. Done! Idea is saved

### Browse Ideas
- Menu → View All Ideas
- Filter by weekend projects, high excitement, or view all
- Tap any idea to see details

### Export
- Menu → Export to Markdown
- Downloads a .md file with all your ideas

## Running Locally

### Option 1: Python Server
```bash
cd vibrater
python3 -m http.server 8000
```
Then open http://localhost:8000

### Option 2: Node.js Server
```bash
cd vibrater
npx serve
```

### Option 3: Any Static Server
Just serve the vibrater directory with any static file server.

## Installing as PWA

### iOS
1. Open in Safari
2. Tap share button
3. "Add to Home Screen"
4. Launch from home screen

### Android
1. Open in Chrome
2. Tap menu (⋮)
3. "Install app" or "Add to Home Screen"
4. Launch from app drawer

### Desktop
1. Open in Chrome/Edge
2. Look for install icon in address bar
3. Click to install

## Tech Stack

- **Vanilla JavaScript** - No framework bloat
- **Web Speech API** - Browser-native voice recognition
- **LocalStorage** - Simple offline storage
- **Service Worker** - PWA caching
- **CSS Grid/Flexbox** - Responsive layout

## Browser Support

- ✅ Chrome/Edge (desktop & mobile)
- ✅ Safari (iOS 14.5+, macOS)
- ✅ Firefox (desktop)
- ⚠️ Voice input requires modern browser

## Privacy

All data stays on your device. No servers, no tracking, no cloud sync (yet).

## Future Ideas

- [ ] AI-powered conversational refinement
- [ ] Cloud sync (optional)
- [ ] Share ideas with others
- [ ] GitHub integration (create issues from ideas)
- [ ] Build mode (scaffold projects)
- [ ] Sketch/image upload
- [ ] Voice notes attachment

## License

MIT - Do whatever you want with it!
