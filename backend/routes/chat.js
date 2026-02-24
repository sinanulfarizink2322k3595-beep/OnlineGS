/**
 * routes/chat.js - Chat Message Routes
 *
 * REST endpoints for reading and writing chat messages stored in Firestore.
 * Real-time delivery is handled by Socket.io (see socket/socketHandler.js);
 * these HTTP routes act as the persistence layer and message history loader.
 *
 * Base path: /api/chat  (mounted in server.js)
 *
 * Routes:
 *   GET    /api/chat/:groupId/messages              - Paginated message history
 *   POST   /api/chat/:groupId/messages              - Post a new message
 *   DELETE /api/chat/:groupId/messages/:messageId   - Delete own message
 */

const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const { body, query, validationResult } = require("express-validator");

const { db } = require("../config/firebase");
const verifyToken = require("../middleware/auth");

// All chat routes require authentication
router.use(verifyToken);

// ─────────────────────────────────────────────────────────────────────────────
// Helper: ensure caller is a member of the group
// ─────────────────────────────────────────────────────────────────────────────
const requireGroupMembership = async (groupId, userId) => {
  const groupSnap = await db.collection("groups").doc(groupId).get();
  if (!groupSnap.exists) {
    const err = new Error("Group not found.");
    err.status = 404;
    throw err;
  }
  const group = groupSnap.data();
  const isMember = group.members.some((m) => m.userId === userId);
  if (!isMember) {
    const err = new Error("You are not a member of this group.");
    err.status = 403;
    throw err;
  }
  return group;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chat/:groupId/messages
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Retrieve recent messages for a group.
 *
 * Query parameters:
 *   limit  - Number of messages to return (default: 50, max: 100)
 *   before - ISO timestamp; returns messages sent before this time (pagination cursor)
 *
 * Messages are sorted newest-first from Firestore, then reversed before sending
 * so the client receives them in chronological order.
 */
router.get(
  "/:groupId/messages",
  [
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("limit must be between 1 and 100"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { groupId } = req.params;
    const { userId } = req.user;
    const limit = parseInt(req.query.limit, 10) || 50;
    const before = req.query.before; // optional ISO timestamp for pagination

    try {
      // Verify membership before exposing any messages
      await requireGroupMembership(groupId, userId);

      // Build the Firestore query
      let msgQuery = db
        .collection("messages")
        .where("groupId", "==", groupId)
        .orderBy("createdAt", "desc") // newest first so we get the latest N
        .limit(limit);

      // If a pagination cursor was supplied, only return messages before it
      if (before) {
        msgQuery = msgQuery.where("createdAt", "<", before);
      }

      const snap = await msgQuery.get();

      // Collect and reverse so client gets chronological order
      const messages = [];
      snap.forEach((doc) => messages.push(doc.data()));
      messages.reverse();

      res.json({ messages });
    } catch (error) {
      console.error("Get messages error:", error);
      res
        .status(error.status || 500)
        .json({ message: error.message || "Server error fetching messages." });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chat/:groupId/messages
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Post a new text message to a group chat.
 * The message is saved to Firestore and the route also emits a Socket.io event
 * so online users receive it in real time without polling.
 *
 * Body: { text: "Hello!" }
 */
router.post(
  "/:groupId/messages",
  [
    body("text")
      .trim()
      .notEmpty()
      .withMessage("Message text cannot be empty")
      .isLength({ max: 2000 })
      .withMessage("Message must be 2000 characters or less"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { groupId } = req.params;
    const { userId, email, displayName } = req.user;
    const { text } = req.body;

    try {
      await requireGroupMembership(groupId, userId);

      // Build the message document
      const messageRef = db.collection("messages").doc();
      const message = {
        messageId: messageRef.id,
        groupId,
        senderId: userId,
        senderEmail: email,
        senderName: displayName,
        text: text.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await messageRef.set(message);

      // ── Emit via Socket.io if the io instance is available ─────────────────
      // req.app.get('io') is set in server.js: app.set('io', io)
      // This allows HTTP-posted messages to also reach connected WebSocket clients.
      const io = req.app.get("io");
      if (io) {
        io.to(groupId).emit("new_message", message);
      }

      res.status(201).json({ message });
    } catch (error) {
      console.error("Post message error:", error);
      res
        .status(error.status || 500)
        .json({ message: error.message || "Server error posting message." });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/chat/:groupId/messages/:messageId
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Delete a specific message.
 * Only the original sender may delete their own messages.
 */
router.delete("/:groupId/messages/:messageId", async (req, res) => {
  const { groupId, messageId } = req.params;
  const { userId } = req.user;

  try {
    await requireGroupMembership(groupId, userId);

    const msgRef = db.collection("messages").doc(messageId);
    const msgSnap = await msgRef.get();

    if (!msgSnap.exists) {
      return res.status(404).json({ message: "Message not found." });
    }

    const msgData = msgSnap.data();

    // Confirm the requester is the sender
    if (msgData.senderId !== userId) {
      return res
        .status(403)
        .json({ message: "You can only delete your own messages." });
    }

    // Confirm the message belongs to the specified group (prevents cross-group deletion)
    if (msgData.groupId !== groupId) {
      return res.status(400).json({ message: "Message does not belong to this group." });
    }

    await msgRef.delete();

    // Notify connected clients that the message was removed
    const io = req.app.get("io");
    if (io) {
      io.to(groupId).emit("message_deleted", { messageId, groupId });
    }

    res.json({ message: "Message deleted successfully." });
  } catch (error) {
    console.error("Delete message error:", error);
    res
      .status(error.status || 500)
      .json({ message: error.message || "Server error deleting message." });
  }
});

module.exports = router;
