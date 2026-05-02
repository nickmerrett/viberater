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
