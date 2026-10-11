export default {
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    model: process.env.AI_MODEL || 'meta-llama/llama-3.3-70b-instruct',
  },
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model: 'codellama',
  },
  default: process.env.DEFAULT_AI_PROVIDER || 'openrouter',
};
