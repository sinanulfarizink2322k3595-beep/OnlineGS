/**
 * socket/socketHandler.js - WebSocket Event Handler
 *
 * Manages all real-time communication between clients using Socket.io.
 * Each study group maps to a Socket.io "room" identified by its groupId.
 *
 * Events the server LISTENS for (from clients):
 *   authenticate  - Client sends JWT; server verifies and tags the socket
 *   join_group    - Client joins a group room to receive that group's events
 *   leave_group   - Client leaves a group room
 *   send_message  - Client sends a chat message; server persists + broadcasts
 *   typing        - Client is typing; server broadcasts indicator to room
 *   stop_typing   - Client stopped typing
 *
 * Events the server EMITS (to clients):
 *   authenticated       - Sent back to confirm successful authentication
 *   auth_error          - Sent when JWT verification fails
 *   new_message         - Broadcast to room when a new message arrives
 *   typing              - Broadcast to room (except sender) showing who's typing
 *   stop_typing         - Broadcast to room when someone stops typing
 *   user_joined         - Broadcast when a user joins a room
 *   user_left           - Broadcast when a user leaves / disconnects
 *   online_users        - Current list of online users in a room (sent on join)
 */

const jwt = require("jsonwebtoken");
const { db } = require("../config/firebase");

/**
 * onlineUsers keeps track of who is currently connected to which groups.
 * Structure: { [groupId]: Set<{ userId, displayName, socketId }> }
 *
 * We use a Map of Sets so we can efficiently add/remove users and broadcast
 * the current presence list to newly joining clients.
 */
const onlineUsers = new Map();

/**
 * Adds a user to the in-memory online-users map for a group.
 * @param {string} groupId
 * @param {{ userId: string, displayName: string, socketId: string }} userInfo
 */
const addOnlineUser = (groupId, userInfo) => {
  if (!onlineUsers.has(groupId)) {
    onlineUsers.set(groupId, new Map());
  }
  // Key by userId so the same user with multiple tabs doesn't appear twice
  onlineUsers.get(groupId).set(userInfo.userId, userInfo);
};

/**
 * Removes a user from the online-users map for a group.
 * @param {string} groupId
 * @param {string} userId
 */
const removeOnlineUser = (groupId, userId) => {
  if (onlineUsers.has(groupId)) {
    onlineUsers.get(groupId).delete(userId);
    if (onlineUsers.get(groupId).size === 0) {
      onlineUsers.delete(groupId); // clean up empty groups
    }
  }
};

/**
 * Returns an array of online-user objects for a group.
 * @param {string} groupId
 * @returns {Array}
 */
const getOnlineUsers = (groupId) => {
  if (!onlineUsers.has(groupId)) return [];
  return Array.from(onlineUsers.get(groupId).values());
};

// ─────────────────────────────────────────────────────────────────────────────
// Main exported handler – called in server.js with the io instance
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Registers all Socket.io event listeners.
 * Called once with the io instance in server.js:
 *   const { setupSocketHandlers } = require('./socket/socketHandler');
 *   setupSocketHandlers(io);
 *
 * @param {import('socket.io').Server} io - The Socket.io server instance
 */
const setupSocketHandlers = (io) => {
  // ── Middleware: authenticate every incoming socket connection ───────────────
  // The client passes `auth: { token }` when calling io({ auth: { token } })
  // This middleware runs before the 'connection' event.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      // Allow the connection but mark it as unauthenticated.
      // The socket will still work but join/message events will be rejected.
      socket.user = null;
      return next();
    }

    try {
      // Verify the JWT and attach the decoded payload to the socket object
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded; // { userId, email, displayName }
      next();
    } catch (err) {
      // Reject the connection if the token is invalid/expired
      next(new Error("Authentication failed: " + err.message));
    }
  });

  // ── Handle each new socket connection ──────────────────────────────────────
  io.on("connection", (socket) => {
    console.log(
      `🔌 Socket connected: ${socket.id} | User: ${
        socket.user?.displayName || "unauthenticated"
      }`
    );

    // Track which groups this specific socket has joined so we can clean up on disconnect
    const joinedGroups = new Set();

    // ── Event: join_group ─────────────────────────────────────────────────────
    /**
     * Client sends: { groupId: "abc123" }
     * Server joins the socket to that room and broadcasts presence.
     */
    socket.on("join_group", async ({ groupId } = {}) => {
      if (!socket.user) {
        socket.emit("error", { message: "Authentication required." });
        return;
      }

      if (!groupId) {
        socket.emit("error", { message: "groupId is required." });
        return;
      }

      try {
        // Verify the user is actually a member of the group before admitting them
        const groupSnap = await db.collection("groups").doc(groupId).get();
        if (!groupSnap.exists) {
          socket.emit("error", { message: "Group not found." });
          return;
        }

        const isMember = groupSnap
          .data()
          .members.some((m) => m.userId === socket.user.userId);

        if (!isMember) {
          socket.emit("error", {
            message: "You are not a member of this group.",
          });
          return;
        }

        // Join the Socket.io room (groupId doubles as room name)
        socket.join(groupId);
        joinedGroups.add(groupId);

        // Add to in-memory presence map
        addOnlineUser(groupId, {
          userId: socket.user.userId,
          displayName: socket.user.displayName,
          socketId: socket.id,
        });

        // Tell everyone else in the room that a new user arrived
        socket.to(groupId).emit("user_joined", {
          userId: socket.user.userId,
          displayName: socket.user.displayName,
        });

        // Send the new user a snapshot of who's already online
        socket.emit("online_users", {
          groupId,
          users: getOnlineUsers(groupId),
        });

        console.log(
          `👥 ${socket.user.displayName} joined room ${groupId}`
        );
      } catch (err) {
        console.error("join_group error:", err);
        socket.emit("error", { message: "Error joining group." });
      }
    });

    // ── Event: leave_group ────────────────────────────────────────────────────
    /**
     * Client sends: { groupId: "abc123" }
     * Server removes the socket from the room and broadcasts departure.
     */
    socket.on("leave_group", ({ groupId } = {}) => {
      if (!groupId) return;

      socket.leave(groupId);
      joinedGroups.delete(groupId);

      removeOnlineUser(groupId, socket.user?.userId);

      // Notify remaining room members
      socket.to(groupId).emit("user_left", {
        userId: socket.user?.userId,
        displayName: socket.user?.displayName,
      });

      console.log(
        `👋 ${socket.user?.displayName} left room ${groupId}`
      );
    });

    // ── Event: send_message ───────────────────────────────────────────────────
    /**
     * Client sends: { groupId, text }
     * Server saves the message to Firestore then broadcasts it to all room members
     * (including the sender so they have the server-assigned messageId).
     */
    socket.on("send_message", async ({ groupId, text } = {}) => {
      if (!socket.user) {
        socket.emit("error", { message: "Authentication required." });
        return;
      }

      if (!groupId || !text?.trim()) {
        socket.emit("error", { message: "groupId and text are required." });
        return;
      }

      if (text.trim().length > 2000) {
        socket.emit("error", {
          message: "Message must be 2000 characters or less.",
        });
        return;
      }

      try {
        // Persist the message to Firestore
        const msgRef = db.collection("messages").doc();
        const message = {
          messageId: msgRef.id,
          groupId,
          senderId: socket.user.userId,
          senderEmail: socket.user.email,
          senderName: socket.user.displayName,
          text: text.trim(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await msgRef.set(message);

        // Broadcast to every socket in the room (including sender)
        io.to(groupId).emit("new_message", message);
      } catch (err) {
        console.error("send_message error:", err);
        socket.emit("error", { message: "Error sending message." });
      }
    });

    // ── Event: typing ─────────────────────────────────────────────────────────
    /**
     * Client sends: { groupId }
     * Server relays the typing indicator to everyone else in the room.
     */
    socket.on("typing", ({ groupId } = {}) => {
      if (!socket.user || !groupId) return;

      // socket.to() sends to everyone in the room EXCEPT the sender
      socket.to(groupId).emit("typing", {
        userId: socket.user.userId,
        displayName: socket.user.displayName,
        groupId,
      });
    });

    // ── Event: stop_typing ────────────────────────────────────────────────────
    /**
     * Client sends: { groupId }
     * Server clears the typing indicator for this user in the room.
     */
    socket.on("stop_typing", ({ groupId } = {}) => {
      if (!socket.user || !groupId) return;

      socket.to(groupId).emit("stop_typing", {
        userId: socket.user.userId,
        groupId,
      });
    });

    // ── Event: disconnect ─────────────────────────────────────────────────────
    /**
     * Automatically fired when the client disconnects (tab closed, network lost, etc.).
     * We remove the user from every group's online list and broadcast their departure.
     */
    socket.on("disconnect", () => {
      console.log(
        `❌ Socket disconnected: ${socket.id} | User: ${
          socket.user?.displayName || "unknown"
        }`
      );

      // Clean up presence for every group this socket had joined
      joinedGroups.forEach((groupId) => {
        removeOnlineUser(groupId, socket.user?.userId);

        io.to(groupId).emit("user_left", {
          userId: socket.user?.userId,
          displayName: socket.user?.displayName,
        });
      });

      joinedGroups.clear();
    });
  });
};

module.exports = { setupSocketHandlers };
