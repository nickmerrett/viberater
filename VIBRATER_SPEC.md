# Vibrater - Conversational Idea Capture Tool

## Core Concept
A chat-based mobile app for quickly capturing and exploring vibe coding ideas through natural conversation, not forms.

## The Interaction Flow

### Quick Capture Mode
```
You: "idea for a generative art thing with music"

Vibrater: Nice! Tell me more - what's the vibe?
         [Chill] [Energetic] [Trippy] [Minimal]

You: "trippy"

Vibrater: Love it. Audio-reactive visuals? What kind of music?

You: [voice] "yeah like visualizer for whatever's playing,
     maybe pulls colors from album art"

Vibrater: Sick. Saved as "Audio-reactive visualizer w/ album colors"
         Want to add anything else or rate the excitement level?

You: "8/10 excitement, weekend project"

Vibrater: ✓ Captured
         [View] [Add More Context] [Start New]
```

### Browse/Review Mode
```
You: "show me my ideas"

Vibrater: You've got 23 ideas! Filter by:
         [All] [This Week] [High Excitement] [Weekend Projects]

You: "weekend projects"

Vibrater: 7 weekend-sized ideas:
         🎨 Audio visualizer w/ album colors (8/10) - 2 days ago
         🌊 Mood blob thing (7/10) - 1 week ago
         ...

         [Tap any to expand or start building]
```

### Exploration Mode
```
You: "help me flesh out the visualizer idea"

Vibrater: Let's dig in! What have you figured out so far?

You: [voice] "I'm thinking WebGL for performance..."

Vibrater: Smart. Questions:
         - Real-time audio or playlist-based?
         - Desktop app or web?
         - Spotify integration or any audio source?

[Conversational back-and-forth continues, app updates idea doc]
```

## Key Features

### Input Methods
- **Voice dictation** (primary) - tap & talk
- **Text chat** (fallback)
- **Quick voice notes** - just ramble, AI summarizes

### Conversational AI Helper
- Asks clarifying questions
- Suggests related tech/tools
- Helps estimate complexity
- Prompts for missing details
- Recalls past ideas for connections

### Organization (No Manual Tagging)
- **Auto-categorization** from conversation
- **Vibe detection** (chill, energetic, aesthetic, etc.)
- **Excitement rating** (you say "pretty excited" → 7/10)
- **Complexity estimate** (weekend/week/epic)
- **Tech stack extraction** (mentions "React" → tagged)

### Smart Features
- **"Similar ideas"** - finds related concepts you've logged
- **Combo suggestions** - "You could merge ideas #3 and #7"
- **Momentum tracking** - "You've had 5 music-related ideas this month"
- **Build prompts** - "Ready to start the visualizer? I can help scaffold it"

## Data Model

```javascript
{
  id: "uuid",
  timestamp: "2024-12-12T10:30:00Z",

  // Raw capture
  transcript: "original voice/text",
  conversation: [{role: "user", content: "..."}, ...],

  // Extracted
  title: "Audio visualizer w/ album colors",
  summary: "WebGL visualizer that reacts to music...",
  vibe: ["trippy", "visual", "music"],
  excitement: 8,
  complexity: "weekend",
  techStack: ["WebGL", "Web Audio API", "Canvas"],

  // Meta
  status: "idea|planning|building|done|abandoned",
  relatedIdeas: ["id2", "id5"],
  lastViewed: "timestamp",

  // Rich content
  notes: "additional context added later",
  links: ["inspiration urls"],
  sketches: ["image urls if uploaded"]
}
```

## Tech Stack (Proposal)

### Frontend
- **React** or **Svelte** (lightweight)
- **PWA** (installable, offline-capable)
- **Tailwind CSS** (fast styling)
- Mobile-first responsive design

### Voice/AI
- **Web Speech API** (browser native, free)
- **OpenAI API** or **local LLM** (for conversational AI)
  - Could start simple with pattern matching
  - Upgrade to AI later
- **Whisper API** (better voice transcription) - optional

### Storage
- **Phase 1:** LocalStorage/IndexedDB (offline-first)
- **Phase 2:** Optional cloud sync (Firebase, Supabase)
- Export to markdown anytime

### Optional Features
- **GitHub integration** - create issues from ideas
- **Share mode** - send idea to friend
- **Build mode** - scaffold project from spec

## Open Questions

1. **AI dependency?**
   - Start with simple pattern matching or go full LLM?
   - Self-hosted (privacy) vs API (easier)?

2. **Monetization?**
   - Free tool for community?
   - Freemium (basic free, AI features paid)?
   - Just for you vs public app?

3. **Platform priority?**
   - Mobile-first PWA?
   - Desktop too?
   - Native app later?

4. **Voice privacy?**
   - All local processing?
   - OK with API calls to OpenAI/etc?

5. **Scope for V1?**
   - Just capture + browse?
   - Include conversational refinement?
   - Full AI assistant?

## Development Phases

### MVP (Weekend Build)
- Mobile web app
- Voice input → text
- Simple chat interface
- Save ideas locally
- Browse list of ideas

### V1 (Week Build)
- Conversational prompts
- Auto-categorization
- Better mobile UX
- PWA installable
- Export to markdown

### V2 (Future)
- Full AI conversation
- Similar ideas detection
- Cloud sync
- Collaboration features
- Build mode (scaffold projects)

---

## Next Steps

Discuss:
- Which open questions need answers?
- What's the MVP feature set?
- Ready to start building or refine spec more?
