export default {
  claude: {
    apiKey: process.env.CLAUDE_API_KEY,
    model: 'claude-sonnet-4-5-20250929',
    maxTokens: 200000
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4-turbo-preview',
    maxTokens: 128000
  },
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model: 'codellama'
  },
  default: process.env.DEFAULT_AI_PROVIDER || 'claude'
};
