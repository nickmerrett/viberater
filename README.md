# Vibrater 🎤✨

**Voice-driven idea capture and project management for developers**

Vibrater is a full-stack PWA that helps you capture, refine, and manage project ideas through natural conversation and AI-powered workflows. Think of it as your creative development partner that helps you go from "I have an idea" to "I shipped a project."

## ✨ Features

- 🎙️ **Voice Input** - Capture ideas by speaking naturally
- 🤖 **AI Refinement** - Chat with AI to flesh out your ideas
- 📋 **Project Management** - Promote ideas to tracked projects with tasks
- 💾 **Offline-First PWA** - Works completely offline with local storage
- 🔄 **Multi-Database** - Supports both SQLite (simple) and PostgreSQL (scalable)
- 🐳 **Docker Ready** - One-command deployment
- ☸️ **Kubernetes Ready** - Production-grade k8s configs included

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# Clone the repo
git clone https://github.com/nickmerrett/viberater.git
cd viberater

# Copy environment variables
cp .env.example .env

# Add your AI API keys to .env
# CLAUDE_API_KEY=sk-ant-...
# OPENAI_API_KEY=sk-...

# Start everything (uses SQLite by default)
docker compose up

# Open http://localhost:8080
```

### Option 2: Local Development

```bash
# Backend
cd vibrater-backend
npm install
npm run migrate
npm run dev

# Frontend (separate terminal)
cd vibrater
npm install
npm run dev

# Open http://localhost:5173
```

## 📚 Documentation

- **[Getting Started](GETTING_STARTED.md)** - Detailed setup guide
- **[Architecture](ARCHITECTURE.md)** - System design and tech stack
- **[Deployment](DEPLOYMENT.md)** - Production deployment guide
- **[Database Guide](DATABASE.md)** - SQLite vs PostgreSQL configuration
- **[API Reference](QUICK_REFERENCE.md)** - Backend API documentation
- **[Project Status](PROJECT_STATUS.md)** - Current features and roadmap

## 🗄️ Database Options

Vibrater supports both SQLite and PostgreSQL:

**SQLite (Default)**
- ✅ Zero configuration
- ✅ Single file database
- ✅ Perfect for personal use
- ✅ Easy backups (just copy the file!)

**PostgreSQL**
- ✅ Better for teams
- ✅ Horizontal scaling
- ✅ Production-grade

Switch between them by setting `DB_TYPE=sqlite` or `DB_TYPE=postgres` in your `.env` file.

See [DATABASE.md](DATABASE.md) for migration instructions.

## 🏗️ Tech Stack

**Frontend**
- React + Vite
- Tailwind CSS
- Zustand (state management)
- Workbox (PWA/offline support)

**Backend**
- Node.js + Express
- SQLite / PostgreSQL
- JWT authentication
- Claude & OpenAI integration

**Infrastructure**
- Docker & Docker Compose
- Kubernetes (optional)
- Nginx reverse proxy

## 🎯 Workflow

1. **Capture** - Speak or type your idea
2. **Refine** - Chat with AI to explore details
3. **Design** - Generate MVP specs and architecture
4. **Promote** - Convert to a tracked project
5. **Execute** - Work through AI-generated tasks
6. **Ship** - Track progress and completion

## 🔐 Environment Variables

Create a `.env` file in the root directory:

```bash
# Database
DB_TYPE=sqlite
SQLITE_DIR=./vibrater-backend/storage

# AI Providers
CLAUDE_API_KEY=sk-ant-your-key-here
OPENAI_API_KEY=sk-your-key-here

# JWT
JWT_SECRET=your-secret-key-min-32-chars

# Optional
DEFAULT_AI_PROVIDER=claude
MODEL_PRIMARY=claude-3-5-sonnet-20240620
```

## 📱 PWA Installation

### Desktop (Chrome/Edge)
1. Click the install icon in the address bar
2. Or use the prompt that appears

### Mobile (iOS Safari)
1. Tap the Share button
2. Select "Add to Home Screen"

### Mobile (Android Chrome)
1. Tap the menu (⋮)
2. Select "Add to Home Screen"

## 🤝 Contributing

Contributions are welcome! This is a personal project but feel free to:
- Open issues for bugs or feature requests
- Submit pull requests
- Share your ideas and use cases

## 📄 License

MIT

## 🙏 Credits

Built with:
- [Claude](https://www.anthropic.com/claude) by Anthropic
- [OpenAI](https://openai.com/) for Whisper transcription
- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)

---

**Made for developers who have more ideas than time** ⚡
