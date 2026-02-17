import { useState, useEffect, useRef } from 'react';
import { useDataStore } from '../store/useDataStore';
import AIChat from './AIChat';
import BrainstormChat from './BrainstormChat';
import PromoteChat from './PromoteChat';
import DesignDocument from './DesignDocument';

export default function IdeasView() {
  const { ideas, fetchIdeas, createIdea, promoteIdea, deleteIdea, updateIdea, loading } = useDataStore();
  const [filter, setFilter] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [sortBy, setSortBy] = useState('newest');
  const [showNewIdea, setShowNewIdea] = useState(false);
  const [refiningIdea, setRefiningIdea] = useState(null);
  const [viewingIdea, setViewingIdea] = useState(null);
  const [editingTitleId, setEditingTitleId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingTagsId, setEditingTagsId] = useState(null);
  const [editingTagsInput, setEditingTagsInput] = useState('');
  const [ideatingFromIdea, setIdeatingFromIdea] = useState(null);
  const [showIdeation, setShowIdeation] = useState(false);
  const [promotingIdea, setPromotingIdea] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const [tagsInput, setTagsInput] = useState('');
  const [newIdea, setNewIdea] = useState({
    title: '',
    summary: '',
    vibe: [],
    tags: [],
    excitement: 5,
    complexity: 'weekend',
    techStack: []
  });

  useEffect(() => {
    fetchIdeas();
  }, [fetchIdeas]);

  const startRecording = async () => {
    console.log('[Voice] Starting audio recording...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      audioChunksRef.current = [];
      mediaRecorderRef.current = new MediaRecorder(stream);

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.start();
      setIsListening(true);
      console.log('[Voice] Recording started');
    } catch (error) {
      console.error('[Voice] Failed to start recording:', error);
      alert('Failed to access microphone: ' + error.message);
    }
  };

  const stopRecording = async () => {
    console.log('[Voice] Stopping recording...');

    if (!mediaRecorderRef.current || !isListening) {
      console.log('[Voice] Not recording');
      return;
    }

    return new Promise((resolve) => {
      mediaRecorderRef.current.onstop = async () => {
        console.log('[Voice] Recording stopped');
        setIsListening(false);
        setIsProcessingVoice(true);

        // Stop the media stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }

        try {
          // Create audio blob
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          console.log('[Voice] Audio blob size:', audioBlob.size);

          // Convert to base64
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = reader.result.split(',')[1];

            console.log('[Voice] Sending to Claude for transcription...');

            // Send to backend which will call Claude
            const response = await fetch('/api/ai/transcribe', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('viberater_access_token')}`
              },
              body: JSON.stringify({
                audio: base64Audio,
                mimeType: 'audio/webm'
              })
            });

            const data = await response.json();
            console.log('[Voice] Transcription response:', data);

            if (data.title && data.summary) {
              setNewIdea(prev => ({
                ...prev,
                title: data.title,
                summary: data.summary,
                tags: data.tags || []
              }));
              setTagsInput((data.tags || []).join(', '));
            } else {
              alert('Failed to process audio. Please try again.');
            }

            setIsProcessingVoice(false);
            resolve();
          };
        } catch (error) {
          console.error('[Voice] Failed to process audio:', error);
          alert('Failed to process audio: ' + error.message);
          setIsProcessingVoice(false);
          resolve();
        }
      };

      mediaRecorderRef.current.stop();
    });
  };

  // Get all unique tags from all ideas
  const allTags = [...new Set(ideas.flatMap(idea => idea.tags || []))].sort();

  const filteredIdeas = ideas.filter(idea => {
    // Filter by archive status
    if (filter === 'active' && idea.archived) return false;
    if (filter === 'archived' && !idea.archived) return false;
    if (filter === 'refined' && idea.status !== 'refined') return false;
    if (filter === 'promoted' && idea.status !== 'promoted-to-project') return false;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = idea.title?.toLowerCase().includes(query);
      const matchesSummary = idea.summary?.toLowerCase().includes(query);
      const matchesTags = idea.tags?.some(tag => tag.toLowerCase().includes(query));
      if (!matchesTitle && !matchesSummary && !matchesTags) return false;
    }

    // Tag filter
    if (selectedTags.length > 0) {
      const hasAllTags = selectedTags.every(tag => idea.tags?.includes(tag));
      if (!hasAllTags) return false;
    }

    return true;
  });

  // Sort ideas
  const sortedIdeas = [...filteredIdeas].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.created_at) - new Date(a.created_at);
      case 'oldest':
        return new Date(a.created_at) - new Date(b.created_at);
      case 'excitement':
        return (b.excitement || 0) - (a.excitement || 0);
      case 'updated':
        return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
      default:
        return 0;
    }
  });

  const handleCreateIdea = async (e) => {
    e.preventDefault();
    try {
      // Parse tags from input string before submitting
      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      await createIdea({ ...newIdea, tags });
      setShowNewIdea(false);
      setNewIdea({
        title: '',
        summary: '',
        vibe: [],
        tags: [],
        excitement: 5,
        complexity: 'weekend',
        techStack: []
      });
      setTagsInput('');
    } catch (error) {
      console.error('Failed to create idea:', error);
    }
  };

  const handlePromote = async (id) => {
    const idea = ideas.find(i => i.id === id);
    setPromotingIdea(idea);
  };

  const handlePromoteWithPlan = async (id, projectPlan) => {
    try {
      await promoteIdea(id, projectPlan);
      alert('Idea promoted to project with AI-generated plan!');
    } catch (error) {
      alert('Failed to promote idea');
      throw error;
    }
  };

  const startEditingTitle = (idea) => {
    setEditingTitleId(idea.id);
    setEditingTitle(idea.title);
  };

  const saveTitle = async (id) => {
    if (!editingTitle.trim()) return;
    try {
      await updateIdea(id, { title: editingTitle.trim() });
      setEditingTitleId(null);
      setEditingTitle('');
    } catch (error) {
      alert('Failed to update title');
    }
  };

  const cancelEditingTitle = () => {
    setEditingTitleId(null);
    setEditingTitle('');
  };

  const startEditingTags = (idea) => {
    setEditingTagsId(idea.id);
    setEditingTagsInput((idea.tags || []).join(', '));
  };

  const saveTags = async (id) => {
    try {
      const tags = editingTagsInput.split(',').map(t => t.trim()).filter(Boolean);
      await updateIdea(id, { tags });
      if (viewingIdea && viewingIdea.id === id) {
        setViewingIdea({ ...viewingIdea, tags });
      }
      setEditingTagsId(null);
      setEditingTagsInput('');
    } catch (error) {
      alert('Failed to update tags');
    }
  };

  const cancelEditingTags = () => {
    setEditingTagsId(null);
    setEditingTagsInput('');
  };

  const handleArchive = async (id, archived) => {
    try {
      await updateIdea(id, { archived });
    } catch (error) {
      alert('Failed to archive idea');
    }
  };

  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const exportAsMarkdown = (idea) => {
    let markdown = `# ${idea.title}\n\n`;

    // Add refined summary if available
    if (idea.status === 'refined' && idea.summary) {
      markdown += `## AI-Refined Summary\n\n${idea.summary}\n\n`;
    } else {
      markdown += `## Summary\n\n${idea.summary}\n\n`;
    }

    // Add design document if available
    if (idea.design_document) {
      markdown += `---\n\n${idea.design_document}\n\n`;
    }

    // Add metadata
    if (idea.excitement || idea.complexity) {
      markdown += `## Metadata\n\n`;
      if (idea.excitement) markdown += `- **Excitement:** ${idea.excitement}/10\n`;
      if (idea.complexity) markdown += `- **Complexity:** ${idea.complexity}\n`;
      if (idea.vibe && idea.vibe.length > 0) {
        markdown += `- **Vibe:** ${idea.vibe.join(', ')}\n`;
      }
      markdown += '\n';
    }

    // Add conversation history
    if (idea.conversation) {
      markdown += `---\n\n## Conversation History\n\n`;
      const messages = typeof idea.conversation === 'string'
        ? JSON.parse(idea.conversation)
        : idea.conversation;
      messages.forEach(msg => {
        const speaker = msg.role === 'user' ? 'You' : 'AI Assistant';
        markdown += `### ${speaker}\n\n${msg.content}\n\n`;
      });
    }

    return markdown;
  };

  const handleExport = (idea) => {
    const markdown = exportAsMarkdown(idea);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${idea.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = (idea) => {
    const markdown = exportAsMarkdown(idea);
    navigator.clipboard.writeText(markdown).then(() => {
      alert('Idea copied to clipboard!');
    }).catch(() => {
      alert('Failed to copy to clipboard');
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Filter Bar */}
      <div className="glass border-b border-white/10 px-6 py-4 flex-shrink-0 space-y-3">
        <div className="flex items-center justify-between gap-4">
          {/* Search */}
          <div className="flex-1 max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 Search ideas, tags..."
              className="input w-full"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowIdeation(true)}
              className="glass px-4 py-2 rounded-lg hover:bg-accent/20 hover:text-accent transition-all text-sm font-medium"
            >
              💭 Brainstorm
            </button>
            <button
              onClick={() => setShowNewIdea(true)}
              className="btn-primary btn-sm"
            >
              + New Idea
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="glass px-3 py-2 rounded-lg text-sm"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="updated">Recently Updated</option>
            <option value="excitement">Most Exciting</option>
          </select>

          {/* Status Filters */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('active')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                filter === 'active'
                  ? 'bg-gradient-primary text-white shadow-lg shadow-primary/40'
                  : 'glass hover:bg-white/5'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setFilter('refined')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                filter === 'refined'
                  ? 'bg-gradient-primary text-white shadow-lg shadow-primary/40'
                  : 'glass hover:bg-white/5'
              }`}
            >
              ✨ Refined
            </button>
            <button
              onClick={() => setFilter('promoted')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                filter === 'promoted'
                  ? 'bg-gradient-primary text-white shadow-lg shadow-primary/40'
                  : 'glass hover:bg-white/5'
              }`}
            >
              🚀 Promoted
            </button>
            <button
              onClick={() => setFilter('archived')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                filter === 'archived'
                  ? 'bg-gradient-primary text-white shadow-lg shadow-primary/40'
                  : 'glass hover:bg-white/5'
              }`}
            >
              📦 Archived
            </button>
          </div>

          {/* Tag Filters */}
          {allTags.length > 0 && (
            <div className="flex gap-2 flex-1 overflow-x-auto">
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                    selectedTags.includes(tag)
                      ? 'bg-accent text-white'
                      : 'glass hover:bg-white/5'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Active Filters Display */}
        {(searchQuery || selectedTags.length > 0) && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>Filtering:</span>
            {searchQuery && <span className="glass px-2 py-1 rounded">"{searchQuery}"</span>}
            {selectedTags.map(tag => (
              <span key={tag} className="glass px-2 py-1 rounded flex items-center gap-1">
                #{tag}
                <button onClick={() => toggleTag(tag)} className="hover:text-red-400">✕</button>
              </span>
            ))}
            <button
              onClick={() => { setSearchQuery(''); setSelectedTags([]); }}
              className="ml-auto text-accent hover:text-accent/80"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Ideas List */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading ideas...</div>
        ) : sortedIdeas.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            No ideas yet. Create your first one!
          </div>
        ) : (
          <div className="grid gap-4 max-w-4xl mx-auto">
            {sortedIdeas.map((idea) => (
              <div key={idea.id} className="card">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    {editingTitleId === idea.id ? (
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveTitle(idea.id);
                            if (e.key === 'Escape') cancelEditingTitle();
                          }}
                          className="input text-xl font-semibold flex-1"
                          autoFocus
                        />
                        <button
                          onClick={() => saveTitle(idea.id)}
                          className="px-3 py-1 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-all"
                        >
                          ✓
                        </button>
                        <button
                          onClick={cancelEditingTitle}
                          className="px-3 py-1 rounded-lg glass hover:bg-red-500/20 hover:text-red-400 transition-all"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <h3
                        className="text-xl font-semibold cursor-pointer hover:text-accent transition-colors"
                        onClick={() => startEditingTitle(idea)}
                        title="Click to edit title"
                      >
                        {idea.title}
                      </h3>
                    )}
                    {idea.status === 'refined' && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-accent/20 text-accent text-xs rounded-full">
                        ✨ AI Refined
                      </span>
                    )}
                  </div>
                  <span className="text-2xl">{idea.status === 'promoted-to-project' ? '🚀' : '💡'}</span>
                </div>

                <p className="text-gray-400 mb-4">{idea.summary}</p>

                {/* Tags */}
                {idea.tags && idea.tags.length > 0 && (
                  <div className="flex gap-2 mb-3 flex-wrap">
                    {idea.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-full text-xs bg-accent/20 text-accent cursor-pointer hover:bg-accent/30"
                        onClick={() => toggleTag(tag)}
                        title="Click to filter by this tag"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Vibe */}
                {idea.vibe && idea.vibe.length > 0 && (
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {idea.vibe.map((v, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 rounded-full text-sm glass"
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between text-sm text-gray-400 gap-2">
                  <div className="flex gap-4 flex-wrap">
                    <span>⚡ {idea.excitement}/10</span>
                    <span>⏱️ {idea.complexity}</span>
                    {idea.created_at && (
                      <span title={new Date(idea.created_at).toLocaleString()}>
                        📅 {new Date(idea.created_at).toLocaleDateString()}
                      </span>
                    )}
                    {((idea.related_ideas && idea.related_ideas.length > 0) || idea.parent_idea_id) && (
                      <span
                        className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs"
                        title={`${idea.parent_idea_id ? '1 parent, ' : ''}${idea.related_ideas?.length || 0} linked ideas`}
                      >
                        🔗 {(idea.parent_idea_id ? 1 : 0) + (idea.related_ideas?.length || 0)}
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setViewingIdea(idea)}
                      className="px-3 py-1 rounded-lg glass hover:bg-blue-500/20 hover:text-blue-400 transition-all"
                    >
                      📖 View
                    </button>
                    {!idea.archived && (
                      <>
                        <button
                          onClick={() => setIdeatingFromIdea(idea)}
                          className="px-3 py-1 rounded-lg glass hover:bg-purple-500/20 hover:text-purple-400 transition-all"
                          title="Riff on this idea with AI"
                        >
                          💭 Riff
                        </button>
                        {idea.status !== 'promoted-to-project' && (
                          <>
                            <button
                              onClick={() => setRefiningIdea(idea)}
                              className="px-3 py-1 rounded-lg glass hover:bg-accent/20 hover:text-accent transition-all"
                            >
                              🤖 {idea.status === 'refined' ? 'Continue' : 'Refine'}
                            </button>
                            <button
                              onClick={() => handlePromote(idea.id)}
                              className="px-3 py-1 rounded-lg glass hover:bg-primary/20 hover:text-primary transition-all"
                            >
                              Promote
                            </button>
                          </>
                        )}
                      </>
                    )}
                    <button
                      onClick={() => handleArchive(idea.id, !idea.archived)}
                      className={`px-3 py-1 rounded-lg glass transition-all ${
                        idea.archived
                          ? 'hover:bg-green-500/20 hover:text-green-400'
                          : 'hover:bg-orange-500/20 hover:text-orange-400'
                      }`}
                    >
                      {idea.archived ? '📤 Unarchive' : '📦 Archive'}
                    </button>
                    {idea.archived && (
                      <button
                        onClick={() => deleteIdea(idea.id)}
                        className="px-3 py-1 rounded-lg glass hover:bg-red-500/20 hover:text-red-400 transition-all"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Idea Modal */}
      {showNewIdea && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="glass rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">New Idea</h2>

            {/* Voice Input Button - Push to Talk */}
            <div className="mb-6">
              <button
                type="button"
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                disabled={isProcessingVoice}
                className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 text-lg font-medium transition-all ${
                  isListening
                    ? 'bg-red-500 text-white animate-pulse'
                    : isProcessingVoice
                    ? 'bg-gradient-primary text-white cursor-wait'
                    : 'glass hover:bg-primary/20 hover:text-primary'
                }`}
              >
                {isListening ? (
                  <>🎙️ Recording... (Release to Stop)</>
                ) : isProcessingVoice ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing with AI...
                  </>
                ) : (
                  <>🎤 Hold to Speak</>
                )}
              </button>
              <p className="text-xs text-gray-400 text-center mt-2">
                {isListening ? 'Keep holding while speaking...' : isProcessingVoice ? 'AI is extracting title and tags...' : 'Hold button down and speak your idea - AI will generate title & tags'}
              </p>
            </div>

            <div className="border-t border-white/10 pt-6 mb-4">
              <p className="text-sm text-gray-400 text-center">Or fill in manually:</p>
            </div>

            <form onSubmit={handleCreateIdea} className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2">Title</label>
                <input
                  type="text"
                  value={newIdea.title}
                  onChange={(e) => setNewIdea({ ...newIdea, title: e.target.value })}
                  className="input"
                  placeholder="What's your idea?"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Summary</label>
                <textarea
                  value={newIdea.summary}
                  onChange={(e) => setNewIdea({ ...newIdea, summary: e.target.value })}
                  className="input min-h-[100px]"
                  placeholder="Describe your idea..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Excitement (1-10)</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={newIdea.excitement}
                  onChange={(e) => setNewIdea({ ...newIdea, excitement: parseInt(e.target.value) })}
                  className="w-full"
                />
                <div className="text-center text-2xl mt-2">{newIdea.excitement}/10</div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Complexity</label>
                <select
                  value={newIdea.complexity}
                  onChange={(e) => setNewIdea({ ...newIdea, complexity: e.target.value })}
                  className="input"
                >
                  <option value="afternoon">Afternoon</option>
                  <option value="weekend">Weekend</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                  <option value="months">Months</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Tags (optional)</label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="input"
                  placeholder="web, mobile, ai, prototype"
                />
                <p className="text-xs text-gray-400 mt-1">Separate tags with commas</p>
                {tagsInput && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {tagsInput.split(',').map(t => t.trim()).filter(Boolean).map((tag, i) => (
                      <span key={i} className="px-2 py-1 bg-primary/20 text-primary rounded text-sm">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button type="submit" className="btn-primary flex-1">
                  Create Idea
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewIdea(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Chat Modal */}
      {refiningIdea && (
        <AIChat
          idea={refiningIdea}
          onClose={() => {
            setRefiningIdea(null);
            fetchIdeas(); // Refresh to show updated idea
          }}
        />
      )}

      {/* Idea Details Modal */}
      {viewingIdea && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="glass rounded-3xl w-full max-w-4xl h-[80vh] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-2xl font-bold">{viewingIdea.title}</h2>
                <p className="text-gray-400 text-sm mt-1">AI Refinement Details</p>
              </div>
              <button
                onClick={() => setViewingIdea(null)}
                className="w-10 h-10 rounded-xl glass hover:bg-white/5 flex items-center justify-center transition-all"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* AI-Generated Refined Summary */}
              {viewingIdea.status === 'refined' && viewingIdea.summary && (
                <div className="glass rounded-xl p-6 border-2 border-accent/30 bg-gradient-to-br from-accent/5 to-transparent">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <span>✨</span> AI-Refined Summary
                  </h3>
                  <div className="text-gray-200 whitespace-pre-wrap prose prose-invert max-w-none">
                    {viewingIdea.summary}
                  </div>
                </div>
              )}

              {/* Original Summary (if different or no refined version) */}
              {viewingIdea.status !== 'refined' && (
                <div className="glass rounded-xl p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <span>📋</span> Summary
                  </h3>
                  <p className="text-gray-300">{viewingIdea.summary}</p>
                </div>
              )}

              {/* Design Document with Diagrams */}
              {viewingIdea.design_document && (
                <div className="glass rounded-xl p-6">
                  <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <span>📐</span> MVP Design Document
                  </h3>
                  <DesignDocument content={viewingIdea.design_document} />
                </div>
              )}

              {/* Conversation History */}
              {viewingIdea.conversation && (() => {
                try {
                  const conversation = typeof viewingIdea.conversation === 'string'
                    ? JSON.parse(viewingIdea.conversation)
                    : viewingIdea.conversation;

                  return (
                    <div className="glass rounded-xl p-6">
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <span>💬</span> Conversation History
                      </h3>
                      <div className="space-y-4">
                        {conversation.map((msg, i) => (
                          <div key={i} className="glass rounded-lg p-4">
                            <div className="text-xs text-gray-400 mb-2 font-medium">
                              {msg.role === 'user' ? '👤 You' : '🤖 AI Assistant'}
                            </div>
                            <div className="text-gray-200 whitespace-pre-wrap">{msg.content}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                } catch (e) {
                  console.error('Failed to parse conversation:', e);
                  return (
                    <div className="glass rounded-xl p-6">
                      <h3 className="text-lg font-semibold mb-4 text-red-400">Error loading conversation</h3>
                      <p className="text-gray-400">Failed to parse conversation data</p>
                    </div>
                  );
                }
              })()}

              {/* Metadata */}
              <div className="glass rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span>📊</span> Metadata
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Excitement:</span>
                    <span className="ml-2 text-white font-medium">{viewingIdea.excitement}/10</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Complexity:</span>
                    <span className="ml-2 text-white font-medium">{viewingIdea.complexity}</span>
                  </div>
                  {viewingIdea.created_at && (
                    <div className="col-span-2">
                      <span className="text-gray-400">Created:</span>
                      <span className="ml-2 text-white font-medium">
                        {new Date(viewingIdea.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  )}
                  {viewingIdea.updated_at && viewingIdea.updated_at !== viewingIdea.created_at && (
                    <div className="col-span-2">
                      <span className="text-gray-400">Last Updated:</span>
                      <span className="ml-2 text-white font-medium">
                        {new Date(viewingIdea.updated_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  )}
                  {viewingIdea.vibe && viewingIdea.vibe.length > 0 && (
                    <div className="col-span-2">
                      <span className="text-gray-400 block mb-2">Vibe:</span>
                      <div className="flex gap-2 flex-wrap">
                        {viewingIdea.vibe.map((v, i) => (
                          <span key={i} className="px-3 py-1 rounded-full text-sm glass">
                            {v}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="col-span-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400">Tags:</span>
                      {editingTagsId !== viewingIdea.id && (
                        <button
                          onClick={() => startEditingTags(viewingIdea)}
                          className="text-xs text-primary hover:text-primary/80 transition-colors"
                        >
                          ✏️ Edit
                        </button>
                      )}
                    </div>
                    {editingTagsId === viewingIdea.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editingTagsInput}
                          onChange={(e) => setEditingTagsInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveTags(viewingIdea.id);
                            if (e.key === 'Escape') cancelEditingTags();
                          }}
                          className="input w-full"
                          placeholder="web, mobile, ai, prototype"
                          autoFocus
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => saveTags(viewingIdea.id)}
                            className="px-3 py-1 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-all text-sm"
                          >
                            ✓ Save
                          </button>
                          <button
                            onClick={cancelEditingTags}
                            className="px-3 py-1 rounded-lg glass hover:bg-red-500/20 hover:text-red-400 transition-all text-sm"
                          >
                            ✕ Cancel
                          </button>
                        </div>
                        {editingTagsInput && (
                          <div className="flex flex-wrap gap-2">
                            {editingTagsInput.split(',').map(t => t.trim()).filter(Boolean).map((tag, i) => (
                              <span key={i} className="px-2 py-1 bg-primary/20 text-primary rounded text-sm">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex gap-2 flex-wrap">
                        {viewingIdea.tags && viewingIdea.tags.length > 0 ? (
                          viewingIdea.tags.map((tag, i) => (
                            <span
                              key={i}
                              className="px-2 py-1 rounded-full text-sm bg-accent/20 text-accent"
                            >
                              #{tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-500 italic text-sm">No tags yet</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Related Ideas */}
              <div className="glass rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span>🔗</span> Linked Ideas
                </h3>

                {/* Parent Idea */}
                {viewingIdea.parent_idea_id && (() => {
                  const parentIdea = ideas.find(i => i.id === viewingIdea.parent_idea_id);
                  return parentIdea ? (
                    <div className="mb-4">
                      <div className="text-xs text-gray-400 mb-2">Parent Idea:</div>
                      <button
                        onClick={() => setViewingIdea(parentIdea)}
                        className="glass rounded-lg p-3 w-full text-left hover:bg-white/5 transition-all group"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-accent">↑</span>
                          <span className="font-medium text-white group-hover:text-accent transition-colors">
                            {parentIdea.title}
                          </span>
                        </div>
                      </button>
                    </div>
                  ) : null;
                })()}

                {/* Related Ideas List */}
                {viewingIdea.related_ideas && viewingIdea.related_ideas.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs text-gray-400 mb-2">Related Ideas:</div>
                    <div className="space-y-2">
                      {viewingIdea.related_ideas.map(relatedId => {
                        const relatedIdea = ideas.find(i => i.id === relatedId);
                        return relatedIdea ? (
                          <div key={relatedId} className="glass rounded-lg p-3 flex items-center gap-3 group">
                            <button
                              onClick={() => setViewingIdea(relatedIdea)}
                              className="flex-1 text-left hover:text-accent transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-primary">⇄</span>
                                <span className="font-medium">{relatedIdea.title}</span>
                              </div>
                            </button>
                            <button
                              onClick={async () => {
                                const updatedRelatedIds = viewingIdea.related_ideas.filter(id => id !== relatedId);
                                await updateIdea(viewingIdea.id, { related_ideas: updatedRelatedIds });
                                setViewingIdea({ ...viewingIdea, related_ideas: updatedRelatedIds });
                              }}
                              className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all px-2"
                              title="Remove link"
                            >
                              ✕
                            </button>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}

                {/* Add Related Idea */}
                <div>
                  <div className="text-xs text-gray-400 mb-2">Link another idea:</div>
                  <select
                    onChange={async (e) => {
                      const selectedId = e.target.value;
                      if (!selectedId) return;

                      const currentRelated = viewingIdea.related_ideas || [];
                      if (currentRelated.includes(selectedId)) {
                        alert('This idea is already linked!');
                        e.target.value = '';
                        return;
                      }

                      const updatedRelatedIds = [...currentRelated, selectedId];
                      await updateIdea(viewingIdea.id, { related_ideas: updatedRelatedIds });
                      setViewingIdea({ ...viewingIdea, related_ideas: updatedRelatedIds });
                      e.target.value = '';
                    }}
                    className="input w-full"
                    defaultValue=""
                  >
                    <option value="">Select an idea to link...</option>
                    {ideas
                      .filter(i =>
                        i.id !== viewingIdea.id &&
                        !viewingIdea.related_ideas?.includes(i.id) &&
                        !i.archived
                      )
                      .map(idea => (
                        <option key={idea.id} value={idea.id}>
                          {idea.title}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-6 border-t border-white/10 flex flex-col gap-3 flex-shrink-0">
              <div className="flex gap-3">
                <button
                  onClick={() => handleCopyToClipboard(viewingIdea)}
                  className="glass px-4 py-2 rounded-lg hover:bg-white/5 transition-all flex items-center gap-2"
                  title="Copy to clipboard"
                >
                  📋 Copy
                </button>
                <button
                  onClick={() => handleExport(viewingIdea)}
                  className="glass px-4 py-2 rounded-lg hover:bg-white/5 transition-all flex items-center gap-2"
                  title="Export as Markdown"
                >
                  📥 Export MD
                </button>
                <div className="flex-1"></div>
                <button
                  onClick={() => {
                    setViewingIdea(null);
                    setRefiningIdea(viewingIdea);
                  }}
                  className="btn-primary"
                >
                  🤖 Continue Refining
                </button>
                <button
                  onClick={() => setViewingIdea(null)}
                  className="btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Brainstorm Chat Modal - Fresh brainstorm */}
      {showIdeation && (
        <BrainstormChat
          onClose={() => {
            setShowIdeation(false);
            fetchIdeas(); // Refresh to show any saved ideas
          }}
        />
      )}

      {/* Brainstorm Chat Modal - Explore from existing idea */}
      {ideatingFromIdea && (
        <BrainstormChat
          seedIdea={ideatingFromIdea}
          onClose={() => {
            setIdeatingFromIdea(null);
            fetchIdeas(); // Refresh to show any saved ideas
          }}
        />
      )}

      {/* Promote Chat Modal - AI-assisted project planning */}
      {promotingIdea && (
        <PromoteChat
          idea={promotingIdea}
          onClose={() => {
            setPromotingIdea(null);
            fetchIdeas(); // Refresh to show updated idea status
          }}
          onPromote={handlePromoteWithPlan}
        />
      )}
    </div>
  );
}
