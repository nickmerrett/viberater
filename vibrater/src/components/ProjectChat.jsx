import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useDataStore } from '../store/useDataStore';

export default function ProjectChat({ project, onClose }) {
  const [messages, setMessages] = useState([]);
  const [currentQuestions, setCurrentQuestions] = useState([]);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [provider, setProvider] = useState('claude');
  const [providers, setProviders] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [suggestedTasks, setSuggestedTasks] = useState([]);
  const [approvedPhases, setApprovedPhases] = useState([]);
  const [editingTask, setEditingTask] = useState(null);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const { createTask, fetchProjectTasks } = useDataStore();

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

    const systemPrompt = `You are a DECISIVE project assistant. You MAKE DECISIONS and PROPOSE CONCRETE PLANS. You do NOT ask questions.

CRITICAL - DO NOT ASK QUESTIONS:
❌ WRONG: "What features do you want?"
❌ WRONG: "Which approach would you prefer?"
❌ WRONG: "Should we use React or Vue?"
✅ RIGHT: "Phase 1 - Setup: I'll set up React with Vite and TailwindCSS. Tasks: 1) npx create-vite, 2) Install Tailwind, 3) Configure routing"

YOU ARE DECISIVE - YOU TELL THEM THE PLAN:
- Analyze the project context
- DECIDE on the best approach yourself
- PROPOSE specific tasks with time estimates
- Present ONE phase at a time
- Give them options to MODIFY your decision, not to answer questions

RESPONSE FORMAT - CRITICAL:
You MUST respond with ONLY valid JSON. NO extra text before or after.
The JSON MUST have exactly this structure:
{
  "message": "Phase [N] - [Name]: [Your DECISION/PLAN]\n\n**Tasks:**\n• [specific task with time]\n• [task with time]\n• [task with time]",
  "questions": [
    {
      "question": "Approve Phase [N]?",
      "options": ["Approved, continue", "Add [specific thing]", "Use [alternative]", "Skip this phase"],
      "multiSelect": false
    }
  ]
}

CRITICAL REQUIREMENTS:
- The "message" field is what the user sees
- Format tasks as bullet points using • character
- Do NOT wrap in markdown code blocks
- Do NOT add any text outside the JSON object

REAL EXAMPLES OF GOOD RESPONSES:

Example 1:
{
  "message": "Phase 1 - Database Setup: I'm setting up PostgreSQL with Prisma ORM.\n\n**Tasks:**\n• Install PostgreSQL & Prisma (20min)\n• Create schema for users/posts (30min)\n• Set up migrations (15min)",
  "questions": [{
    "question": "Approve database setup?",
    "options": ["Yes, continue to Phase 2", "Use MongoDB instead", "Add Redis cache", "Skip database"],
    "multiSelect": false
  }]
}

Example 2:
{
  "message": "Phase 2 - API Endpoints: Building RESTful API with Express.\n\n**Tasks:**\n• CRUD for users (2h)\n• CRUD for posts (2h)\n• Authentication middleware (1.5h)\n• Input validation (1h)",
  "questions": [{
    "question": "Move to Phase 3?",
    "options": ["Approved, next phase", "Add GraphQL", "Simplify to fewer endpoints", "Skip to frontend"],
    "multiSelect": false
  }]
}

NEVER DO THIS:
❌ "What database would you like to use?"
❌ "Should we add authentication?"
❌ "Which features are most important?"

ALWAYS DO THIS:
✅ Make a decision based on the project context
✅ Present your plan clearly
✅ Give them options to modify YOUR plan`;

    const projectContext = `
**Project:** ${project.title}
**Description:** ${project.description}
**Status:** ${project.status}
${project.tech_stack?.length > 0 ? `\n**Tech Stack:** ${project.tech_stack.join(', ')}` : ''}
${project.project_plan?.goals?.length > 0 ? `\n**Goals:**\n${project.project_plan.goals.map(g => `- ${g}`).join('\n')}` : ''}
${project.project_plan?.phases?.length > 0 ? `\n**Phases:**\n${project.project_plan.phases.map(p => `- ${p.name}: ${p.description}`).join('\n')}` : ''}
`.trim();

    const userPrompt = `I'm working on this project:\n\n${projectContext}\n\nBreak this down into phases/sections. Start with Phase 1 only - suggest specific tasks for the first phase. We'll go phase by phase.`;

    try {
      const response = await api.chatWithAI([
        { role: 'user', content: userPrompt }
      ], { provider, systemPrompt });

      // Ensure we have a valid message, not raw JSON
      let displayMessage = response.message;
      if (!displayMessage || displayMessage.trim().startsWith('{')) {
        // Fallback if we got JSON instead of a message
        displayMessage = "I've analyzed your project. Let's start planning!";
      }

      setMessages([
        { role: 'user', content: userPrompt },
        { role: 'assistant', content: displayMessage }
      ]);
      setCurrentQuestions(response.questions || []);
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

    const systemPrompt = `You are a DECISIVE project assistant. MAKE DECISIONS. DO NOT ASK QUESTIONS.

CRITICAL RULES:
1. NEVER ask "what do you want" or "which approach" - YOU DECIDE
2. Look at conversation history - user just approved a phase or made a modification
3. Present the NEXT phase with YOUR decision on what to do
4. Give them options to MODIFY, not to answer questions

WHAT TO DO BASED ON USER INPUT:

If user said "Approved, continue" or "Yes, next phase":
→ Present the NEXT numbered phase with specific tasks

If user said "Add [something]":
→ Update the CURRENT phase to include that thing

If user said "Use [alternative]":
→ Update the CURRENT phase with the alternative approach

If user said "Skip":
→ Jump to the next phase

RESPONSE FORMAT - CRITICAL:
You MUST respond with ONLY valid JSON. The JSON MUST have exactly this structure:
{
  "message": "Phase [N] - [Name]: [YOUR DECISION]\n\n**Tasks:**\n• [task with time]\n• [task with time]\n• [task with time]",
  "questions": [{
    "question": "Approve Phase [N]?",
    "options": ["Approved, continue", "Add [specific]", "Use [alternative]", "Skip"],
    "multiSelect": false
  }]
}

CRITICAL REQUIREMENTS:
- The "message" field contains the text shown to user
- Format tasks as bullet points using • character
- Include BOTH "message" and "questions" fields
- Do NOT wrap in markdown code blocks
- Do NOT add explanatory text outside JSON

CRITICAL - EXAMPLES OF WRONG vs RIGHT:

❌ WRONG:
{
  "message": "What authentication method would you like to use?",
  "questions": [{
    "question": "Choose auth method",
    "options": ["JWT", "Sessions", "OAuth", "Other"]
  }]
}

✅ RIGHT:
{
  "message": "Phase 2 - Authentication: Using JWT with refresh tokens.\n\n**Tasks:**\n• Login endpoint (1.5h)\n• Token middleware (1h)\n• Refresh mechanism (1h)",
  "questions": [{
    "question": "Approve authentication phase?",
    "options": ["Approved, continue", "Add OAuth", "Use sessions instead", "Skip auth"],
    "multiSelect": false
  }]
}

REMEMBER:
- YOU make the decision
- USER approves or modifies
- Move sequentially: Phase 1 → Phase 2 → Phase 3 → etc.`;

    try {
      const response = await api.chatWithAI(newMessages, { provider, systemPrompt });

      // Ensure we have a valid message, not raw JSON
      let displayMessage = response.message;
      if (!displayMessage || displayMessage.trim().startsWith('{')) {
        // Fallback if we got JSON instead of a message
        displayMessage = "Let me continue with the next phase...";
      }

      setMessages([...newMessages, { role: 'assistant', content: displayMessage }]);
      setCurrentQuestions(response.questions || []);

      // Track approved phases and auto-generate tasks
      const userInput = combinedText.toLowerCase();
      if (userInput.includes('approved') || userInput.includes('yes') || userInput.includes('continue') || userInput.includes('looks good')) {
        // Extract phase info from the current response
        if (displayMessage.includes('Phase')) {
          setApprovedPhases(prev => [...prev, displayMessage]);

          // Auto-extract tasks from this phase
          extractTasksFromPhase(displayMessage);
        }
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
        const current = prev[questionIndex] || [];
        const isSelected = current.includes(option);
        return {
          ...prev,
          [questionIndex]: isSelected
            ? current.filter(o => o !== option)
            : [...current, option]
        };
      } else {
        return {
          ...prev,
          [questionIndex]: option
        };
      }
    });
  };

  const extractTasksFromPhase = (phaseContent) => {
    // Extract phase name
    const phaseMatch = phaseContent.match(/Phase\s+(\d+)\s*-\s*([^:\n]+)/);
    const phaseName = phaseMatch ? phaseMatch[2].trim() : 'Unknown Phase';

    // Extract all bullet points
    const bulletRegex = /•\s*([^\n]+)/g;
    const bullets = [...phaseContent.matchAll(bulletRegex)];

    if (bullets.length === 0) return;

    // Convert each bullet to a task
    const newTasks = bullets.map(match => {
      const taskText = match[1].trim();

      // Extract time estimate (e.g., "2h", "30min", "1.5h")
      const timeMatch = taskText.match(/\(([^)]+)\)/);
      let estimatedMinutes = 60; // default

      if (timeMatch) {
        const timeStr = timeMatch[1];
        if (timeStr.includes('h')) {
          const hours = parseFloat(timeStr);
          estimatedMinutes = Math.round(hours * 60);
        } else if (timeStr.includes('min')) {
          estimatedMinutes = parseInt(timeStr);
        }
      }

      // Remove time estimate from title
      const title = taskText.replace(/\s*\([^)]+\)\s*$/, '').trim();

      // Determine priority based on phase or keywords
      let priority = 'medium';
      if (phaseName.toLowerCase().includes('setup') || phaseName.toLowerCase().includes('foundation')) {
        priority = 'high';
      } else if (phaseName.toLowerCase().includes('polish') || phaseName.toLowerCase().includes('optional')) {
        priority = 'low';
      }

      return {
        title,
        description: `${phaseName}: ${title}`,
        priority,
        estimatedMinutes
      };
    });

    // Add to suggested tasks
    setSuggestedTasks(prev => [...prev, ...newTasks]);
  };

  const handleGenerateTasks = async () => {
    setLoading(true);
    setError(null);

    try {
      // Compile all approved phases
      const phasesSummary = approvedPhases.length > 0
        ? approvedPhases.join('\n\n')
        : messages.filter(m => m.role === 'assistant').map(m => m.content).join('\n\n');

      const taskRequest = {
        role: 'user',
        content: `Based on ALL the phases we discussed, extract EVERY bullet point as a separate task. Here are the phases:

${phasesSummary}

Convert each bullet point (•) into a task. Parse the time estimate from the bullet point text. Format as JSON:
[
  {
    "title": "task title from bullet point",
    "description": "Phase name + what this task involves",
    "priority": "high|medium|low",
    "estimatedMinutes": [convert time from bullet to minutes, e.g., "2h" = 120, "30min" = 30]
  },
  ...
]

Extract ALL tasks from ALL phases. Only respond with valid JSON array, nothing else.`
      };

      const taskMessages = [...messages, taskRequest];
      const response = await api.chatWithAI(taskMessages, {
        provider,
        systemPrompt: 'You are a task extraction assistant. Extract EVERY bullet point from the phases as a separate task. Respond ONLY with valid JSON array. No markdown, no explanations, just the JSON array.'
      });

      // Parse the AI response as JSON
      let tasks;
      try {
        const jsonMatch = response.message.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : response.message;
        tasks = JSON.parse(jsonStr.trim());
      } catch (parseError) {
        console.error('Failed to parse tasks JSON:', parseError);
        throw new Error('AI returned invalid task format. Please try again.');
      }

      setSuggestedTasks(tasks);

      setMessages([
        ...taskMessages,
        { role: 'assistant', content: `I've extracted ${tasks.length} tasks from all approved phases. Review them on the right and add them to your project.` }
      ]);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = async (task) => {
    try {
      await createTask(project.id, task);
      setSuggestedTasks(prev => prev.filter(t => t !== task));
      await fetchProjectTasks(project.id);
    } catch (error) {
      alert('Failed to add task');
    }
  };

  const handleAddAllTasks = async () => {
    setLoading(true);
    try {
      for (const task of suggestedTasks) {
        await createTask(project.id, task);
      }
      setSuggestedTasks([]);
      await fetchProjectTasks(project.id);
      alert(`Added ${suggestedTasks.length} tasks to your project!`);
    } catch (error) {
      alert('Failed to add some tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleEditTask = (taskIndex) => {
    setEditingTask({ index: taskIndex, task: { ...suggestedTasks[taskIndex] } });
  };

  const handleSaveEdit = () => {
    if (!editingTask) return;

    setSuggestedTasks(prev =>
      prev.map((task, i) => i === editingTask.index ? editingTask.task : task)
    );
    setEditingTask(null);
  };

  const handleCancelEdit = () => {
    setEditingTask(null);
  };

  const handleDeleteTask = (taskIndex) => {
    setSuggestedTasks(prev => prev.filter((_, i) => i !== taskIndex));
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
      <div className="glass rounded-3xl w-full max-w-7xl h-[85vh] flex overflow-hidden">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col border-r border-white/10">
          {/* Header */}
          <div className="p-6 border-b border-white/10 flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="text-2xl font-bold">AI Project Assistant</h2>
              <p className="text-gray-400 text-sm mt-1">"{project.title}"</p>
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
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-gradient-primary text-white'
                      : 'glass'
                  }`}
                >
                  <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                </div>
              </div>
            ))}

            {/* Quick reply questions with options */}
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
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="p-6 border-t border-white/10 flex-shrink-0">
            {currentQuestions.length > 0 && Object.keys(selectedAnswers).length > 0 && (
              <div className="text-xs text-gray-400 text-center mb-2">
                Quick replies selected. Click Send or type your own response below.
              </div>
            )}
            <div className="flex gap-3 mb-3">
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
                placeholder={isListening ? 'Listening...' : currentQuestions.length > 0 ? 'Click options above or type your own...' : 'Ask about tasks, architecture, implementation...'}
                className="input flex-1"
                disabled={loading || isListening}
              />
              <button
                type="submit"
                disabled={loading || (!input.trim() && Object.keys(selectedAnswers).length === 0)}
                className="btn-primary disabled:opacity-50 min-w-[80px]"
              >
                {loading ? '...' : 'Send'}
              </button>
            </div>
            {suggestedTasks.length === 0 && messages.length >= 4 && (
              <button
                type="button"
                onClick={handleGenerateTasks}
                disabled={loading}
                className="btn-primary w-full disabled:opacity-50"
              >
                ✨ Generate Task Suggestions
              </button>
            )}
          </form>
        </div>

        {/* Suggested Tasks Sidebar */}
        <div className="w-96 bg-black/20 flex flex-col">
          <div className="p-6 border-b border-white/10">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              📋 Suggested Tasks
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              {suggestedTasks.length > 0 ? 'AI-generated from your conversation' : 'Discuss your project to get task suggestions'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {suggestedTasks.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-8">
                <p>No suggestions yet</p>
                <p className="text-xs mt-2">Approve phases to build your task list</p>
              </div>
            ) : (
              suggestedTasks.map((task, i) => (
                <div key={i} className="glass rounded-lg p-3">
                  {editingTask?.index === i ? (
                    // Edit mode
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editingTask.task.title}
                        onChange={(e) => setEditingTask({
                          ...editingTask,
                          task: { ...editingTask.task, title: e.target.value }
                        })}
                        className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 text-sm"
                        placeholder="Task title"
                      />
                      <textarea
                        value={editingTask.task.description}
                        onChange={(e) => setEditingTask({
                          ...editingTask,
                          task: { ...editingTask.task, description: e.target.value }
                        })}
                        className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 text-xs min-h-[60px]"
                        placeholder="Description"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={editingTask.task.priority}
                          onChange={(e) => setEditingTask({
                            ...editingTask,
                            task: { ...editingTask.task, priority: e.target.value }
                          })}
                          className="bg-black/20 border border-white/10 rounded px-2 py-1 text-xs"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                        <input
                          type="number"
                          value={editingTask.task.estimatedMinutes}
                          onChange={(e) => setEditingTask({
                            ...editingTask,
                            task: { ...editingTask.task, estimatedMinutes: parseInt(e.target.value) }
                          })}
                          className="bg-black/20 border border-white/10 rounded px-2 py-1 text-xs"
                          placeholder="Minutes"
                          min="1"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveEdit}
                          className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded px-2 py-1 text-xs"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="flex-1 glass hover:bg-white/5 rounded px-2 py-1 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <>
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-sm font-medium flex-1">{task.title}</h4>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEditTask(i)}
                            className="text-blue-400 hover:text-blue-300 transition-colors text-sm px-1"
                            title="Edit task"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteTask(i)}
                            className="text-red-400 hover:text-red-300 transition-colors text-sm px-1"
                            title="Delete task"
                          >
                            🗑️
                          </button>
                          <button
                            onClick={() => handleAddTask(task)}
                            className="text-green-400 hover:text-green-300 transition-colors text-xl leading-none"
                            title="Add to project"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mb-2">{task.description}</p>
                      <div className="flex gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          task.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                          task.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {task.priority}
                        </span>
                        {task.estimatedMinutes && (
                          <span className="text-xs text-gray-400">~{task.estimatedMinutes}min</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          {suggestedTasks.length > 0 && (
            <div className="p-6 border-t border-white/10 space-y-3">
              <button
                onClick={handleAddAllTasks}
                disabled={loading}
                className="btn-primary w-full disabled:opacity-50"
              >
                ✓ Add All Tasks ({suggestedTasks.length})
              </button>
              <button
                onClick={() => setSuggestedTasks([])}
                className="glass w-full px-4 py-2 rounded-lg hover:bg-white/5 transition-all text-sm"
              >
                Clear Suggestions
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
