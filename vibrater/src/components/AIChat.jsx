import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import ProgressBar from './ProgressBar';

export default function AIChat({ idea, onClose }) {
  const [messages, setMessages] = useState([]);
  const [currentQuestions, setCurrentQuestions] = useState([]);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [progress, setProgress] = useState({});
  const [currentPhase, setCurrentPhase] = useState('purpose');
  const [isComplete, setIsComplete] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [provider, setProvider] = useState('claude');
  const [providers, setProviders] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

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
        setInput(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  };

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
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

      // Set first available provider as default
      const available = Object.entries(data.providers).find(([_, p]) => p.available);
      if (available) {
        setProvider(available[0]);
      }
    } catch (error) {
      console.error('Failed to load providers:', error);
    }
  };

  const startConversation = async () => {
    setLoading(true);
    setError(null);
    setSelectedAnswers({});
    try {
      // If idea has existing conversation, load it
      if (idea.conversation) {
        // Handle both string and object (depending on how it's stored)
        const existingMessages = typeof idea.conversation === 'string'
          ? JSON.parse(idea.conversation)
          : idea.conversation;
        setMessages(existingMessages);
        // Don't auto-ask questions - let user continue naturally
        setCurrentQuestions([]);
        setProgress({ purpose: true, users: true, features: true, implementation: true });
        setCurrentPhase('implementation');
        setIsComplete(false); // Can always continue refining
      } else {
        // Start fresh conversation
        const response = await api.refineIdea(idea, { provider });
        setMessages(response.conversation);
        setCurrentQuestions(response.questions || []);
        setProgress(response.progress || {});
        setCurrentPhase(response.phase || 'purpose');
        setIsComplete(response.isComplete || false);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e, messageText) => {
    if (e) e.preventDefault();

    // Combine selected answers with custom text
    let combinedText = messageText || '';

    // If we have selected answers and no explicit messageText, build from selections + input
    if (!messageText && Object.keys(selectedAnswers).length > 0) {
      const answersText = currentQuestions
        .map((q, i) => {
          const answer = selectedAnswers[i];
          if (!answer) return null;
          // Handle both single and multi-select
          const answerText = Array.isArray(answer) ? answer.join(', ') : answer;
          return `${q.question} ${answerText}`;
        })
        .filter(Boolean)
        .join('\n');

      const customText = input.trim();
      combinedText = [answersText, customText].filter(Boolean).join('\n\n');
    } else {
      combinedText = input.trim();
    }

    if (!combinedText || loading) return;

    const userMessage = { role: 'user', content: combinedText };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setCurrentQuestions([]);
    setSelectedAnswers({});
    setLoading(true);
    setError(null);

    try {
      const response = await api.chatWithAI(newMessages, { provider });
      const updatedMessages = [
        ...newMessages,
        { role: 'assistant', content: response.message }
      ];

      setMessages(updatedMessages);
      setCurrentQuestions(response.questions || []);
      setProgress(response.progress || {});
      setCurrentPhase(response.phase || 'purpose');
      setIsComplete(response.isComplete || false);

      // Auto-save conversation after each message
      try {
        await api.saveRefinedIdea(idea.id, updatedMessages, {
          status: response.isComplete ? 'refined' : 'refining'
        });
      } catch (saveError) {
        console.error('Auto-save failed:', saveError);
        // Don't show error to user, just log it
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (questionIndex, option, multiSelect = false) => {
    setSelectedAnswers(prev => {
      if (multiSelect) {
        // Multi-select: toggle option in array
        const current = prev[questionIndex] || [];
        const isSelected = current.includes(option);
        return {
          ...prev,
          [questionIndex]: isSelected
            ? current.filter(o => o !== option)
            : [...current, option]
        };
      } else {
        // Single select: replace
        return {
          ...prev,
          [questionIndex]: option
        };
      }
    });
  };

  const handleSubmitAnswers = async () => {
    // Build response text from selected answers
    const answerText = currentQuestions
      .map((q, i) => {
        const answer = selectedAnswers[i];
        if (!answer) return null;
        // Handle both single and multi-select
        const answerText = Array.isArray(answer) ? answer.join(', ') : answer;
        return `${q.question} ${answerText}`;
      })
      .filter(Boolean)
      .join('\n');

    if (!answerText) return;

    await handleSend(null, answerText);
  };

  const handleFinishAndGenerateSummary = async () => {
    setLoading(true);
    setError(null);

    try {
      // Step 1: Generate concise summary
      const summaryRequest = {
        role: 'user',
        content: 'Based on our conversation, please provide a brief 2-3 sentence summary of the refined idea.'
      };

      const summaryMessages = [...messages, summaryRequest];
      const summaryResponse = await api.chatWithAI(summaryMessages, {
        provider,
        systemPrompt: 'You are a helpful assistant. Respond with plain text, not JSON.'
      });

      // Step 2: Generate detailed design document with diagrams
      const designRequest = {
        role: 'user',
        content: `Now create a detailed MVP design document in markdown format including:

1. **Overview** - What problem does this solve?
2. **Target Users** - Who will use this?
3. **Core Features** - List the MVP features
4. **Architecture** - Include a Mermaid architecture diagram showing main components
5. **User Flow** - Include a Mermaid flowchart showing the main user journey
6. **Tech Stack** - Recommended technologies and why
7. **Data Model** - Key entities and relationships (Mermaid ER diagram if relevant)
8. **Next Steps** - What to build first

Use Mermaid syntax for all diagrams (wrap in \`\`\`mermaid code blocks).`
      };

      const designMessages = [...summaryMessages, { role: 'assistant', content: summaryResponse.message }, designRequest];
      const designResponse = await api.chatWithAI(designMessages, {
        provider,
        systemPrompt: 'You are a technical architect. Create detailed design documents in markdown format with Mermaid diagrams. Respond with plain markdown, not JSON.'
      });

      const finalMessages = [
        ...designMessages,
        { role: 'assistant', content: designResponse.message }
      ];

      // Save with both summary and design document
      await api.saveRefinedIdea(idea.id, finalMessages, {
        summary: summaryResponse.message,
        designDocument: designResponse.message,
        status: 'refined'
      });

      // Close the modal
      onClose();
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
      <div className="glass rounded-3xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold">Refine Idea with AI</h2>
            <p className="text-gray-400 text-sm mt-1">{idea.title}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="glass px-3 py-2 rounded-lg text-sm hover:bg-white/5 transition-all"
            >
              {showHistory ? '💬 Chat' : '📋 History'}
            </button>
            {providers && (
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="glass px-3 py-2 rounded-lg text-sm"
                disabled={loading}
              >
                {Object.entries(providers).map(([key, p]) => (
                  <option key={key} value={key} disabled={!p.available}>
                    {p.name} {!p.available && '(Not configured)'}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl glass hover:bg-white/5 flex items-center justify-center transition-all"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <ProgressBar progress={progress} currentPhase={currentPhase} />

        {/* Messages or History View */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {showHistory ? (
            // History View - Full conversation log
            <div className="space-y-3">
              <h3 className="text-lg font-semibold mb-4">Conversation History</h3>
              {messages.map((msg, i) => (
                <div key={i} className="glass rounded-xl p-4">
                  <div className="text-xs text-gray-400 mb-2">{msg.role === 'user' ? 'You' : 'AI'}</div>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              ))}
            </div>
          ) : (
            // Normal Chat View
            <>
              {messages.map((msg, i) => (
                <div key={i} className="space-y-3">
                  <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                        msg.role === 'user'
                          ? 'bg-gradient-primary text-white'
                          : 'glass'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  </div>
                </div>
              ))}

          {/* Quick reply questions with options (shown after last assistant message) */}
          {currentQuestions.length > 0 && !loading && (
            <div className="space-y-4 pl-4">
              {currentQuestions.map((q, qi) => {
                const multiSelect = q.multiSelect || false;
                return (
                  <div key={qi} className="glass rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="text-sm font-medium text-gray-300">{q.question}</div>
                      {multiSelect && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent">
                          Multi-select
                        </span>
                      )}
                      <button
                        onClick={() => handleSelectOption(qi, null, true)}
                        className="ml-auto text-xs text-gray-400 hover:text-accent transition-colors"
                        title={multiSelect ? "Single select mode" : "Multi-select mode"}
                      >
                        {multiSelect ? '◉ Multi' : '○ Single'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {q.options?.map((option, oi) => {
                        const answer = selectedAnswers[qi];
                        const isSelected = multiSelect
                          ? Array.isArray(answer) && answer.includes(option)
                          : answer === option;
                        return (
                          <button
                            key={oi}
                            onClick={() => handleSelectOption(qi, option, multiSelect)}
                            className={`px-4 py-2 rounded-full text-sm border transition-all ${
                              isSelected
                                ? 'bg-primary text-white border-primary shadow-lg shadow-primary/40'
                                : 'bg-primary/10 hover:bg-primary/20 hover:border-primary border-primary/30'
                            }`}
                          >
                            {multiSelect && isSelected && '✓ '}
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

            </div>
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="glass px-4 py-3 rounded-2xl">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
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
            </>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="p-6 border-t border-white/10 flex flex-col gap-3 flex-shrink-0">
          {currentQuestions.length > 0 && Object.keys(selectedAnswers).length > 0 && (
            <div className="text-xs text-gray-400 text-center">
              Quick replies selected. Click Continue or type your own response below.
            </div>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={toggleVoiceInput}
              disabled={loading}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'glass hover:bg-white/5'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={isListening ? 'Listening...' : 'Voice input'}
            >
              {isListening ? '🎙️' : '🎤'}
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isListening ? 'Listening...' : currentQuestions.length > 0 ? 'Click options above or type your own answer...' : 'Type your message...'}
              className="input flex-1"
              disabled={loading || isListening}
            />
            <button
              type="submit"
              disabled={loading || (!input.trim() && Object.keys(selectedAnswers).length === 0)}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed min-w-[80px]"
            >
              {loading ? '...' : 'Send'}
            </button>
            {isComplete && (
              <button
                type="button"
                onClick={handleFinishAndGenerateSummary}
                disabled={loading}
                className="btn-primary bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed min-w-[140px]"
                title="Generate final summary and finish"
              >
                ✓ Finish & Summarize
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
