/**
 * utils/socket.js - Socket.io Client Utility
 *
 * Creates and manages the Socket.io connection to the backend.
 * Exporting individual functions (rather than the raw socket) keeps the
 * rest of the app decoupled from Socket.io implementation details.
 *
 * Typical usage in a React component:
 *
 *   import { connectSocket, joinGroup, onMessage, disconnectSocket } from '../utils/socket';
 *
 *   useEffect(() => {
 *     connectSocket(token);
 *     joinGroup(groupId);
 *     const unsubscribe = onMessage((msg) => setMessages(prev => [...prev, msg]));
 *     return () => {
 *       unsubscribe();
 *       disconnectSocket();
 *     };
 *   }, [groupId, token]);
 */

import { io } from "socket.io-client";

// The socket.io client instance – starts as null until connectSocket() is called
let socket = null;

// ─────────────────────────────────────────────────────────────────────────────
// connectSocket
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Create (or reuse) the Socket.io connection.
 *
 * The JWT is passed in the `auth` handshake data so the server middleware
 * can verify it before the 'connection' event fires.
 *
 * @param {string} token - JWT from localStorage / AuthContext
 * @returns {import('socket.io-client').Socket}
 */
export const connectSocket = (token) => {
  // Reuse an existing connected socket instead of opening a second connection
  if (socket && socket.connected) return socket;

  // The server URL (without /api suffix – socket.io uses its own path)
  const serverUrl =
    process.env.REACT_APP_SOCKET_URL ||
    (process.env.REACT_APP_API_URL || "http://localhost:5000/api").replace(
      "/api",
      ""
    );

  socket = io(serverUrl, {
    // Pass the JWT in the handshake so the server can authenticate the socket
    auth: { token },
    // Automatically try to reconnect if the connection drops
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    // Use WebSocket transport first, fall back to polling if necessary
    transports: ["websocket", "polling"],
  });

  // ── Connection lifecycle logs (helpful for debugging) ────────────────────
  socket.on("connect", () => {
    console.log("🔌 Socket connected:", socket.id);
  });

  socket.on("disconnect", (reason) => {
    console.log("❌ Socket disconnected:", reason);
  });

  socket.on("connect_error", (err) => {
    console.error("Socket connection error:", err.message);
  });

  return socket;
};

// ─────────────────────────────────────────────────────────────────────────────
// disconnectSocket
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Gracefully close the Socket.io connection and nullify the reference.
 * Call this in component cleanup (useEffect return function) or on logout.
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// getSocket
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Returns the current socket instance (may be null if not connected).
 * Use this when you need direct socket access for edge cases.
 * @returns {import('socket.io-client').Socket | null}
 */
export const getSocket = () => socket;

// ─────────────────────────────────────────────────────────────────────────────
// joinGroup
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Tell the server to add this socket to the group's room.
 * The server verifies group membership before allowing entry.
 *
 * @param {string} groupId
 */
export const joinGroup = (groupId) => {
  if (!socket) {
    console.warn("joinGroup: socket is not connected");
    return;
  }
  socket.emit("join_group", { groupId });
};

// ─────────────────────────────────────────────────────────────────────────────
// leaveGroup
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Tell the server to remove this socket from the group's room.
 *
 * @param {string} groupId
 */
export const leaveGroup = (groupId) => {
  if (!socket) return;
  socket.emit("leave_group", { groupId });
};

// ─────────────────────────────────────────────────────────────────────────────
// sendMessage
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Emit a chat message to the server.
 * The server saves it to Firestore and broadcasts it to the room.
 *
 * @param {string} groupId
 * @param {string} text
 */
export const sendMessage = (groupId, text) => {
  if (!socket) {
    console.warn("sendMessage: socket is not connected");
    return;
  }
  socket.emit("send_message", { groupId, text });
};

// ─────────────────────────────────────────────────────────────────────────────
// onMessage
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Subscribe to incoming chat messages.
 * Returns an unsubscribe function – call it in the useEffect cleanup.
 *
 * @param {(message: object) => void} callback
 * @returns {() => void} unsubscribe function
 */
export const onMessage = (callback) => {
  if (!socket) return () => {};
  socket.on("new_message", callback);
  // Return a cleanup function that removes this specific listener
  return () => socket.off("new_message", callback);
};

// ─────────────────────────────────────────────────────────────────────────────
// onMessageDeleted
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Subscribe to message-deleted events.
 *
 * @param {(data: { messageId: string, groupId: string }) => void} callback
 * @returns {() => void}
 */
export const onMessageDeleted = (callback) => {
  if (!socket) return () => {};
  socket.on("message_deleted", callback);
  return () => socket.off("message_deleted", callback);
};

// ─────────────────────────────────────────────────────────────────────────────
// emitTyping / emitStopTyping
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Notify the server (and other clients) that this user is typing.
 * @param {string} groupId
 */
export const emitTyping = (groupId) => {
  if (!socket) return;
  socket.emit("typing", { groupId });
};

/**
 * Notify the server that this user stopped typing.
 * @param {string} groupId
 */
export const emitStopTyping = (groupId) => {
  if (!socket) return;
  socket.emit("stop_typing", { groupId });
};

// ─────────────────────────────────────────────────────────────────────────────
// onTyping / onStopTyping
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Subscribe to typing indicators from other users.
 *
 * @param {(data: { userId, displayName, groupId }) => void} callback
 * @returns {() => void}
 */
export const onTyping = (callback) => {
  if (!socket) return () => {};
  socket.on("typing", callback);
  return () => socket.off("typing", callback);
};

/**
 * Subscribe to stop-typing events.
 *
 * @param {(data: { userId, groupId }) => void} callback
 * @returns {() => void}
 */
export const onStopTyping = (callback) => {
  if (!socket) return () => {};
  socket.on("stop_typing", callback);
  return () => socket.off("stop_typing", callback);
};

// ─────────────────────────────────────────────────────────────────────────────
// onUserJoined / onUserLeft
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Subscribe to user-joined events (for the online presence list).
 *
 * @param {(data: { userId, displayName }) => void} callback
 * @returns {() => void}
 */
export const onUserJoined = (callback) => {
  if (!socket) return () => {};
  socket.on("user_joined", callback);
  return () => socket.off("user_joined", callback);
};

/**
 * Subscribe to user-left events.
 *
 * @param {(data: { userId, displayName }) => void} callback
 * @returns {() => void}
 */
export const onUserLeft = (callback) => {
  if (!socket) return () => {};
  socket.on("user_left", callback);
  return () => socket.off("user_left", callback);
};

/**
 * Subscribe to the initial online-users snapshot sent when joining a room.
 *
 * @param {(data: { groupId, users: Array }) => void} callback
 * @returns {() => void}
 */
export const onOnlineUsers = (callback) => {
  if (!socket) return () => {};
  socket.on("online_users", callback);
  return () => socket.off("online_users", callback);
};
