import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const { api } = await import('../api.js');

const jsonResponse = (data, status = 200) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    text: () => Promise.resolve(JSON.stringify(data)),
  });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('APIClient.request', () => {
  it('returns parsed JSON on success', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ status: 'ok' }));
    const result = await api.request('/health');
    expect(result).toEqual({ status: 'ok' });
  });

  it('throws with the server error message on non-ok response', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ error: 'Not found' }, 404));
    await expect(api.request('/missing')).rejects.toThrow('Not found');
  });

  it('includes Authorization header when a token is stored', async () => {
    localStorage.setItem('viberater_access_token', 'my-token');
    mockFetch.mockReturnValueOnce(jsonResponse({ ok: true }));
    await api.request('/ideas');
    const [, config] = mockFetch.mock.calls[0];
    expect(config.headers['Authorization']).toBe('Bearer my-token');
  });

  it('omits Authorization header when no token is stored', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ ok: true }));
    await api.request('/health');
    const [, config] = mockFetch.mock.calls[0];
    expect(config.headers['Authorization']).toBeUndefined();
  });

  it('throws on non-JSON response', async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        ok: false,
        status: 502,
        headers: { get: () => 'text/html' },
        text: () => Promise.resolve('<html>Bad Gateway</html>'),
      })
    );
    await expect(api.request('/health')).rejects.toThrow();
  });
});

describe('APIClient 401 / token refresh', () => {
  it('retries with new token after a successful refresh', async () => {
    localStorage.setItem('viberater_refresh_token', 'refresh-token');

    mockFetch
      .mockReturnValueOnce(jsonResponse({ error: 'Unauthorized' }, 401))
      .mockReturnValueOnce(
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ accessToken: 'new-access-token' }),
        })
      )
      .mockReturnValueOnce(jsonResponse({ ideas: [] }));

    const result = await api.request('/ideas');
    expect(result).toEqual({ ideas: [] });
    expect(localStorage.getItem('viberater_access_token')).toBe('new-access-token');
  });

  it('throws when refresh fails', async () => {
    localStorage.setItem('viberater_refresh_token', 'bad-refresh');

    mockFetch
      .mockReturnValueOnce(jsonResponse({ error: 'Unauthorized' }, 401))
      .mockReturnValueOnce(Promise.resolve({ ok: false }));

    await expect(api.request('/ideas')).rejects.toThrow();
  });
});

describe('APIClient convenience methods', () => {
  it('login POSTs to /auth/login', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ user: {}, accessToken: 'a', refreshToken: 'r' }));
    await api.login('user@example.com', 'password');
    const [url, config] = mockFetch.mock.calls[0];
    expect(url).toContain('/auth/login');
    expect(config.method).toBe('POST');
    expect(JSON.parse(config.body)).toMatchObject({ email: 'user@example.com' });
  });

  it('getIdeas GETs /ideas', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ ideas: [] }));
    await api.getIdeas();
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/ideas');
  });

  it('createIdea POSTs to /ideas', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ idea: { id: '1', title: 'Test' } }));
    await api.createIdea({ title: 'Test' });
    const [url, config] = mockFetch.mock.calls[0];
    expect(url).toContain('/ideas');
    expect(config.method).toBe('POST');
  });
});

describe('APIClient.suggestReminder', () => {
  it('POSTs to /ai/chat with the context as a user message', async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({ message: '{"title":"Call dentist","due_date":null}', questions: [] })
    );
    const result = await api.suggestReminder('call the dentist next week');
    const [url, config] = mockFetch.mock.calls[0];
    const body = JSON.parse(config.body);
    expect(url).toContain('/ai/chat');
    expect(config.method).toBe('POST');
    expect(body.messages[0]).toMatchObject({ role: 'user', content: 'call the dentist next week' });
    // message is a plain string on the response object
    expect(typeof result.message).toBe('string');
  });
});

describe('APIClient.streamCaptureMessage', () => {
  function makeSSEStream(chunks) {
    const encoder = new TextEncoder();
    return new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    });
  }

  it('calls onError when the response is not ok', async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Unauthorized' }) })
    );
    const onToken = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();
    await api.streamCaptureMessage('hello', onToken, onDone, onError);
    expect(onError).toHaveBeenCalledWith('Unauthorized');
    expect(onToken).not.toHaveBeenCalled();
  });

  it('streams tokens and fires onDone with captured ideas', async () => {
    const sseLines =
      'data: {"type":"token","text":"Hello"}\n\n' +
      'data: {"type":"token","text":" world"}\n\n' +
      'data: {"type":"done","messageId":"msg-1","captured":[]}\n\n';
    mockFetch.mockReturnValueOnce(
      Promise.resolve({ ok: true, body: makeSSEStream([sseLines]) })
    );
    const onToken = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();
    await api.streamCaptureMessage('test', onToken, onDone, onError);
    expect(onToken).toHaveBeenCalledWith('Hello');
    expect(onToken).toHaveBeenCalledWith(' world');
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ messageId: 'msg-1' }));
    expect(onError).not.toHaveBeenCalled();
  });

  it('handles tokens split across chunks', async () => {
    // Simulate nginx/proxy delivering the SSE line in two separate TCP chunks
    const chunk1 = 'data: {"type":"tok';
    const chunk2 = 'en","text":"hi"}\n\ndata: {"type":"done","messageId":"m2","captured":[]}\n\n';
    mockFetch.mockReturnValueOnce(
      Promise.resolve({ ok: true, body: makeSSEStream([chunk1, chunk2]) })
    );
    const onToken = vi.fn();
    const onDone = vi.fn();
    await api.streamCaptureMessage('test', onToken, onDone, vi.fn());
    expect(onToken).toHaveBeenCalledWith('hi');
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ messageId: 'm2' }));
  });

  it('sends the auth token in the Authorization header', async () => {
    localStorage.setItem('viberater_access_token', 'stream-token');
    mockFetch.mockReturnValueOnce(
      Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'x' }) })
    );
    await api.streamCaptureMessage('hi', vi.fn(), vi.fn(), vi.fn());
    const [, config] = mockFetch.mock.calls[0];
    expect(config.headers['Authorization']).toBe('Bearer stream-token');
  });
});
