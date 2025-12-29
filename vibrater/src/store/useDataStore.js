import { create } from 'zustand';
import { api } from '../services/api';
import { db } from '../services/db';
import { syncService } from '../services/syncService';

let dbInitialized = false;

export const useDataStore = create((set, get) => ({
  ideas: [],
  projects: [],
  tasks: {},
  loading: false,
  error: null,
  isOffline: !navigator.onLine,

  // Initialize IndexedDB and sync service
  initialize: async () => {
    if (dbInitialized) return;

    try {
      await db.init();
      syncService.init();
      dbInitialized = true;

      // Load data from IndexedDB immediately (offline cache)
      const [ideas, projects, tasks] = await Promise.all([
        db.getAllIdeas(),
        db.getAllProjects(),
        db.getAllTasks()
      ]);

      // Group tasks by project_id
      const tasksByProject = tasks.reduce((acc, task) => {
        if (!acc[task.project_id]) {
          acc[task.project_id] = [];
        }
        acc[task.project_id].push(task);
        return acc;
      }, {});

      set({ ideas, projects, tasks: tasksByProject });

      console.log('[DB] Initialized - loaded from cache:', {
        ideas: ideas.length,
        projects: projects.length,
        tasks: tasks.length
      });

      // Don't fetch from server here - let components do it when user is authenticated
    } catch (error) {
      console.error('Failed to initialize database:', error);
      set({ error: error.message });
    }
  },

  // Ideas
  fetchIdeas: async (params) => {
    set({ loading: true, error: null });
    try {
      if (navigator.onLine) {
        const data = await api.getIdeas(params);
        await db.saveIdeas(data.ideas);
        set({ ideas: data.ideas, loading: false });
      } else {
        const ideas = await db.getAllIdeas();
        set({ ideas, loading: false });
      }
    } catch (error) {
      // Fall back to IndexedDB on error
      const ideas = await db.getAllIdeas();
      set({ ideas, loading: false, error: error.message });
    }
  },

  createIdea: async (ideaData) => {
    try {
      // Create temp ID for offline
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const tempIdea = { ...ideaData, id: tempId, created_at: new Date().toISOString() };

      if (navigator.onLine) {
        const data = await api.createIdea(ideaData);
        await db.saveIdea(data.idea);
        set({ ideas: [data.idea, ...get().ideas] });
        return data.idea;
      } else {
        // Save locally and queue for sync
        await db.saveIdea(tempIdea);
        await syncService.queueOperation({
          resource: 'idea',
          method: 'CREATE',
          data: ideaData,
          id: tempId
        });
        set({ ideas: [tempIdea, ...get().ideas] });
        return tempIdea;
      }
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  updateIdea: async (id, ideaData) => {
    try {
      const updatedIdea = { ...get().ideas.find(i => i.id === id), ...ideaData };

      if (navigator.onLine) {
        const data = await api.updateIdea(id, ideaData);
        await db.saveIdea(data.idea);
        set({
          ideas: get().ideas.map(idea => idea.id === id ? data.idea : idea)
        });
        return data.idea;
      } else {
        // Update locally and queue for sync
        await db.saveIdea(updatedIdea);
        await syncService.queueOperation({
          resource: 'idea',
          method: 'UPDATE',
          data: ideaData,
          id
        });
        set({
          ideas: get().ideas.map(idea => idea.id === id ? updatedIdea : idea)
        });
        return updatedIdea;
      }
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  deleteIdea: async (id) => {
    try {
      if (navigator.onLine) {
        await api.deleteIdea(id);
        await db.deleteIdea(id);
        set({ ideas: get().ideas.filter(idea => idea.id !== id) });
      } else {
        // Delete locally and queue for sync
        await db.deleteIdea(id);
        await syncService.queueOperation({
          resource: 'idea',
          method: 'DELETE',
          id
        });
        set({ ideas: get().ideas.filter(idea => idea.id !== id) });
      }
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  promoteIdea: async (id, projectData) => {
    try {
      const data = await api.promoteIdea(id, projectData);
      // Update the idea's status and add the new project
      set({
        ideas: get().ideas.map(idea =>
          idea.id === id ? { ...idea, status: 'promoted-to-project' } : idea
        ),
        projects: [data.project, ...get().projects],
        tasks: data.tasks ? { ...get().tasks, [data.project.id]: data.tasks } : get().tasks
      });
      return data.project;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  // Projects
  fetchProjects: async (params) => {
    set({ loading: true, error: null });
    try {
      if (navigator.onLine) {
        const data = await api.getProjects(params);
        await db.saveProjects(data.projects);
        set({ projects: data.projects, loading: false });
      } else {
        const projects = await db.getAllProjects();
        set({ projects, loading: false });
      }
    } catch (error) {
      // Fall back to IndexedDB on error
      const projects = await db.getAllProjects();
      set({ projects, loading: false, error: error.message });
    }
  },

  createProject: async (projectData) => {
    try {
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const tempProject = { ...projectData, id: tempId, created_at: new Date().toISOString() };

      if (navigator.onLine) {
        const data = await api.createProject(projectData);
        await db.saveProject(data.project);
        set({ projects: [data.project, ...get().projects] });
        return data.project;
      } else {
        await db.saveProject(tempProject);
        await syncService.queueOperation({
          resource: 'project',
          method: 'CREATE',
          data: projectData,
          id: tempId
        });
        set({ projects: [tempProject, ...get().projects] });
        return tempProject;
      }
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  updateProject: async (id, projectData) => {
    try {
      const updatedProject = { ...get().projects.find(p => p.id === id), ...projectData };

      if (navigator.onLine) {
        const data = await api.updateProject(id, projectData);
        await db.saveProject(data.project);
        set({
          projects: get().projects.map(project => project.id === id ? data.project : project)
        });
        return data.project;
      } else {
        await db.saveProject(updatedProject);
        await syncService.queueOperation({
          resource: 'project',
          method: 'UPDATE',
          data: projectData,
          id
        });
        set({
          projects: get().projects.map(project => project.id === id ? updatedProject : project)
        });
        return updatedProject;
      }
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  deleteProject: async (id) => {
    try {
      if (navigator.onLine) {
        await api.deleteProject(id);
        await db.deleteProject(id);
        set({ projects: get().projects.filter(project => project.id !== id) });
      } else {
        await db.deleteProject(id);
        await syncService.queueOperation({
          resource: 'project',
          method: 'DELETE',
          id
        });
        set({ projects: get().projects.filter(project => project.id !== id) });
      }
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  demoteProject: async (id) => {
    try {
      const data = await api.demoteProject(id);
      // Remove the project and restore the idea
      await db.deleteProject(id);
      await db.saveIdea(data.idea);

      // Check if idea already exists in the list
      const existingIdea = get().ideas.find(idea => idea.id === data.idea.id);

      set({
        projects: get().projects.filter(project => project.id !== id),
        ideas: existingIdea
          ? get().ideas.map(idea => idea.id === data.idea.id ? data.idea : idea)
          : [data.idea, ...get().ideas]
      });
      return data.idea;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  // Tasks
  fetchProjectTasks: async (projectId) => {
    try {
      if (navigator.onLine) {
        const data = await api.getProjectTasks(projectId);
        await db.saveTasks(data.tasks);
        set({
          tasks: { ...get().tasks, [projectId]: data.tasks }
        });
      } else {
        const tasks = await db.getTasksByProject(projectId);
        set({
          tasks: { ...get().tasks, [projectId]: tasks }
        });
      }
    } catch (error) {
      // Fall back to IndexedDB
      const tasks = await db.getTasksByProject(projectId);
      set({
        tasks: { ...get().tasks, [projectId]: tasks },
        error: error.message
      });
    }
  },

  createTask: async (projectId, taskData) => {
    try {
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const tempTask = {
        ...taskData,
        id: tempId,
        project_id: projectId,
        created_at: new Date().toISOString()
      };
      const projectTasks = get().tasks[projectId] || [];

      if (navigator.onLine) {
        const data = await api.createTask(projectId, taskData);
        await db.saveTask(data.task);
        set({
          tasks: { ...get().tasks, [projectId]: [...projectTasks, data.task] }
        });
        return data.task;
      } else {
        await db.saveTask(tempTask);
        await syncService.queueOperation({
          resource: 'task',
          method: 'CREATE',
          data: { ...taskData, project_id: projectId },
          id: tempId
        });
        set({
          tasks: { ...get().tasks, [projectId]: [...projectTasks, tempTask] }
        });
        return tempTask;
      }
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  updateTask: async (projectId, taskId, taskData) => {
    try {
      const projectTasks = get().tasks[projectId] || [];
      const updatedTask = { ...projectTasks.find(t => t.id === taskId), ...taskData };

      if (navigator.onLine) {
        const data = await api.updateTask(taskId, taskData);
        await db.saveTask(data.task);
        set({
          tasks: {
            ...get().tasks,
            [projectId]: projectTasks.map(task => task.id === taskId ? data.task : task)
          }
        });
        return data.task;
      } else {
        await db.saveTask(updatedTask);
        await syncService.queueOperation({
          resource: 'task',
          method: 'UPDATE',
          data: taskData,
          id: taskId
        });
        set({
          tasks: {
            ...get().tasks,
            [projectId]: projectTasks.map(task => task.id === taskId ? updatedTask : task)
          }
        });
        return updatedTask;
      }
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  deleteTask: async (projectId, taskId) => {
    try {
      const projectTasks = get().tasks[projectId] || [];

      if (navigator.onLine) {
        await api.deleteTask(taskId);
        await db.deleteTask(taskId);
        set({
          tasks: {
            ...get().tasks,
            [projectId]: projectTasks.filter(task => task.id !== taskId)
          }
        });
      } else {
        await db.deleteTask(taskId);
        await syncService.queueOperation({
          resource: 'task',
          method: 'DELETE',
          id: taskId
        });
        set({
          tasks: {
            ...get().tasks,
            [projectId]: projectTasks.filter(task => task.id !== taskId)
          }
        });
      }
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  completeTask: async (projectId, taskId) => {
    try {
      const projectTasks = get().tasks[projectId] || [];

      if (navigator.onLine) {
        const data = await api.completeTask(taskId);
        await db.saveTask(data.task);
        set({
          tasks: {
            ...get().tasks,
            [projectId]: projectTasks.map(task => task.id === taskId ? data.task : task)
          }
        });
        return data.task;
      } else {
        const completedTask = {
          ...projectTasks.find(t => t.id === taskId),
          status: 'completed',
          completed_at: new Date().toISOString()
        };
        await db.saveTask(completedTask);
        await syncService.queueOperation({
          resource: 'task',
          method: 'UPDATE',
          data: { status: 'completed' },
          id: taskId
        });
        set({
          tasks: {
            ...get().tasks,
            [projectId]: projectTasks.map(task => task.id === taskId ? completedTask : task)
          }
        });
        return completedTask;
      }
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
