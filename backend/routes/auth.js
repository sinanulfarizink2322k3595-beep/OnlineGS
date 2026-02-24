/**
 * routes/auth.js - Authentication Routes
 *
 * Handles user registration, login (email/password and Google OAuth),
 * and retrieval of the current authenticated user's profile.
 *
 * Base path: /api/auth  (mounted in server.js)
 *
 * Routes:
 *   POST   /api/auth/register  - Create a new account with email + password
 *   POST   /api/auth/login     - Sign in with email + password
 *   POST   /api/auth/google    - Sign in / register via Google ID token
 *   GET    /api/auth/me        - Get current user info (requires JWT)
 */

const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const { OAuth2Client } = require("google-auth-library");

// Firebase Firestore instance
const { db } = require("../config/firebase");

// JWT auth middleware (protects the /me route)
const verifyToken = require("../middleware/auth");

// Google OAuth client – used to verify the ID token sent from the frontend
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Generate a signed JWT for a given user payload
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Creates a JWT containing the user's id, email, and display name.
 * The token is signed with the JWT_SECRET env var and expires per JWT_EXPIRES_IN.
 *
 * @param {object} user - { userId, email, displayName }
 * @returns {string} Signed JWT string
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user.userId,
      email: user.email,
      displayName: user.displayName,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Register a new user with email and password.
 * Steps:
 *  1. Validate request body (express-validator)
 *  2. Check if email is already registered in Firestore
 *  3. Hash the password with bcrypt (cost factor 12)
 *  4. Save the new user document to Firestore "users" collection
 *  5. Return a signed JWT so the user is immediately logged in
 */
router.post(
  "/register",
  [
    // Validation rules – checked before the handler runs
    body("email").isEmail().withMessage("Please provide a valid email address"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long"),
    body("displayName")
      .trim()
      .notEmpty()
      .withMessage("Display name is required"),
  ],
  async (req, res) => {
    // ── 1. Check for validation errors ───────────────────────────────────────
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, displayName } = req.body;

    try {
      // ── 2. Check for duplicate email ────────────────────────────────────────
      const existingUser = await db
        .collection("users")
        .where("email", "==", email.toLowerCase())
        .limit(1)
        .get();

      if (!existingUser.empty) {
        return res
          .status(409)
          .json({ message: "An account with this email already exists." });
      }

      // ── 3. Hash the password ────────────────────────────────────────────────
      // bcrypt.hash(password, saltRounds) – 12 rounds is a good balance of
      // security vs. performance for a web app.
      const hashedPassword = await bcrypt.hash(password, 12);

      // ── 4. Save user to Firestore ───────────────────────────────────────────
      const newUserRef = db.collection("users").doc(); // auto-generate doc ID
      const newUser = {
        userId: newUserRef.id,
        email: email.toLowerCase(),
        displayName: displayName.trim(),
        passwordHash: hashedPassword,
        provider: "email", // distinguish from Google-login users
        groups: [], // list of group IDs the user belongs to
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await newUserRef.set(newUser);

      // ── 5. Issue JWT ────────────────────────────────────────────────────────
      const token = generateToken({
        userId: newUser.userId,
        email: newUser.email,
        displayName: newUser.displayName,
      });

      // Return token + safe user object (no passwordHash)
      res.status(201).json({
        message: "Account created successfully",
        token,
        user: {
          userId: newUser.userId,
          email: newUser.email,
          displayName: newUser.displayName,
          provider: newUser.provider,
        },
      });
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({ message: "Server error during registration." });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Log in an existing user with email and password.
 * Steps:
 *  1. Validate request body
 *  2. Find user document by email in Firestore
 *  3. Compare supplied password against stored bcrypt hash
 *  4. Return a signed JWT on success
 */
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Please provide a valid email address"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
    // ── 1. Validate inputs ────────────────────────────────────────────────────
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      // ── 2. Fetch user from Firestore ─────────────────────────────────────────
      const userSnapshot = await db
        .collection("users")
        .where("email", "==", email.toLowerCase())
        .limit(1)
        .get();

      if (userSnapshot.empty) {
        // Use a generic message so we don't leak which emails are registered
        return res
          .status(401)
          .json({ message: "Invalid email or password." });
      }

      const userData = userSnapshot.docs[0].data();

      // Make sure this user registered with email (not Google-only)
      if (!userData.passwordHash) {
        return res.status(401).json({
          message:
            "This account was created with Google. Please use Google login.",
        });
      }

      // ── 3. Verify password ───────────────────────────────────────────────────
      const isMatch = await bcrypt.compare(password, userData.passwordHash);
      if (!isMatch) {
        return res
          .status(401)
          .json({ message: "Invalid email or password." });
      }

      // ── 4. Issue JWT ─────────────────────────────────────────────────────────
      const token = generateToken({
        userId: userData.userId,
        email: userData.email,
        displayName: userData.displayName,
      });

      res.json({
        message: "Login successful",
        token,
        user: {
          userId: userData.userId,
          email: userData.email,
          displayName: userData.displayName,
          provider: userData.provider,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Server error during login." });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/google
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Google OAuth login / registration.
 *
 * The frontend completes the Google OAuth flow and receives a Google ID token.
 * It sends that token here; we verify it with Google's servers, then create
 * or update the corresponding Firestore user and return our own JWT.
 *
 * This way the rest of the app only deals with our JWT – not Google tokens.
 */
router.post(
  "/google",
  [body("googleToken").notEmpty().withMessage("Google ID token is required")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { googleToken } = req.body;

    try {
      // ── Verify the Google ID token ───────────────────────────────────────────
      // verifyIdToken checks the token's signature, expiry, and audience (client ID).
      const ticket = await googleClient.verifyIdToken({
        idToken: googleToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      // payload fields: sub (Google user id), email, name, picture, email_verified
      const { sub: googleId, email, name: displayName, picture } = payload;

      // ── Upsert user in Firestore ─────────────────────────────────────────────
      // We store Google users keyed by their Google UID for idempotency.
      const userRef = db.collection("users").doc(`google_${googleId}`);
      const userSnap = await userRef.get();

      let userData;

      if (!userSnap.exists) {
        // First-time Google login → create the user document
        userData = {
          userId: userRef.id,
          email: email.toLowerCase(),
          displayName,
          photoURL: picture || null,
          provider: "google",
          googleId,
          groups: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await userRef.set(userData);
      } else {
        // Returning Google user → update display name and photo in case they changed
        userData = userSnap.data();
        await userRef.update({
          displayName,
          photoURL: picture || null,
          updatedAt: new Date().toISOString(),
        });
      }

      // ── Issue our own JWT ────────────────────────────────────────────────────
      const token = generateToken({
        userId: userData.userId,
        email: userData.email,
        displayName: userData.displayName,
      });

      res.json({
        message: "Google login successful",
        token,
        user: {
          userId: userData.userId,
          email: userData.email,
          displayName: userData.displayName,
          provider: userData.provider,
          photoURL: userData.photoURL,
        },
      });
    } catch (error) {
      console.error("Google login error:", error);
      // Don't expose internal details; just say the token was invalid
      res.status(401).json({ message: "Invalid Google token." });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me  (Protected)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Return the currently authenticated user's profile.
 * The verifyToken middleware populates req.user from the JWT before this runs.
 */
router.get("/me", verifyToken, async (req, res) => {
  try {
    // req.user.userId was set by the auth middleware when it decoded the JWT
    const userSnap = await db
      .collection("users")
      .doc(req.user.userId)
      .get();

    if (!userSnap.exists) {
      return res.status(404).json({ message: "User not found." });
    }

    const userData = userSnap.data();

    // Return user info without the sensitive passwordHash field
    res.json({
      userId: userData.userId,
      email: userData.email,
      displayName: userData.displayName,
      photoURL: userData.photoURL || null,
      provider: userData.provider,
      groups: userData.groups || [],
      createdAt: userData.createdAt,
    });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({ message: "Server error fetching user profile." });
  }
});

module.exports = router;
