const API_URL = import.meta.env.VITE_API_URL ||
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? `http://${window.location.hostname}:${window.location.port}/api`
    : '/api';

class APIClient {
  constructor() {
    this.baseURL = API_URL;
    console.log('[API] Base URL:', this.baseURL);
    console.log('[API] Environment:', {
      hostname: window.location.hostname,
      port: window.location.port,
      protocol: window.location.protocol,
      VITE_API_URL: import.meta.env.VITE_API_URL
    });
  }

  getAuthHeader() {
    const token = localStorage.getItem('viberater_access_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
        ...options.headers,
      },
    };

    try {
      console.log(`[API] ${options.method || 'GET'} ${url}`);
      const response = await fetch(url, config);

      if (response.status === 401 && endpoint !== '/auth/refresh') {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          return this.request(endpoint, options);
        } else {
          // Only redirect if not already on login page
          if (!window.location.pathname.includes('/login')) {
            console.log('[API] 401 - redirecting to /login');
            window.location.href = '/login';
          }
          throw new Error('Authentication required');
        }
      }

      // Get response body
      const responseText = await response.text();

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('[API] Non-JSON response:', {
          status: response.status,
          contentType,
          body: responseText.substring(0, 200)
        });
        throw new Error(`Server error (${response.status}): ${responseText.substring(0, 100)}`);
      }

      // Try to parse JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[API] JSON parse error:', {
          status: response.status,
          body: responseText.substring(0, 200),
          error: parseError.message
        });
        throw new Error(`Invalid JSON: ${responseText.substring(0, 100)}`);
      }

      if (!response.ok) {
        throw new Error(data.message || data.error || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('[API] Request failed:', {
        endpoint,
        url,
        error: error.message
      });
      throw error;
    }
  }

  async refreshToken() {
    const refreshToken = localStorage.getItem('viberater_refresh_token');
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      localStorage.setItem('viberater_access_token', data.accessToken);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Auth endpoints
  async register(email, password, name) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  }

  async login(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async logout() {
    const refreshToken = localStorage.getItem('viberater_refresh_token');
    if (refreshToken) {
      await this.request('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    }
    localStorage.removeItem('viberater_access_token');
    localStorage.removeItem('viberater_refresh_token');
    localStorage.removeItem('viberater_user');
  }

  // Ideas endpoints
  async getIdeas(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/ideas${query ? `?${query}` : ''}`);
  }

  async getIdea(id) {
    return this.request(`/ideas/${id}`);
  }

  async createIdea(data) {
    return this.request('/ideas', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateIdea(id, data) {
    return this.request(`/ideas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteIdea(id) {
    return this.request(`/ideas/${id}`, {
      method: 'DELETE',
    });
  }

  async promoteIdea(id, projectData) {
    return this.request(`/ideas/${id}/promote`, {
      method: 'POST',
      body: JSON.stringify(projectData),
    });
  }

  async saveRefinedIdea(id, conversation, refinedData = {}) {
    return this.request(`/ideas/${id}/refine`, {
      method: 'PATCH',
      body: JSON.stringify({ conversation, refinedData }),
    });
  }

  // Projects endpoints
  async getProjects(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/projects${query ? `?${query}` : ''}`);
  }

  async getProject(id) {
    return this.request(`/projects/${id}`);
  }

  async createProject(data) {
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProject(id, data) {
    return this.request(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProject(id) {
    return this.request(`/projects/${id}`, {
      method: 'DELETE',
    });
  }

  async demoteProject(id) {
    return this.request(`/projects/${id}/demote`, {
      method: 'POST',
    });
  }

  // Tasks endpoints
  async getProjectTasks(projectId) {
    return this.request(`/tasks/project/${projectId}`);
  }

  async createTask(projectId, data) {
    return this.request(`/tasks/project/${projectId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTask(id, data) {
    return this.request(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTask(id) {
    return this.request(`/tasks/${id}`, {
      method: 'DELETE',
    });
  }

  async completeTask(id) {
    return this.request(`/tasks/${id}/complete`, {
      method: 'POST',
    });
  }

  // AI endpoints
  async getAIProviders() {
    return this.request('/ai/providers');
  }

  async chatWithAI(messages, options = {}) {
    return this.request('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ messages, ...options }),
    });
  }

  async refineIdea(idea, options = {}) {
    return this.request('/ai/refine-idea', {
      method: 'POST',
      body: JSON.stringify({ idea, ...options }),
    });
  }
}

export const api = new APIClient();
