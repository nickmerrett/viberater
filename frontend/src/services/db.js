// IndexedDB wrapper for offline storage

const DB_NAME = 'viberater-db';
const DB_VERSION = 1;

const STORES = {
  IDEAS: 'ideas',
  PROJECTS: 'projects',
  TASKS: 'tasks',
  SYNC_QUEUE: 'syncQueue'
};

class Database {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Ideas store
        if (!db.objectStoreNames.contains(STORES.IDEAS)) {
          const ideasStore = db.createObjectStore(STORES.IDEAS, { keyPath: 'id' });
          ideasStore.createIndex('user_id', 'user_id', { unique: false });
          ideasStore.createIndex('created_at', 'created_at', { unique: false });
          ideasStore.createIndex('archived', 'archived', { unique: false });
          ideasStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
        }

        // Projects store
        if (!db.objectStoreNames.contains(STORES.PROJECTS)) {
          const projectsStore = db.createObjectStore(STORES.PROJECTS, { keyPath: 'id' });
          projectsStore.createIndex('user_id', 'user_id', { unique: false });
          projectsStore.createIndex('status', 'status', { unique: false });
        }

        // Tasks store
        if (!db.objectStoreNames.contains(STORES.TASKS)) {
          const tasksStore = db.createObjectStore(STORES.TASKS, { keyPath: 'id' });
          tasksStore.createIndex('project_id', 'project_id', { unique: false });
          tasksStore.createIndex('status', 'status', { unique: false });
        }

        // Sync queue store (for offline operations)
        if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
          const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id', autoIncrement: true });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
          syncStore.createIndex('synced', 'synced', { unique: false });
        }
      };
    });
  }

  // Generic CRUD operations
  async getAll(storeName) {
    const tx = this.db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async get(storeName, id) {
    const tx = this.db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async put(storeName, data) {
    const tx = this.db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName, id) {
    const tx = this.db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName) {
    const tx = this.db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Ideas
  async getAllIdeas() {
    return this.getAll(STORES.IDEAS);
  }

  async getIdea(id) {
    return this.get(STORES.IDEAS, id);
  }

  async saveIdea(idea) {
    return this.put(STORES.IDEAS, idea);
  }

  async saveIdeas(ideas) {
    const tx = this.db.transaction(STORES.IDEAS, 'readwrite');
    const store = tx.objectStore(STORES.IDEAS);

    for (const idea of ideas) {
      store.put(idea);
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteIdea(id) {
    return this.delete(STORES.IDEAS, id);
  }

  // Projects
  async getAllProjects() {
    return this.getAll(STORES.PROJECTS);
  }

  async getProject(id) {
    return this.get(STORES.PROJECTS, id);
  }

  async saveProject(project) {
    return this.put(STORES.PROJECTS, project);
  }

  async saveProjects(projects) {
    const tx = this.db.transaction(STORES.PROJECTS, 'readwrite');
    const store = tx.objectStore(STORES.PROJECTS);

    for (const project of projects) {
      store.put(project);
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteProject(id) {
    return this.delete(STORES.PROJECTS, id);
  }

  // Tasks
  async getAllTasks() {
    return this.getAll(STORES.TASKS);
  }

  async getTasksByProject(projectId) {
    const tx = this.db.transaction(STORES.TASKS, 'readonly');
    const store = tx.objectStore(STORES.TASKS);
    const index = store.index('project_id');

    return new Promise((resolve, reject) => {
      const request = index.getAll(projectId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveTask(task) {
    return this.put(STORES.TASKS, task);
  }

  async saveTasks(tasks) {
    const tx = this.db.transaction(STORES.TASKS, 'readwrite');
    const store = tx.objectStore(STORES.TASKS);

    for (const task of tasks) {
      store.put(task);
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteTask(id) {
    return this.delete(STORES.TASKS, id);
  }

  // Sync Queue
  async addToSyncQueue(operation) {
    const queueItem = {
      ...operation,
      timestamp: Date.now(),
      synced: false
    };
    return this.put(STORES.SYNC_QUEUE, queueItem);
  }

  async getPendingSyncItems() {
    const tx = this.db.transaction(STORES.SYNC_QUEUE, 'readonly');
    const store = tx.objectStore(STORES.SYNC_QUEUE);
    const index = store.index('synced');

    return new Promise((resolve, reject) => {
      const request = index.getAll(false);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async markSynced(id) {
    const item = await this.get(STORES.SYNC_QUEUE, id);
    if (item) {
      item.synced = true;
      await this.put(STORES.SYNC_QUEUE, item);
    }
  }

  async clearSyncQueue() {
    return this.clear(STORES.SYNC_QUEUE);
  }

  // Clear all data
  async clearAll() {
    await this.clear(STORES.IDEAS);
    await this.clear(STORES.PROJECTS);
    await this.clear(STORES.TASKS);
    await this.clear(STORES.SYNC_QUEUE);
  }
}

// Singleton instance
const db = new Database();

export { db, STORES };
