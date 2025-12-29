import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useDataStore } from '../store/useDataStore';

export default function BrainstormChat({ onClose, seedIdea = null }) {
  const [messages, setMessages] = useState([]);
  const [capturedSnippets, setCapturedSnippets] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [provider, setProvider] = useState('claude');
  const [providers, setProviders] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const { createIdea } = useDataStore();

  useEffect(() => {
    loadProviders();
    startConversation();
    initVoiceRecognition();

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initVoiceRecognition = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;

        // Check for voice capture commands
        const transcriptLower = transcript.toLowerCase();
        const captureCommands = [
          'note that',
          'capture that',
          'save that',
          'remember that',
          'that\'s an idea',
          'capture this',
          'note this'
        ];

        const hasCaptureCommand = captureCommands.some(cmd => transcriptLower.includes(cmd));

        if (hasCaptureCommand) {
          // Use setMessages callback to get current messages
          setMessages(currentMessages => {
            const lastAiMessage = [...currentMessages].reverse().find(m => m.role === 'assistant');
            if (lastAiMessage) {
              setCapturedSnippets(prev => [...prev, {
                id: Date.now(),
                text: lastAiMessage.content,
                role: 'assistant',
                timestamp: new Date(),
                isVoiceCommand: true
              }]);
            }
            return currentMessages;
          });
          setIsListening(false);
        } else {
          // Regular voice input
          setInput(transcript);
          setIsListening(false);
        }
      };

      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  };

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadProviders = async () => {
    try {
      const data = await api.getAIProviders();
      setProviders(data.providers);
      const available = Object.entries(data.providers).find(([_, p]) => p.available);
      if (available) setProvider(available[0]);
    } catch (error) {
      console.error('Failed to load providers:', error);
    }
  };

  const startConversation = async () => {
    setLoading(true);
    setError(null);

    const systemPrompt = `You are a creative brainstorming partner - a sounding board for ideas. Have natural, freeform conversations.

Your role is to:
- Ask thoughtful questions
- Suggest interesting angles and variations
- Make unexpected connections
- Help flesh out vague concepts
- Explore "what if" scenarios
- Challenge assumptions gently
- Be enthusiastic and exploratory

Keep responses conversational (2-4 sentences). Don't solve problems - help them think through ideas.`;

    let userPrompt;
    if (seedIdea) {
      userPrompt = `I have this idea: "${seedIdea.title}" - ${seedIdea.summary}

Let's riff on this. What comes to mind?`;
    } else {
      userPrompt = 'Hey! Want to brainstorm some project ideas?';
    }

    try {
      const response = await api.chatWithAI([
        { role: 'user', content: userPrompt }
      ], { provider, systemPrompt });

      setMessages([
        { role: 'user', content: userPrompt },
        { role: 'assistant', content: response.message }
      ]);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading) return;

    const trimmedInput = input.trim();

    // Check for slash commands
    if (trimmedInput.startsWith('/note ') || trimmedInput.startsWith('/idea ')) {
      const commandText = trimmedInput.substring(6).trim(); // Remove "/note " or "/idea "

      if (commandText.length > 0) {
        setCapturedSnippets(prev => [...prev, {
          id: Date.now(),
          text: commandText,
          role: 'user',
          timestamp: new Date(),
          isCommand: true
        }]);
      }

      setInput('');
      return;
    }

    // Check for /capture command (captures last AI message)
    if (trimmedInput === '/capture' && messages.length > 0) {
      const lastAiMessage = [...messages].reverse().find(m => m.role === 'assistant');
      if (lastAiMessage) {
        handleCaptureMessage(lastAiMessage.content, 'assistant');
      }
      setInput('');
      return;
    }

    // Regular message
    const userMessage = { role: 'user', content: trimmedInput };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setError(null);

    const systemPrompt = `You are a creative brainstorming partner - a sounding board, not a problem solver.

Build on what they just said:
- Ask follow-up questions
- Suggest interesting angles
- Make unexpected connections
- Help them think it through
- Explore "what if" scenarios

Keep it conversational (2-4 sentences). Be a foil to bounce ideas off.`;

    try {
      const response = await api.chatWithAI(newMessages, { provider, systemPrompt });
      setMessages([...newMessages, { role: 'assistant', content: response.message }]);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCaptureMessage = (text, role) => {
    setCapturedSnippets(prev => [...prev, {
      id: Date.now(),
      text: text.trim(),
      role,
      timestamp: new Date()
    }]);
  };

  const handleSaveSnippetAsIdea = async (snippet) => {
    const title = snippet.text.split('\n')[0].substring(0, 60);

    try {
      await createIdea({
        title,
        summary: snippet.text,
        tags: seedIdea?.tags || [],
        excitement: 5,
        complexity: 'weekend',
        vibe: ['brainstorm', 'captured'],
        techStack: [],
        parent_idea_id: seedIdea?.id,
        related_ideas: seedIdea ? [seedIdea.id] : []
      });

      setCapturedSnippets(prev => prev.filter(s => s.id !== snippet.id));
      alert('Saved as idea!');
    } catch (error) {
      alert('Failed to save');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
      <div className="glass rounded-3xl w-full max-w-6xl h-[85vh] flex overflow-hidden">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-white/10 flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="text-2xl font-bold">
                {seedIdea ? '🗣️ Riff on Idea' : '💭 Brainstorm Session'}
              </h2>
              <p className="text-gray-400 text-sm mt-1">
                {seedIdea ? `"${seedIdea.title}"` : 'Bounce ideas around with AI'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {providers && (
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="glass px-3 py-2 rounded-lg text-sm"
                  disabled={loading}
                >
                  {Object.entries(providers).map(([key, p]) => (
                    <option key={key} value={key} disabled={!p.available}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
              <button onClick={onClose} className="w-10 h-10 rounded-xl glass hover:bg-white/5 flex items-center justify-center">
                ✕
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="relative max-w-[75%]">
                  {msg.role === 'user' ? (
                    /* User messages - click whole message */
                    <div className="group">
                      <div
                        className="px-4 py-3 rounded-2xl cursor-pointer transition-all bg-gradient-primary text-white hover:shadow-lg hover:shadow-primary/40"
                        onClick={() => handleCaptureMessage(msg.content, msg.role)}
                        title="Click to capture this message"
                      >
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      </div>
                      <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-xs bg-accent text-white px-2 py-0.5 rounded-full shadow-lg">
                          ✂️ Capture
                        </span>
                      </div>
                    </div>
                  ) : (
                    /* AI messages - click individual sentences */
                    <div className="px-4 py-3 rounded-2xl glass">
                      {msg.content.split(/(?<=[.!?])\s+/).map((sentence, si) => (
                        <span
                          key={si}
                          className="cursor-pointer hover:bg-accent/20 hover:text-accent rounded px-1 transition-all inline-block"
                          onClick={() => handleCaptureMessage(sentence.trim(), msg.role)}
                          title="Click to capture this sentence"
                        >
                          {sentence}
                          {si < msg.content.split(/(?<=[.!?])\s+/).length - 1 && ' '}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="glass px-4 py-3 rounded-2xl">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="p-6 border-t border-white/10 flex-shrink-0">
            {/* Slash command hints */}
            {input.startsWith('/') && !input.includes(' ') && (
              <div className="mb-2 glass rounded-lg p-3 text-sm">
                <div className="font-semibold mb-2 text-gray-300">Commands:</div>
                <div className="space-y-1 text-gray-400">
                  <div><code className="text-accent">/note your text</code> - Capture a note directly</div>
                  <div><code className="text-accent">/idea your text</code> - Capture an idea directly</div>
                  <div><code className="text-accent">/capture</code> - Capture last AI message</div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={toggleVoiceInput}
                disabled={loading}
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                  isListening ? 'bg-red-500 text-white animate-pulse' : 'glass hover:bg-white/5'
                } disabled:opacity-50`}
              >
                {isListening ? '🎙️' : '🎤'}
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isListening ? 'Listening...' : "Type / for commands"}
                className="input flex-1"
                disabled={loading || isListening}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="btn-primary disabled:opacity-50 min-w-[80px]"
              >
                {loading ? '...' : 'Send'}
              </button>
            </div>
          </form>
        </div>

        {/* Captured Snippets Sidebar */}
        <div className="w-80 border-l border-white/10 flex flex-col bg-black/20">
          <div className="p-4 border-b border-white/10">
            <h3 className="font-semibold flex items-center gap-2">
              <span>✂️</span> Captured ({capturedSnippets.length})
            </h3>
            <p className="text-xs text-gray-400 mt-1">Click messages to save good bits</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {capturedSnippets.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-8">
                <p>Click any message</p>
                <p className="text-xs mt-2">to capture it here</p>
              </div>
            ) : (
              capturedSnippets.map(snippet => (
                <div key={snippet.id} className="glass rounded-lg p-3 text-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                      {snippet.role === 'user' ? '👤 You' : '🤖 AI'}
                    </span>
                    {snippet.isCommand && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent">
                        /cmd
                      </span>
                    )}
                    {snippet.isVoiceCommand && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                        🎤
                      </span>
                    )}
                    <span className="text-xs text-gray-400 ml-auto">
                      {new Date(snippet.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-gray-200 mb-3">{snippet.text}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveSnippetAsIdea(snippet)}
                      className="flex-1 px-2 py-1 rounded bg-accent hover:bg-accent/80 text-white text-xs"
                    >
                      💡 Save as Idea
                    </button>
                    <button
                      onClick={() => setCapturedSnippets(prev => prev.filter(s => s.id !== snippet.id))}
                      className="px-2 py-1 rounded glass hover:bg-red-500/20 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
