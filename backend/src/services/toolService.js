// Provider-agnostic tool definitions and handlers.
// Add SEARCH_PROVIDER=brave|tavily to env (default: brave).
// Add BRAVE_SEARCH_API_KEY or TAVILY_API_KEY to secrets.

const MAX_FETCH_CHARS = 8000; // keep context window manageable
const SEARCH_RESULTS = 5;

// ── Tool definitions (neutral format, translated per AI provider) ──────────

export const TOOLS = [
  {
    name: 'web_search',
    description: 'Search the web for information. Use this to find existing products, competitors, open-source projects, or market context for an idea.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
  },
  {
    name: 'fetch_url',
    description: 'Fetch and read the content of a URL — a product page, article, GitHub repo, or documentation.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to fetch' },
      },
      required: ['url'],
    },
  },
];

// ── Handlers ──────────────────────────────────────────────────────────────

export async function webSearch(query) {
  const provider = process.env.SEARCH_PROVIDER || 'brave';

  switch (provider) {
    case 'brave':
      return braveSearch(query);
    case 'tavily':
      return tavilySearch(query);
    default:
      throw new Error(`Unknown search provider: ${provider}`);
  }
}

async function braveSearch(query) {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) throw new Error('BRAVE_SEARCH_API_KEY not configured');

  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${SEARCH_RESULTS}`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json', 'X-Subscription-Token': key },
  });

  if (!res.ok) throw new Error(`Brave Search error: ${res.status}`);
  const data = await res.json();

  const results = (data.web?.results || []).map(r => ({
    title: r.title,
    url: r.url,
    description: r.description,
  }));

  return formatSearchResults(query, results);
}

async function tavilySearch(query) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error('TAVILY_API_KEY not configured');

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: key, query, max_results: SEARCH_RESULTS }),
  });

  if (!res.ok) throw new Error(`Tavily error: ${res.status}`);
  const data = await res.json();

  const results = (data.results || []).map(r => ({
    title: r.title,
    url: r.url,
    description: r.content?.slice(0, 200),
  }));

  return formatSearchResults(query, results);
}

function formatSearchResults(query, results) {
  if (!results.length) return `No results found for: ${query}`;
  return results
    .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.description || ''}`)
    .join('\n\n');
}

export async function fetchUrl(url) {
  try {
    new URL(url); // validate
  } catch {
    return 'Invalid URL';
  }

  let res;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; research-bot/1.0)' },
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    return `Could not fetch ${url}: ${err.message} — skipping this source.`;
  }

  if (!res.ok) return `Could not fetch ${url}: HTTP ${res.status} — skipping this source.`;

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('text')) return `Could not read ${url}: unsupported content type — skipping.`;

  const html = await res.text();
  const text = stripHtml(html);
  return text.length > MAX_FETCH_CHARS
    ? text.slice(0, MAX_FETCH_CHARS) + '\n\n[content truncated]'
    : text;
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{3,}/g, '\n\n')
    .trim();
}

// ── Tool dispatcher ───────────────────────────────────────────────────────

export async function callTool(name, args) {
  switch (name) {
    case 'web_search': return webSearch(args.query);
    case 'fetch_url':  return fetchUrl(args.url);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}
