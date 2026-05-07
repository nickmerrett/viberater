import { db } from './db';
import { api } from './api';

class SyncService {
  constructor() {
    this.isSyncing = false;
    this.syncListeners = [];
  }

  // Check if online
  isOnline() {
    return navigator.onLine;
  }

  // Add listeners for sync events
  onSyncStart(callback) {
    this.syncListeners.push({ event: 'start', callback });
  }

  onSyncComplete(callback) {
    this.syncListeners.push({ event: 'complete', callback });
  }

  onSyncError(callback) {
    this.syncListeners.push({ event: 'error', callback });
  }

  emit(event, data) {
    this.syncListeners
      .filter(l => l.event === event)
      .forEach(l => l.callback(data));
  }

  // Queue an operation for sync
  async queueOperation(operation) {
    await db.addToSyncQueue(operation);

    if (this.isOnline()) {
      this.sync();
    } else {
      // Register Background Sync so the browser triggers sync when
      // connectivity returns, even if the tab is closed (Chrome/Android)
      this._registerBackgroundSync();
    }
  }

  async _registerBackgroundSync() {
    try {
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('viberater-sync');
      }
    } catch (e) {
      // Background Sync not available — online event handler is the fallback
    }
  }

  // Sync all pending operations
  async sync() {
    if (this.isSyncing || !this.isOnline()) {
      return;
    }

    this.isSyncing = true;
    this.emit('start');

    try {
      const pendingOps = await db.getPendingSyncItems();

      for (const op of pendingOps) {
        try {
          await this.executeOperation(op);
          await db.markSynced(op.id);
        } catch (error) {
          console.error('Failed to sync operation:', op, error);
          // Keep in queue to retry later
        }
      }

      this.emit('complete', { synced: pendingOps.length });
    } catch (error) {
      console.error('Sync failed:', error);
      this.emit('error', error);
    } finally {
      this.isSyncing = false;
    }
  }

  // Execute a single operation
  async executeOperation(op) {
    const { type, resource, method, data, id } = op;

    switch (resource) {
      case 'idea':
        return this.syncIdea(method, data, id);
      case 'project':
        return this.syncProject(method, data, id);
      case 'task':
        return this.syncTask(method, data, id);
      default:
        throw new Error(`Unknown resource type: ${resource}`);
    }
  }

  async syncIdea(method, data, id) {
    switch (method) {
      case 'CREATE':
        const created = await api.createIdea(data);
        // Update local copy with server ID
        await db.deleteIdea(id);
        await db.saveIdea(created.idea);
        return created;

      case 'UPDATE':
        const updated = await api.updateIdea(id, data);
        await db.saveIdea(updated.idea);
        return updated;

      case 'DELETE':
        await api.deleteIdea(id);
        await db.deleteIdea(id);
        return;

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  async syncProject(method, data, id) {
    switch (method) {
      case 'CREATE':
        const created = await api.createProject(data);
        await db.deleteProject(id);
        await db.saveProject(created.project);
        return created;

      case 'UPDATE':
        const updated = await api.updateProject(id, data);
        await db.saveProject(updated.project);
        return updated;

      case 'DELETE':
        await api.deleteProject(id);
        await db.deleteProject(id);
        return;

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  async syncTask(method, data, id) {
    switch (method) {
      case 'CREATE':
        const created = await api.createTask(data.project_id, data);
        await db.deleteTask(id);
        await db.saveTask(created.task);
        return created;

      case 'UPDATE':
        const updated = await api.updateTask(id, data);
        await db.saveTask(updated.task);
        return updated;

      case 'DELETE':
        await api.deleteTask(id);
        await db.deleteTask(id);
        return;

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  // Pull latest data from server
  async pullFromServer() {
    if (!this.isOnline()) {
      throw new Error('Cannot pull from server while offline');
    }
    // Skip silently if unauthenticated — avoids 401 redirect on public pages
    if (!localStorage.getItem('viberater_access_token')) return;

    try {
      // Fetch all data
      const [ideasData, projectsData] = await Promise.all([
        api.getIdeas(),
        api.getProjects()
      ]);

      // Save to IndexedDB
      await db.saveIdeas(ideasData.ideas);
      await db.saveProjects(projectsData.projects);

      // Fetch tasks for each project
      for (const project of projectsData.projects) {
        const tasksData = await api.getProjectTasks(project.id);
        await db.saveTasks(tasksData.tasks);
      }

      return {
        ideas: ideasData.ideas.length,
        projects: projectsData.projects.length
      };
    } catch (error) {
      console.error('Failed to pull from server:', error);
      throw error;
    }
  }

  // Initialize sync on app start
  init() {
    // Sync when tab comes back online (only if authenticated)
    window.addEventListener('online', () => {
      if (!localStorage.getItem('viberater_access_token')) return;
      console.log('Back online - syncing...');
      this.sync();
    });

    // Listen for Background Sync messages from the service worker
    // (fires when connectivity restored while tab was closed)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'BACKGROUND_SYNC') {
          console.log('Background sync triggered by service worker');
          this.sync();
        }
      });
    }

    // Try to pull data if online
    if (this.isOnline()) {
      this.pullFromServer().catch(err => {
        console.error('Initial pull failed:', err);
      });
    }
  }
}

export const syncService = new SyncService();
