import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../services/api.js', () => ({
  api: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  },
}));

const { useAuthStore } = await import('../useAuthStore.js');
const { api } = await import('../../services/api.js');

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useAuthStore.setState({ user: null, isAuthenticated: false, loading: false, error: null });
});

describe('useAuthStore.login', () => {
  it('sets authenticated state and stores tokens on success', async () => {
    api.login.mockResolvedValueOnce({
      user: { id: '1', email: 'test@example.com' },
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    const { result } = renderHook(() => useAuthStore());
    let success;
    await act(async () => {
      success = await result.current.login('test@example.com', 'password');
    });

    expect(success).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user.email).toBe('test@example.com');
    expect(localStorage.getItem('viberater_access_token')).toBe('access-token');
    expect(localStorage.getItem('viberater_refresh_token')).toBe('refresh-token');
  });

  it('sets error and returns false on failure', async () => {
    api.login.mockRejectedValueOnce(new Error('Invalid credentials'));

    const { result } = renderHook(() => useAuthStore());
    let success;
    await act(async () => {
      success = await result.current.login('bad@example.com', 'wrong');
    });

    expect(success).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.error).toBe('Invalid credentials');
    expect(localStorage.getItem('viberater_access_token')).toBeNull();
  });
});

describe('useAuthStore.register', () => {
  it('sets authenticated state on success', async () => {
    api.register.mockResolvedValueOnce({
      user: { id: '2', email: 'new@example.com' },
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    const { result } = renderHook(() => useAuthStore());
    let success;
    await act(async () => {
      success = await result.current.register('new@example.com', 'password', 'New User');
    });

    expect(success).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
    expect(api.register).toHaveBeenCalledWith('new@example.com', 'password', 'New User');
  });
});

describe('useAuthStore.logout', () => {
  it('clears auth state and localStorage', async () => {
    localStorage.setItem('viberater_access_token', 'token');
    localStorage.setItem('viberater_refresh_token', 'refresh');
    useAuthStore.setState({ user: { email: 'test@example.com' }, isAuthenticated: true });

    api.logout.mockResolvedValueOnce();

    const { result } = renderHook(() => useAuthStore());
    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('viberater_access_token')).toBeNull();
    expect(localStorage.getItem('viberater_refresh_token')).toBeNull();
  });

  it('still clears state even if the API call fails', async () => {
    localStorage.setItem('viberater_access_token', 'token');
    useAuthStore.setState({ user: { email: 'test@example.com' }, isAuthenticated: true });

    api.logout.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useAuthStore());
    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem('viberater_access_token')).toBeNull();
  });
});

describe('useAuthStore.clearError', () => {
  it('clears the error field', () => {
    useAuthStore.setState({ error: 'Something went wrong' });
    const { result } = renderHook(() => useAuthStore());
    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });
});
