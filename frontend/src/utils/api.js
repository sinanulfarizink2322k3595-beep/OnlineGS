/**
 * utils/api.js - Axios API Utility
 *
 * Central place for all HTTP communication with the backend REST API.
 * Using a single axios instance ensures every request automatically carries
 * the JWT auth header and 401 responses are handled consistently.
 *
 * Structure:
 *   apiClient       - Configured axios instance (used internally)
 *   authAPI         - Auth-related endpoints
 *   groupsAPI       - Group management endpoints
 *   chatAPI         - Chat message endpoints
 *   notesAPI        - Shared notes endpoints
 *   tasksAPI        - Task management endpoints
 */

import axios from "axios";

// ─────────────────────────────────────────────────────────────────────────────
// Create the shared axios instance
// ─────────────────────────────────────────────────────────────────────────────
const apiClient = axios.create({
  // Base URL comes from the .env file (REACT_APP_API_URL=http://localhost:5000/api)
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000, // 15-second timeout; fail fast rather than hang indefinitely
});

// ─────────────────────────────────────────────────────────────────────────────
// Request interceptor – attach JWT to every outgoing request
// ─────────────────────────────────────────────────────────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    // Read the token from localStorage on every request so it's always fresh
    // (e.g., if it was updated in another tab)
    const token = localStorage.getItem("token");
    if (token) {
      // The server's auth middleware expects: "Authorization: Bearer <token>"
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─────────────────────────────────────────────────────────────────────────────
// Response interceptor – handle 401 Unauthorized globally
// ─────────────────────────────────────────────────────────────────────────────
apiClient.interceptors.response.use(
  // Pass successful responses straight through
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid → clear local storage and redirect to login.
      // We do a hard redirect (window.location) rather than a React Router navigate
      // because this interceptor runs outside the React component tree.
      localStorage.removeItem("token");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    // Re-throw so individual call sites can still catch and display errors
    return Promise.reject(error);
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Auth API
// ─────────────────────────────────────────────────────────────────────────────
export const authAPI = {
  /**
   * Register a new account.
   * @param {{ email, password, displayName }} data
   */
  register: (data) => apiClient.post("/auth/register", data),

  /**
   * Log in with email + password.
   * @param {{ email, password }} data
   */
  login: (data) => apiClient.post("/auth/login", data),

  /**
   * Exchange a Google ID token for our own JWT.
   * @param {{ googleToken }} data
   */
  loginWithGoogle: (data) => apiClient.post("/auth/google", data),

  /**
   * Get the current user's profile (requires valid JWT).
   * Optionally pass a token directly (used during session restore).
   * @param {string} [token]
   */
  getMe: (token) =>
    apiClient.get("/auth/me", {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Groups API
// ─────────────────────────────────────────────────────────────────────────────
export const groupsAPI = {
  /** Get all groups the current user belongs to. */
  getGroups: () => apiClient.get("/groups"),

  /**
   * Create a new study group.
   * @param {{ name, description }} data
   */
  createGroup: (data) => apiClient.post("/groups", data),

  /**
   * Get details for a specific group.
   * @param {string} groupId
   */
  getGroup: (groupId) => apiClient.get(`/groups/${groupId}`),

  /**
   * Join a group using its invite code.
   * @param {string} groupId
   * @param {string} inviteCode
   */
  joinGroup: (groupId, inviteCode) =>
    apiClient.post(`/groups/${groupId}/join`, { inviteCode }),

  /**
   * Leave a group.
   * @param {string} groupId
   */
  leaveGroup: (groupId) => apiClient.post(`/groups/${groupId}/leave`),

  /**
   * Get the member list for a group.
   * @param {string} groupId
   */
  getGroupMembers: (groupId) => apiClient.get(`/groups/${groupId}/members`),
};

// ─────────────────────────────────────────────────────────────────────────────
// Chat API
// ─────────────────────────────────────────────────────────────────────────────
export const chatAPI = {
  /**
   * Fetch message history for a group.
   * @param {string} groupId
   * @param {number} [limit=50]
   * @param {string} [before] - ISO timestamp cursor for pagination
   */
  getMessages: (groupId, limit = 50, before = null) => {
    const params = { limit };
    if (before) params.before = before;
    return apiClient.get(`/chat/${groupId}/messages`, { params });
  },

  /**
   * Post a message (HTTP fallback; real-time delivery uses socket).
   * @param {string} groupId
   * @param {string} text
   */
  sendMessage: (groupId, text) =>
    apiClient.post(`/chat/${groupId}/messages`, { text }),

  /**
   * Delete a message (only the sender can do this).
   * @param {string} groupId
   * @param {string} messageId
   */
  deleteMessage: (groupId, messageId) =>
    apiClient.delete(`/chat/${groupId}/messages/${messageId}`),
};

// ─────────────────────────────────────────────────────────────────────────────
// Notes API
// ─────────────────────────────────────────────────────────────────────────────
export const notesAPI = {
  /**
   * Get the current note content for a group.
   * @param {string} groupId
   */
  getNote: (groupId) => apiClient.get(`/notes/${groupId}`),

  /**
   * Save (overwrite) the shared note.
   * @param {string} groupId
   * @param {string} content - HTML string from the rich-text editor
   */
  updateNote: (groupId, content) =>
    apiClient.put(`/notes/${groupId}`, { content }),

  /**
   * Get the last 10 saved versions of a group's note.
   * @param {string} groupId
   */
  getNoteHistory: (groupId) => apiClient.get(`/notes/${groupId}/history`),
};

// ─────────────────────────────────────────────────────────────────────────────
// Tasks API
// ─────────────────────────────────────────────────────────────────────────────
export const tasksAPI = {
  /**
   * List all tasks for a group.
   * @param {string} groupId
   */
  getTasks: (groupId) => apiClient.get(`/tasks/${groupId}`),

  /**
   * Create a new task.
   * @param {string} groupId
   * @param {{ title, description, assignee, dueDate }} data
   */
  createTask: (groupId, data) => apiClient.post(`/tasks/${groupId}`, data),

  /**
   * Update task fields.
   * @param {string} groupId
   * @param {string} taskId
   * @param {object} data
   */
  updateTask: (groupId, taskId, data) =>
    apiClient.put(`/tasks/${groupId}/${taskId}`, data),

  /**
   * Delete a task.
   * @param {string} groupId
   * @param {string} taskId
   */
  deleteTask: (groupId, taskId) =>
    apiClient.delete(`/tasks/${groupId}/${taskId}`),

  /**
   * Toggle task completion.
   * @param {string} groupId
   * @param {string} taskId
   * @param {boolean} completed
   */
  completeTask: (groupId, taskId, completed) =>
    apiClient.patch(`/tasks/${groupId}/${taskId}/complete`, { completed }),
};

export default apiClient;
