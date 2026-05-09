import { db } from './db';
import { api } from './api';

class SyncService {
  constructor() {
    this.isSyncing = false;
    this.syncListeners = [];
    this.refreshListeners = []; // called after a successful pull so stores update UI
  }

  // ── Event listeners ───────────────────────────────────────────────────────

  onSyncStart(callback) { this.syncListeners.push({ event: 'start', callback }); }
  onSyncComplete(callback) { this.syncListeners.push({ event: 'complete', callback }); }
  onSyncError(callback) { this.syncListeners.push({ event: 'error', callback }); }

  emit(event, data) {
    this.syncListeners.filter(l => l.event === event).forEach(l => l.callback(data));
  }

  // Register a callback that fires after a successful server pull.
  // Used by zustand stores to update their in-memory state from IndexedDB.
  addRefreshListener(fn) {
    this.refreshListeners.push(fn);
  }

  // ── Offline queue ─────────────────────────────────────────────────────────

  async queueOperation(operation) {
    await db.addToSyncQueue(operation);

    if (this.isOnline()) {
      this.sync();
    } else {
      this._registerBackgroundSync();
    }
  }

  async _registerBackgroundSync() {
    try {
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('viberater-sync');
      }
    } catch {
      // Background Sync not available — online event handler is the fallback
    }
  }

  // ── Push pending offline operations to server ─────────────────────────────

  async sync() {
    if (this.isSyncing || !this.isOnline()) return;

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

  async executeOperation(op) {
    const { resource, method, data, id } = op;
    switch (resource) {
      case 'idea':    return this.syncIdea(method, data, id);
      case 'project': return this.syncProject(method, data, id);
      case 'task':    return this.syncTask(method, data, id);
      default: throw new Error(`Unknown resource type: ${resource}`);
    }
  }

  async syncIdea(method, data, id) {
    switch (method) {
      case 'CREATE': { const r = await api.createIdea(data); await db.deleteIdea(id); await db.saveIdea(r.idea); return r; }
      case 'UPDATE': { const r = await api.updateIdea(id, data); await db.saveIdea(r.idea); return r; }
      case 'DELETE': { await api.deleteIdea(id); await db.deleteIdea(id); return; }
      default: throw new Error(`Unknown method: ${method}`);
    }
  }

  async syncProject(method, data, id) {
    switch (method) {
      case 'CREATE': { const r = await api.createProject(data); await db.deleteProject(id); await db.saveProject(r.project); return r; }
      case 'UPDATE': { const r = await api.updateProject(id, data); await db.saveProject(r.project); return r; }
      case 'DELETE': { await api.deleteProject(id); await db.deleteProject(id); return; }
      default: throw new Error(`Unknown method: ${method}`);
    }
  }

  async syncTask(method, data, id) {
    switch (method) {
      case 'CREATE': { const r = await api.createTask(data.project_id, data); await db.deleteTask(id); await db.saveTask(r.task); return r; }
      case 'UPDATE': { const r = await api.updateTask(id, data); await db.saveTask(r.task); return r; }
      case 'DELETE': { await api.deleteTask(id); await db.deleteTask(id); return; }
      default: throw new Error(`Unknown method: ${method}`);
    }
  }

  // ── Pull latest from server → IndexedDB → notify stores ──────────────────

  isOnline() { return navigator.onLine; }

  async pullFromServer() {
    if (!this.isOnline()) return;
    if (!localStorage.getItem('viberater_access_token')) return;

    try {
      const [ideasData, projectsData] = await Promise.all([
        api.getIdeas(),
        api.getProjects(),
      ]);

      await db.saveIdeas(ideasData.ideas);
      await db.saveProjects(projectsData.projects);

      for (const project of projectsData.projects) {
        const tasksData = await api.getProjectTasks(project.id);
        await db.saveTasks(tasksData.tasks);
      }

      // Notify zustand stores so UI reflects the new data
      for (const fn of this.refreshListeners) {
        await fn().catch(() => {});
      }

      return { ideas: ideasData.ideas.length, projects: projectsData.projects.length };
    } catch (error) {
      console.error('Failed to pull from server:', error);
      throw error;
    }
  }

  // ── Bidirectional sync: push local changes first, then pull server state ──

  async syncAndRefresh() {
    if (!this.isOnline() || !localStorage.getItem('viberater_access_token')) return;
    await this.sync();          // 1. push any pending offline ops to server
    await this.pullFromServer(); // 2. pull server state (now includes our changes + others')
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  init() {
    // Online event: push pending ops, then refresh from server
    window.addEventListener('online', () => {
      console.log('Back online — syncing...');
      this.syncAndRefresh().catch(() => {});
    });

    // Background Sync message from SW (connectivity restored while tab closed)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'BACKGROUND_SYNC') {
          console.log('Background sync triggered by SW');
          this.syncAndRefresh().catch(() => {});
        }
      });
    }

    // Foreground event: app comes back into view (e.g. switching from another app on phone)
    // Push any local changes first, then pull server state — handles cross-device sync
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      console.log('App foregrounded — bidirectional sync');
      this.syncAndRefresh().catch(() => {});
    });

    // Initial pull on startup
    if (this.isOnline()) {
      this.pullFromServer().catch(err => console.error('Initial pull failed:', err));
    }
  }
}

export const syncService = new SyncService();
