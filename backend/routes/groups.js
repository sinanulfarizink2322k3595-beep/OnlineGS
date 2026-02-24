/**
 * routes/groups.js - Study Group Management Routes
 *
 * Provides CRUD operations for study groups.
 * All routes require a valid JWT (via verifyToken middleware).
 *
 * Base path: /api/groups  (mounted in server.js)
 *
 * Routes:
 *   POST   /api/groups                    - Create a new group
 *   GET    /api/groups                    - List groups the current user belongs to
 *   GET    /api/groups/:groupId           - Get details for a single group
 *   POST   /api/groups/:groupId/join      - Join a group using its invite code
 *   POST   /api/groups/:groupId/leave     - Leave a group
 *   GET    /api/groups/:groupId/members   - List members of a group
 */

const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const { body, validationResult } = require("express-validator");

const { db } = require("../config/firebase");
const verifyToken = require("../middleware/auth");

// Apply auth middleware to every route in this file
router.use(verifyToken);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/groups
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Create a new study group.
 * The creator is automatically added as a member with the "admin" role.
 * A unique 8-character invite code is generated for sharing.
 */
router.post(
  "/",
  [
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Group name is required")
      .isLength({ max: 80 })
      .withMessage("Group name must be 80 characters or less"),
    body("description")
      .optional()
      .isLength({ max: 500 })
      .withMessage("Description must be 500 characters or less"),
  ],
  async (req, res) => {
    // Validate inputs
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description = "" } = req.body;
    const { userId, email, displayName } = req.user; // from JWT payload

    try {
      // ── Create the group document ─────────────────────────────────────────
      const groupRef = db.collection("groups").doc();
      // Generate a short, uppercase invite code (e.g. "A3F9B2C1")
      const inviteCode = uuidv4().replace(/-/g, "").slice(0, 8).toUpperCase();

      const groupData = {
        groupId: groupRef.id,
        name: name.trim(),
        description: description.trim(),
        inviteCode,
        createdBy: userId,
        // Members array stores lightweight user info so we don't need an extra
        // Firestore read every time we display the member list.
        members: [
          {
            userId,
            email,
            displayName,
            role: "admin", // creator gets admin role
            joinedAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await groupRef.set(groupData);

      // ── Also record the group ID on the user's document ───────────────────
      // We use Firestore's arrayUnion to append without overwriting other groups.
      await db
        .collection("users")
        .doc(userId)
        .update({
          groups: require("firebase-admin").firestore.FieldValue.arrayUnion(
            groupRef.id
          ),
          updatedAt: new Date().toISOString(),
        });

      res.status(201).json({
        message: "Group created successfully",
        group: groupData,
      });
    } catch (error) {
      console.error("Create group error:", error);
      res.status(500).json({ message: "Server error creating group." });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/groups
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Return all groups that the current user is a member of.
 * We look up the user's `groups` array and fetch each group document.
 */
router.get("/", async (req, res) => {
  const { userId } = req.user;

  try {
    // Fetch the user document to get their list of group IDs
    const userSnap = await db.collection("users").doc(userId).get();

    if (!userSnap.exists) {
      return res.status(404).json({ message: "User not found." });
    }

    const groupIds = userSnap.data().groups || [];

    if (groupIds.length === 0) {
      return res.json({ groups: [] });
    }

    // Firestore `in` queries support up to 30 items per query.
    // For a real app with potentially more groups, batch in chunks of 30.
    const chunks = [];
    for (let i = 0; i < groupIds.length; i += 30) {
      chunks.push(groupIds.slice(i, i + 30));
    }

    const groupDocs = [];
    for (const chunk of chunks) {
      const snap = await db
        .collection("groups")
        .where("groupId", "in", chunk)
        .get();
      snap.forEach((doc) => groupDocs.push(doc.data()));
    }

    res.json({ groups: groupDocs });
  } catch (error) {
    console.error("Get groups error:", error);
    res.status(500).json({ message: "Server error fetching groups." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/groups/:groupId
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Get details for a specific group.
 * Only members of the group are allowed to view it.
 */
router.get("/:groupId", async (req, res) => {
  const { groupId } = req.params;
  const { userId } = req.user;

  try {
    const groupSnap = await db.collection("groups").doc(groupId).get();

    if (!groupSnap.exists) {
      return res.status(404).json({ message: "Group not found." });
    }

    const group = groupSnap.data();

    // Verify the requesting user is a member
    const isMember = group.members.some((m) => m.userId === userId);
    if (!isMember) {
      return res
        .status(403)
        .json({ message: "You are not a member of this group." });
    }

    res.json({ group });
  } catch (error) {
    console.error("Get group error:", error);
    res.status(500).json({ message: "Server error fetching group." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/groups/:groupId/join
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Join a group using its invite code.
 * Body must contain: { inviteCode: "XXXXXXXX" }
 */
router.post(
  "/:groupId/join",
  [
    body("inviteCode")
      .trim()
      .notEmpty()
      .withMessage("Invite code is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { groupId } = req.params;
    const { inviteCode } = req.body;
    const { userId, email, displayName } = req.user;

    try {
      const groupRef = db.collection("groups").doc(groupId);
      const groupSnap = await groupRef.get();

      if (!groupSnap.exists) {
        return res.status(404).json({ message: "Group not found." });
      }

      const group = groupSnap.data();

      // Validate the invite code (case-insensitive comparison)
      if (group.inviteCode.toUpperCase() !== inviteCode.toUpperCase()) {
        return res.status(400).json({ message: "Invalid invite code." });
      }

      // Prevent duplicate membership
      const alreadyMember = group.members.some((m) => m.userId === userId);
      if (alreadyMember) {
        return res
          .status(409)
          .json({ message: "You are already a member of this group." });
      }

      // Append the new member to the members array
      const newMember = {
        userId,
        email,
        displayName,
        role: "member",
        joinedAt: new Date().toISOString(),
      };

      const { FieldValue } = require("firebase-admin").firestore;

      await groupRef.update({
        members: FieldValue.arrayUnion(newMember),
        updatedAt: new Date().toISOString(),
      });

      // Also update the user's groups list
      await db
        .collection("users")
        .doc(userId)
        .update({
          groups: FieldValue.arrayUnion(groupId),
          updatedAt: new Date().toISOString(),
        });

      res.json({ message: "Successfully joined the group.", group });
    } catch (error) {
      console.error("Join group error:", error);
      res.status(500).json({ message: "Server error joining group." });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/groups/:groupId/leave
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Leave a group.
 * If the leaving user is the only admin, the request is rejected
 * unless they are also the last member (in which case we delete the group).
 */
router.post("/:groupId/leave", async (req, res) => {
  const { groupId } = req.params;
  const { userId } = req.user;

  try {
    const groupRef = db.collection("groups").doc(groupId);
    const groupSnap = await groupRef.get();

    if (!groupSnap.exists) {
      return res.status(404).json({ message: "Group not found." });
    }

    const group = groupSnap.data();

    // Confirm the user is actually a member
    const memberEntry = group.members.find((m) => m.userId === userId);
    if (!memberEntry) {
      return res
        .status(400)
        .json({ message: "You are not a member of this group." });
    }

    const remainingMembers = group.members.filter((m) => m.userId !== userId);

    if (remainingMembers.length === 0) {
      // Last member leaving → delete the entire group
      await groupRef.delete();
    } else {
      // Make sure there's still at least one admin after leaving
      const hasOtherAdmin = remainingMembers.some((m) => m.role === "admin");
      if (memberEntry.role === "admin" && !hasOtherAdmin) {
        // Promote the first remaining member to admin automatically
        remainingMembers[0].role = "admin";
      }

      await groupRef.update({
        members: remainingMembers,
        updatedAt: new Date().toISOString(),
      });
    }

    // Remove the group from the user's list
    const { FieldValue } = require("firebase-admin").firestore;
    await db
      .collection("users")
      .doc(userId)
      .update({
        groups: FieldValue.arrayRemove(groupId),
        updatedAt: new Date().toISOString(),
      });

    res.json({ message: "Successfully left the group." });
  } catch (error) {
    console.error("Leave group error:", error);
    res.status(500).json({ message: "Server error leaving group." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/groups/:groupId/members
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Return the member list for a group.
 * Caller must be a member of the group.
 */
router.get("/:groupId/members", async (req, res) => {
  const { groupId } = req.params;
  const { userId } = req.user;

  try {
    const groupSnap = await db.collection("groups").doc(groupId).get();

    if (!groupSnap.exists) {
      return res.status(404).json({ message: "Group not found." });
    }

    const group = groupSnap.data();

    // Access control: only members can see the member list
    const isMember = group.members.some((m) => m.userId === userId);
    if (!isMember) {
      return res
        .status(403)
        .json({ message: "You are not a member of this group." });
    }

    res.json({ members: group.members });
  } catch (error) {
    console.error("Get members error:", error);
    res.status(500).json({ message: "Server error fetching members." });
  }
});

module.exports = router;
