# viberater 🎤✨

**Voice-driven idea capture and project management for developers**

viberater is a full-stack PWA that helps you capture, refine, and manage project ideas through natural conversation and AI-powered workflows. Think of it as your creative development partner that helps you go from "I have an idea" to "I shipped a project."

## ✨ Features

- 🎙️ **Voice Input** — Capture ideas by speaking naturally
- 🤖 **AI Capture** — Chat with AI; it automatically extracts and saves ideas from the conversation
- 💭 **Riff Mode** — Free-form brainstorm on a specific idea with full-screen AI chat
- 🔬 **AI Refinement** — Deepen an idea with targeted AI conversation
- ✂️ **Split Ideas** — Break one idea into two distinct directions
- 🚀 **Promote to Project** — Convert an idea into a tracked project with AI-generated tasks
- 🔗 **Idea Sharing** — Share any idea via a public link (no sign-in required for viewers)
- 📎 **Attachments** — Attach files and audio recordings to ideas
- 🗂️ **Areas** — Organise ideas into focus areas
- 💬 **Chat Sessions** — Each conversation is isolated; start a New Chat to keep threads finite
- 💾 **Offline-First PWA** — Works offline with IndexedDB; syncs when back online
- 🔄 **Multi-Database** — Supports SQLite (default) and PostgreSQL
- 🐳 **Docker Ready** — One-command deployment with Docker Compose
- ☸️ **Kubernetes / OpenShift Ready** — Production-grade k8s configs with Tekton CI/CD pipeline

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)

```bash
git clone https://github.com/nickmerrett/viberater.git
cd viberater

# Copy and configure environment variables
cp .env.example .env
# Edit .env — add your AI API key and set a JWT_SECRET

docker compose up

# Open http://localhost:8080
```

### Option 2: Local Development

```bash
# Backend
cd backend
npm install
npm run migrate
npm run dev        # runs on http://localhost:3000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev        # runs on http://localhost:5173
```

## 📚 Documentation

- **[User Guide](GUIDE.md)** — Installation and feature walkthrough
- **[Technical Docs](DOCS.md)** — Architecture, database schema, and deployment
- **[OpenShift Guide](k8s/OPENSHIFT.md)** — Deploy to OpenShift with Routes
- **[Kubernetes Guide](k8s/README.md)** — Deploy to any Kubernetes cluster

## 🗄️ Database Options

**SQLite (Default)**
- Zero configuration
- Single file — easy to back up
- Perfect for personal use

**PostgreSQL**
- Better for teams and horizontal scaling
- Production-grade

Set `DB_TYPE=sqlite` or `DB_TYPE=postgres` in your `.env` file. See [DOCS.md](DOCS.md) for migration details.

## 🏗️ Tech Stack

**Frontend**
- React + Vite
- Tailwind CSS
- Zustand (state management)
- Dexie / IndexedDB (offline storage)
- Workbox (PWA / background sync)

**Backend**
- Node.js + Express
- SQLite (better-sqlite3) / PostgreSQL
- JWT authentication
- Claude & OpenAI integration

**Infrastructure**
- Docker & Docker Compose
- Kubernetes / OpenShift
- Nginx reverse proxy (gateway + frontend)
- Tekton CI/CD pipeline (test → build → smoke → deploy)

## 🎯 Workflow

1. **Capture** — Speak or type; AI extracts ideas automatically from the conversation
2. **Riff** — Free-form brainstorm on an idea to explore new angles
3. **Refine** — Focused AI chat to deepen a specific idea
4. **Split** — Fork an idea into two separate directions when it grows
5. **Promote** — Convert to a tracked project with AI-generated tasks
6. **Share** — Send a public read-only link to anyone, no account needed

## 🔐 Environment Variables

```bash
# Database
DB_TYPE=sqlite
SQLITE_DIR=./storage          # path for SQLite file

# AI Providers
CLAUDE_API_KEY=sk-ant-your-key-here
OPENAI_API_KEY=sk-your-key-here     # optional

# Auth
JWT_SECRET=your-secret-key-minimum-32-chars

# Optional
DEFAULT_AI_PROVIDER=claude
MODEL_PRIMARY=claude-sonnet-4-5-20250929
```

## 📱 PWA Installation

**Desktop (Chrome / Edge)** — click the install icon in the address bar

**iOS Safari** — Share → Add to Home Screen

**Android Chrome** — Menu (⋮) → Add to Home Screen

## 🤝 Contributing

Contributions are welcome. Feel free to open issues for bugs or feature requests, or submit pull requests.

## 📄 License

MIT

---

**Made for developers who have more ideas than time** ⚡
