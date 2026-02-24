/**
 * routes/notes.js - Shared Notes Routes
 *
 * Each group has one shared "live document" (note).
 * Any member can view or edit it; every save creates a history snapshot
 * so the team can see who changed what and when.
 *
 * Base path: /api/notes  (mounted in server.js)
 *
 * Routes:
 *   GET  /api/notes/:groupId          - Get the current note content
 *   PUT  /api/notes/:groupId          - Save (overwrite) the note content
 *   GET  /api/notes/:groupId/history  - Get the last 10 saved versions
 */

const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");

const { db } = require("../config/firebase");
const verifyToken = require("../middleware/auth");

// Protect all notes routes
router.use(verifyToken);

// ─────────────────────────────────────────────────────────────────────────────
// Helper: membership check (shared with other route files)
// ─────────────────────────────────────────────────────────────────────────────
const requireGroupMembership = async (groupId, userId) => {
  const groupSnap = await db.collection("groups").doc(groupId).get();
  if (!groupSnap.exists) {
    const err = new Error("Group not found.");
    err.status = 404;
    throw err;
  }
  const isMember = groupSnap.data().members.some((m) => m.userId === userId);
  if (!isMember) {
    const err = new Error("You are not a member of this group.");
    err.status = 403;
    throw err;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/notes/:groupId
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Retrieve the current shared note for a group.
 * If no note has been created yet, returns an empty content string.
 *
 * The note document lives at: notes/{groupId}
 * (one document per group, keyed by groupId for easy lookup)
 */
router.get("/:groupId", async (req, res) => {
  const { groupId } = req.params;
  const { userId } = req.user;

  try {
    await requireGroupMembership(groupId, userId);

    const noteSnap = await db.collection("notes").doc(groupId).get();

    if (!noteSnap.exists) {
      // Return a default empty note – the document will be created on first save
      return res.json({
        note: {
          groupId,
          content: "",
          lastEditedBy: null,
          lastEditedAt: null,
        },
      });
    }

    res.json({ note: noteSnap.data() });
  } catch (error) {
    console.error("Get note error:", error);
    res
      .status(error.status || 500)
      .json({ message: error.message || "Server error fetching note." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/notes/:groupId
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Save (upsert) the shared note for a group.
 * Before overwriting, the current version is copied into the `noteHistory`
 * sub-collection so the history endpoint can return it later.
 *
 * Body: { content: "<html or delta string from rich-text editor>" }
 */
router.put(
  "/:groupId",
  [
    body("content")
      .exists()
      .withMessage("content field is required (may be empty string)"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { groupId } = req.params;
    const { userId, displayName } = req.user;
    const { content } = req.body;

    try {
      await requireGroupMembership(groupId, userId);

      const noteRef = db.collection("notes").doc(groupId);
      const noteSnap = await noteRef.get();

      // ── Archive the previous version before overwriting ───────────────────
      if (noteSnap.exists) {
        const prevData = noteSnap.data();
        // Store snapshot in noteHistory sub-collection
        await noteRef.collection("noteHistory").add({
          content: prevData.content,
          savedBy: prevData.lastEditedBy,
          savedAt: prevData.lastEditedAt,
          archivedAt: new Date().toISOString(),
        });
      }

      // ── Write the new version ─────────────────────────────────────────────
      const now = new Date().toISOString();
      const noteData = {
        groupId,
        content,
        lastEditedBy: { userId, displayName },
        lastEditedAt: now,
        updatedAt: now,
      };

      // set() with merge: true creates the document if it doesn't exist
      await noteRef.set(noteData, { merge: true });

      // Optionally notify other group members that the note changed
      const io = req.app.get("io");
      if (io) {
        io.to(groupId).emit("note_updated", {
          groupId,
          lastEditedBy: { userId, displayName },
          lastEditedAt: now,
        });
      }

      res.json({ message: "Note saved successfully.", note: noteData });
    } catch (error) {
      console.error("Save note error:", error);
      res
        .status(error.status || 500)
        .json({ message: error.message || "Server error saving note." });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/notes/:groupId/history
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Return the last 10 archived versions of a group's note.
 * Sorted by archivedAt descending (most recent first).
 */
router.get("/:groupId/history", async (req, res) => {
  const { groupId } = req.params;
  const { userId } = req.user;

  try {
    await requireGroupMembership(groupId, userId);

    const historySnap = await db
      .collection("notes")
      .doc(groupId)
      .collection("noteHistory")
      .orderBy("archivedAt", "desc")
      .limit(10)
      .get();

    const history = [];
    historySnap.forEach((doc) => history.push({ id: doc.id, ...doc.data() }));

    res.json({ history });
  } catch (error) {
    console.error("Get note history error:", error);
    res
      .status(error.status || 500)
      .json({ message: error.message || "Server error fetching note history." });
  }
});

module.exports = router;
