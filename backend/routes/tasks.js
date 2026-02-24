/**
 * routes/tasks.js - Task Management Routes
 *
 * Groups can create shared task lists to track study assignments,
 * project milestones, or any collaborative to-do items.
 *
 * Base path: /api/tasks  (mounted in server.js)
 *
 * Routes:
 *   GET    /api/tasks/:groupId              - List all tasks for a group
 *   POST   /api/tasks/:groupId              - Create a new task
 *   PUT    /api/tasks/:groupId/:taskId      - Update a task (title, desc, assignee, dueDate)
 *   DELETE /api/tasks/:groupId/:taskId      - Delete a task
 *   PATCH  /api/tasks/:groupId/:taskId/complete - Toggle task completion status
 */

const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");

const { db } = require("../config/firebase");
const verifyToken = require("../middleware/auth");

// All task routes require a valid JWT
router.use(verifyToken);

// ─────────────────────────────────────────────────────────────────────────────
// Helper: membership check
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
// GET /api/tasks/:groupId
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Return all tasks for a group, ordered by creation time (oldest first).
 */
router.get("/:groupId", async (req, res) => {
  const { groupId } = req.params;
  const { userId } = req.user;

  try {
    await requireGroupMembership(groupId, userId);

    const tasksSnap = await db
      .collection("tasks")
      .where("groupId", "==", groupId)
      .orderBy("createdAt", "asc")
      .get();

    const tasks = [];
    tasksSnap.forEach((doc) => tasks.push(doc.data()));

    res.json({ tasks });
  } catch (error) {
    console.error("Get tasks error:", error);
    res
      .status(error.status || 500)
      .json({ message: error.message || "Server error fetching tasks." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tasks/:groupId
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Create a new task for a group.
 *
 * Body:
 *   title       - (required) Short task title
 *   description - (optional) Longer description
 *   assignee    - (optional) { userId, displayName } of the assigned member
 *   dueDate     - (optional) ISO date string (e.g. "2024-12-31")
 */
router.post(
  "/:groupId",
  [
    body("title")
      .trim()
      .notEmpty()
      .withMessage("Task title is required")
      .isLength({ max: 200 })
      .withMessage("Title must be 200 characters or less"),
    body("description")
      .optional()
      .isLength({ max: 1000 })
      .withMessage("Description must be 1000 characters or less"),
    body("dueDate")
      .optional()
      .isISO8601()
      .withMessage("dueDate must be a valid ISO 8601 date"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { groupId } = req.params;
    const { userId, displayName } = req.user;
    const { title, description = "", assignee = null, dueDate = null } =
      req.body;

    try {
      await requireGroupMembership(groupId, userId);

      const taskRef = db.collection("tasks").doc();
      const now = new Date().toISOString();

      const task = {
        taskId: taskRef.id,
        groupId,
        title: title.trim(),
        description: description.trim(),
        assignee, // null or { userId, displayName }
        dueDate,
        completed: false,
        completedAt: null,
        completedBy: null,
        createdBy: { userId, displayName },
        createdAt: now,
        updatedAt: now,
      };

      await taskRef.set(task);

      res.status(201).json({ message: "Task created successfully.", task });
    } catch (error) {
      console.error("Create task error:", error);
      res
        .status(error.status || 500)
        .json({ message: error.message || "Server error creating task." });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/tasks/:groupId/:taskId
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Update a task's editable fields.
 * Any group member can update any task (no ownership restriction).
 */
router.put(
  "/:groupId/:taskId",
  [
    body("title")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Title cannot be empty if provided")
      .isLength({ max: 200 }),
    body("description").optional().isLength({ max: 1000 }),
    body("dueDate").optional().isISO8601().withMessage("Invalid date format"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { groupId, taskId } = req.params;
    const { userId } = req.user;

    try {
      await requireGroupMembership(groupId, userId);

      const taskRef = db.collection("tasks").doc(taskId);
      const taskSnap = await taskRef.get();

      if (!taskSnap.exists) {
        return res.status(404).json({ message: "Task not found." });
      }

      // Ensure the task belongs to the specified group
      if (taskSnap.data().groupId !== groupId) {
        return res
          .status(400)
          .json({ message: "Task does not belong to this group." });
      }

      // Build a partial update object with only the fields that were sent
      const updates = { updatedAt: new Date().toISOString() };

      const { title, description, assignee, dueDate } = req.body;
      if (title !== undefined) updates.title = title.trim();
      if (description !== undefined) updates.description = description.trim();
      if (assignee !== undefined) updates.assignee = assignee;
      if (dueDate !== undefined) updates.dueDate = dueDate;

      await taskRef.update(updates);

      const updatedTask = (await taskRef.get()).data();
      res.json({ message: "Task updated successfully.", task: updatedTask });
    } catch (error) {
      console.error("Update task error:", error);
      res
        .status(error.status || 500)
        .json({ message: error.message || "Server error updating task." });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/tasks/:groupId/:taskId
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Delete a task permanently.
 * Any group member may delete any task (adjust to owner-only if desired).
 */
router.delete("/:groupId/:taskId", async (req, res) => {
  const { groupId, taskId } = req.params;
  const { userId } = req.user;

  try {
    await requireGroupMembership(groupId, userId);

    const taskRef = db.collection("tasks").doc(taskId);
    const taskSnap = await taskRef.get();

    if (!taskSnap.exists) {
      return res.status(404).json({ message: "Task not found." });
    }

    if (taskSnap.data().groupId !== groupId) {
      return res
        .status(400)
        .json({ message: "Task does not belong to this group." });
    }

    await taskRef.delete();

    res.json({ message: "Task deleted successfully." });
  } catch (error) {
    console.error("Delete task error:", error);
    res
      .status(error.status || 500)
      .json({ message: error.message || "Server error deleting task." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/tasks/:groupId/:taskId/complete
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Toggle a task's completion status.
 * Sends { completed: true/false } in the body.
 * Records who completed it and when (or clears those fields on un-complete).
 */
router.patch(
  "/:groupId/:taskId/complete",
  [
    body("completed")
      .isBoolean()
      .withMessage("completed must be a boolean value"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { groupId, taskId } = req.params;
    const { userId, displayName } = req.user;
    const { completed } = req.body;

    try {
      await requireGroupMembership(groupId, userId);

      const taskRef = db.collection("tasks").doc(taskId);
      const taskSnap = await taskRef.get();

      if (!taskSnap.exists) {
        return res.status(404).json({ message: "Task not found." });
      }

      if (taskSnap.data().groupId !== groupId) {
        return res
          .status(400)
          .json({ message: "Task does not belong to this group." });
      }

      const now = new Date().toISOString();
      await taskRef.update({
        completed,
        // Track completion metadata only when marking as done
        completedAt: completed ? now : null,
        completedBy: completed ? { userId, displayName } : null,
        updatedAt: now,
      });

      const updatedTask = (await taskRef.get()).data();
      res.json({
        message: `Task marked as ${completed ? "complete" : "incomplete"}.`,
        task: updatedTask,
      });
    } catch (error) {
      console.error("Complete task error:", error);
      res
        .status(error.status || 500)
        .json({ message: error.message || "Server error updating task." });
    }
  }
);

module.exports = router;
