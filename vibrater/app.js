// Vibrater - Conversational Idea Capture Tool

class Vibrater {
    constructor() {
        this.ideas = this.loadIdeas();
        this.currentConversation = [];
        this.currentIdea = null;
        this.conversationState = 'idle'; // idle, capturing, refining

        this.recognition = null;
        this.isRecording = false;

        this.init();
    }

    init() {
        this.setupVoiceRecognition();
        this.setupEventListeners();
        this.showWelcomeMessage();
    }

    // Voice Recognition Setup
    setupVoiceRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = 'en-US';

            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                this.handleUserInput(transcript);
            };

            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.stopRecording();
                if (event.error === 'no-speech') {
                    this.addMessage('assistant', "Didn't catch that. Try again?");
                }
            };

            this.recognition.onend = () => {
                this.stopRecording();
            };
        } else {
            console.warn('Speech recognition not supported');
            this.showTextInput();
        }
    }

    // Event Listeners
    setupEventListeners() {
        const voiceBtn = document.getElementById('voiceBtn');
        const sendBtn = document.getElementById('sendBtn');
        const textInput = document.getElementById('textInput');
        const toggleInputBtn = document.getElementById('toggleInputBtn');
        const menuBtn = document.getElementById('menuBtn');
        const menuOverlay = document.getElementById('menuOverlay');

        voiceBtn.addEventListener('click', () => this.toggleRecording());
        sendBtn.addEventListener('click', () => this.handleTextInput());
        textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleTextInput();
        });
        toggleInputBtn.addEventListener('click', () => this.toggleInputMode());
        menuBtn.addEventListener('click', () => this.toggleMenu());

        // Menu actions
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                this.handleMenuAction(action);
            });
        });

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.filterIdeas(btn.dataset.filter);
            });
        });

        menuOverlay.addEventListener('click', (e) => {
            if (e.target === menuOverlay) this.toggleMenu();
        });
    }

    // Recording Controls
    toggleRecording() {
        if (!this.recognition) {
            this.showTextInput();
            return;
        }

        if (this.isRecording) {
            this.recognition.stop();
        } else {
            this.startRecording();
        }
    }

    startRecording() {
        this.isRecording = true;
        const voiceBtn = document.getElementById('voiceBtn');
        voiceBtn.classList.add('recording');
        voiceBtn.querySelector('.voice-text').textContent = 'Listening...';

        try {
            this.recognition.start();
        } catch (error) {
            console.error('Error starting recognition:', error);
            this.stopRecording();
        }
    }

    stopRecording() {
        this.isRecording = false;
        const voiceBtn = document.getElementById('voiceBtn');
        voiceBtn.classList.remove('recording');
        voiceBtn.querySelector('.voice-text').textContent = 'Tap to speak';
    }

    // Input Handling
    handleTextInput() {
        const textInput = document.getElementById('textInput');
        const text = textInput.value.trim();
        if (text) {
            this.handleUserInput(text);
            textInput.value = '';
        }
    }

    handleUserInput(text) {
        this.addMessage('user', text);
        this.currentConversation.push({ role: 'user', content: text });
        this.processInput(text);
    }

    toggleInputMode() {
        const voiceBtn = document.getElementById('voiceBtn');
        const textWrapper = document.querySelector('.text-input-wrapper');
        const toggleBtn = document.getElementById('toggleInputBtn');

        if (voiceBtn.style.display === 'none') {
            voiceBtn.style.display = 'flex';
            textWrapper.style.display = 'none';
            toggleBtn.textContent = '💬';
        } else {
            voiceBtn.style.display = 'none';
            textWrapper.style.display = 'flex';
            toggleBtn.textContent = '🎤';
            document.getElementById('textInput').focus();
        }
    }

    showTextInput() {
        document.getElementById('voiceBtn').style.display = 'none';
        document.querySelector('.text-input-wrapper').style.display = 'flex';
        document.getElementById('toggleInputBtn').textContent = '🎤';
    }

    // Conversational AI Logic
    processInput(text) {
        const lowerText = text.toLowerCase();

        // Check for commands/intents
        if (lowerText.includes('show') && (lowerText.includes('ideas') || lowerText.includes('list'))) {
            this.showIdeasList();
            return;
        }

        if (lowerText.includes('help')) {
            this.showHelp();
            return;
        }

        // Handle based on conversation state
        if (this.conversationState === 'idle') {
            this.startIdeaCapture(text);
        } else if (this.conversationState === 'capturing') {
            this.refineIdea(text);
        } else if (this.conversationState === 'rating') {
            this.captureRating(text);
        }
    }

    startIdeaCapture(text) {
        this.currentIdea = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            transcript: text,
            conversation: [...this.currentConversation],
            title: this.extractTitle(text),
            summary: text,
            vibe: this.extractVibes(text),
            techStack: this.extractTechStack(text),
            status: 'idea',
            excitement: null,
            complexity: this.estimateComplexity(text)
        };

        this.conversationState = 'capturing';

        // Ask follow-up question
        const followUps = [
            "Nice! Tell me more - what's the vibe you're going for?",
            "Cool idea! What feeling or aesthetic are you imagining?",
            "Interesting! What's the core experience you want to create?",
            "I like it! What makes this exciting to you?"
        ];

        const response = followUps[Math.floor(Math.random() * followUps.length)];
        this.addMessage('assistant', response);

        // Add vibe quick actions
        this.addQuickActions(['Chill', 'Energetic', 'Trippy', 'Minimal', 'Retro', 'Futuristic']);
    }

    refineIdea(text) {
        // Update idea with new information
        this.currentIdea.summary += ' ' + text;
        this.currentIdea.vibe.push(...this.extractVibes(text));
        this.currentIdea.techStack.push(...this.extractTechStack(text));

        // Check if we should ask for rating
        if (!this.currentIdea.excitement) {
            this.conversationState = 'rating';
            this.addMessage('assistant', "Love it! How excited are you about this on a scale of 1-10?");
            this.addQuickActions(['5', '6', '7', '8', '9', '10']);
        } else {
            // Save and offer next steps
            this.saveCurrentIdea();
        }
    }

    captureRating(text) {
        const rating = this.extractNumber(text);
        if (rating) {
            this.currentIdea.excitement = rating;
            this.saveCurrentIdea();
        } else {
            this.addMessage('assistant', "Could you give me a number between 1-10?");
        }
    }

    saveCurrentIdea() {
        // Clean up duplicates in arrays
        this.currentIdea.vibe = [...new Set(this.currentIdea.vibe)];
        this.currentIdea.techStack = [...new Set(this.currentIdea.techStack)];

        // Save to ideas list
        this.ideas.push(this.currentIdea);
        this.saveIdeas();

        const excitement = this.currentIdea.excitement;
        const enthusiasmLevel = excitement >= 8 ? "That's fire! 🔥" : excitement >= 6 ? "Solid idea!" : "Cool!";

        this.addMessage('system', `✓ Saved: "${this.currentIdea.title}"`);
        this.addMessage('assistant', `${enthusiasmLevel} Captured and saved. Want to add more details or start a new idea?`);

        this.addQuickActions(['Add more', 'New idea', 'View all ideas']);

        // Reset state
        this.currentIdea = null;
        this.conversationState = 'idle';
    }

    // Helper: Extract information from text
    extractTitle(text) {
        // Simple title extraction - take first ~5 words
        const words = text.split(' ').slice(0, 5).join(' ');
        return words.charAt(0).toUpperCase() + words.slice(1);
    }

    extractVibes(text) {
        const vibeKeywords = {
            'chill': ['chill', 'calm', 'relax', 'zen', 'peaceful', 'ambient'],
            'energetic': ['energetic', 'dynamic', 'intense', 'fast', 'active'],
            'trippy': ['trippy', 'psychedelic', 'surreal', 'weird', 'mind-bending'],
            'minimal': ['minimal', 'clean', 'simple', 'elegant', 'minimalist'],
            'retro': ['retro', 'vintage', 'nostalgic', 'old-school', '80s', '90s', 'y2k'],
            'futuristic': ['futuristic', 'sci-fi', 'cyber', 'neon', 'tech'],
            'playful': ['playful', 'fun', 'cute', 'whimsical', 'quirky'],
            'dark': ['dark', 'moody', 'mysterious', 'gothic', 'noir']
        };

        const found = [];
        const lower = text.toLowerCase();

        for (const [vibe, keywords] of Object.entries(vibeKeywords)) {
            if (keywords.some(kw => lower.includes(kw))) {
                found.push(vibe);
            }
        }

        return found;
    }

    extractTechStack(text) {
        const techKeywords = [
            'react', 'vue', 'svelte', 'three.js', 'p5.js', 'webgl', 'canvas',
            'node', 'python', 'rust', 'shader', 'audio api', 'web audio',
            'arduino', 'raspberry pi', 'electron', 'pwa', 'mobile'
        ];

        const found = [];
        const lower = text.toLowerCase();

        techKeywords.forEach(tech => {
            if (lower.includes(tech)) {
                found.push(tech);
            }
        });

        return found;
    }

    estimateComplexity(text) {
        const lower = text.toLowerCase();

        if (lower.includes('simple') || lower.includes('quick') || lower.includes('weekend')) {
            return 'weekend';
        }
        if (lower.includes('big') || lower.includes('complex') || lower.includes('full')) {
            return 'epic';
        }

        return 'week';
    }

    extractNumber(text) {
        const match = text.match(/\d+/);
        return match ? parseInt(match[0]) : null;
    }

    // UI Methods
    addMessage(role, content) {
        const messagesDiv = document.getElementById('messages');
        const messageEl = document.createElement('div');
        messageEl.className = `message ${role}`;
        messageEl.textContent = content;
        messagesDiv.appendChild(messageEl);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    addQuickActions(actions) {
        const messagesDiv = document.getElementById('messages');
        const actionsEl = document.createElement('div');
        actionsEl.className = 'message assistant';

        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'quick-actions';

        actions.forEach(action => {
            const btn = document.createElement('button');
            btn.className = 'quick-btn';
            btn.textContent = action;
            btn.addEventListener('click', () => {
                this.handleUserInput(action);
                actionsEl.remove();
            });
            buttonsContainer.appendChild(btn);
        });

        actionsEl.appendChild(buttonsContainer);
        messagesDiv.appendChild(actionsEl);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    showWelcomeMessage() {
        this.addMessage('assistant', "Hey! I'm Vibrater. Tell me about your vibe coding idea and I'll help you capture it.");
        this.addMessage('assistant', "Just tap the mic and start talking, or type if you prefer.");
    }

    showHelp() {
        this.addMessage('assistant', "I can help you:\n• Capture new ideas (just start talking!)\n• View your saved ideas (say 'show ideas')\n• Refine and explore concepts\n\nWhat do you want to do?");
    }

    clearConversation() {
        document.getElementById('messages').innerHTML = '';
        this.currentConversation = [];
        this.conversationState = 'idle';
        this.currentIdea = null;
        this.showWelcomeMessage();
    }

    // Ideas List View
    showIdeasList() {
        document.getElementById('chatView').classList.remove('active');
        document.getElementById('listView').classList.add('active');
        this.renderIdeasList();
    }

    showChatView() {
        document.getElementById('listView').classList.remove('active');
        document.getElementById('chatView').classList.add('active');
    }

    renderIdeasList(filter = 'all') {
        const listContainer = document.getElementById('ideasList');
        listContainer.innerHTML = '';

        let filteredIdeas = [...this.ideas].reverse(); // Newest first

        if (filter === 'weekend') {
            filteredIdeas = filteredIdeas.filter(idea => idea.complexity === 'weekend');
        } else if (filter === 'excited') {
            filteredIdeas = filteredIdeas.filter(idea => idea.excitement >= 7);
        }

        if (filteredIdeas.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <h3>No ideas yet!</h3>
                    <p>Start a conversation to capture your first idea.</p>
                </div>
            `;
            return;
        }

        filteredIdeas.forEach(idea => {
            const card = this.createIdeaCard(idea);
            listContainer.appendChild(card);
        });
    }

    createIdeaCard(idea) {
        const card = document.createElement('div');
        card.className = 'idea-card';

        const timeAgo = this.formatTimeAgo(idea.timestamp);

        card.innerHTML = `
            <h3>${idea.title}</h3>
            <p class="summary">${idea.summary.substring(0, 150)}${idea.summary.length > 150 ? '...' : ''}</p>
            <div class="meta">
                ${idea.excitement ? `<span class="meta-tag excitement">${idea.excitement}/10 excited</span>` : ''}
                ${idea.complexity ? `<span class="meta-tag">${idea.complexity}</span>` : ''}
                ${idea.vibe.slice(0, 3).map(v => `<span class="meta-tag">${v}</span>`).join('')}
                <span class="meta-tag">${timeAgo}</span>
            </div>
        `;

        card.addEventListener('click', () => this.showIdeaDetail(idea));

        return card;
    }

    showIdeaDetail(idea) {
        this.showChatView();
        this.clearConversation();

        this.addMessage('system', `Viewing: ${idea.title}`);
        this.addMessage('assistant', `**${idea.title}**\n\n${idea.summary}`);

        if (idea.vibe.length > 0) {
            this.addMessage('assistant', `Vibes: ${idea.vibe.join(', ')}`);
        }

        if (idea.techStack.length > 0) {
            this.addMessage('assistant', `Tech: ${idea.techStack.join(', ')}`);
        }

        this.addMessage('assistant', "Want to refine this idea or start building it?");
        this.addQuickActions(['Refine', 'Export', 'Back to list']);
    }

    filterIdeas(filter) {
        this.renderIdeasList(filter);
    }

    formatTimeAgo(timestamp) {
        const now = new Date();
        const then = new Date(timestamp);
        const seconds = Math.floor((now - then) / 1000);

        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
        return `${Math.floor(seconds / 604800)}w ago`;
    }

    // Menu Actions
    toggleMenu() {
        document.getElementById('menuOverlay').classList.toggle('active');
    }

    handleMenuAction(action) {
        this.toggleMenu();

        switch(action) {
            case 'newIdea':
                this.showChatView();
                this.clearConversation();
                break;
            case 'viewIdeas':
                this.showIdeasList();
                break;
            case 'export':
                this.exportToMarkdown();
                break;
            case 'clear':
                this.clearConversation();
                break;
            case 'closeMenu':
                // Already closed by toggleMenu
                break;
        }
    }

    exportToMarkdown() {
        let markdown = '# Vibrater Ideas\n\n';
        markdown += `Exported: ${new Date().toLocaleString()}\n\n`;
        markdown += `Total Ideas: ${this.ideas.length}\n\n---\n\n`;

        this.ideas.forEach((idea, index) => {
            markdown += `## ${index + 1}. ${idea.title}\n\n`;
            markdown += `**Summary:** ${idea.summary}\n\n`;

            if (idea.excitement) {
                markdown += `**Excitement:** ${idea.excitement}/10\n\n`;
            }

            if (idea.complexity) {
                markdown += `**Complexity:** ${idea.complexity}\n\n`;
            }

            if (idea.vibe.length > 0) {
                markdown += `**Vibes:** ${idea.vibe.join(', ')}\n\n`;
            }

            if (idea.techStack.length > 0) {
                markdown += `**Tech Stack:** ${idea.techStack.join(', ')}\n\n`;
            }

            markdown += `**Captured:** ${new Date(idea.timestamp).toLocaleString()}\n\n`;
            markdown += '---\n\n';
        });

        // Download file
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vibrater-ideas-${Date.now()}.md`;
        a.click();
        URL.revokeObjectURL(url);

        this.addMessage('system', '✓ Exported to markdown');
    }

    // Storage
    saveIdeas() {
        localStorage.setItem('vibrater_ideas', JSON.stringify(this.ideas));
    }

    loadIdeas() {
        const saved = localStorage.getItem('vibrater_ideas');
        return saved ? JSON.parse(saved) : [];
    }
}

// Initialize app
const app = new Vibrater();

// Register service worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed:', err));
    });
}
