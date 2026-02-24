/**
 * server.js - Main Express Application Entry Point
 *
 * This file wires together all the pieces of the backend:
 *   1. Loads environment variables
 *   2. Creates the Express application
 *   3. Configures middleware (CORS, JSON parsing)
 *   4. Mounts all API route modules
 *   5. Creates an HTTP server and attaches Socket.io to it
 *   6. Starts listening on the configured port
 */

// ── 1. Load Environment Variables ────────────────────────────────────────────
// dotenv reads the .env file in the project root and injects every key=value
// pair into process.env BEFORE anything else runs.
require("dotenv").config();

const express = require("express");
const http = require("http"); // Node's built-in HTTP module (needed for Socket.io)
const { Server } = require("socket.io"); // Socket.io server class
const cors = require("cors"); // Cross-Origin Resource Sharing
const rateLimit = require("express-rate-limit"); // Brute-force / DDoS protection

// Import route handlers
const authRoutes = require("./routes/auth");
const groupRoutes = require("./routes/groups");
const chatRoutes = require("./routes/chat");
const notesRoutes = require("./routes/notes");
const taskRoutes = require("./routes/tasks");

// Import the Socket.io event-handler setup function
const { setupSocketHandlers } = require("./socket/socketHandler");

// ── 2. Create Express App ─────────────────────────────────────────────────────
const app = express();

// ── 3. Configure Middleware ───────────────────────────────────────────────────

/**
 * CORS (Cross-Origin Resource Sharing)
 * Allows the React frontend (running on a different port) to call this API.
 * In production, replace FRONTEND_URL with your actual deployed frontend domain.
 */
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true, // allow cookies / auth headers
  })
);

/**
 * JSON Body Parser
 * Parses incoming requests with JSON payloads and makes them available as req.body.
 * The limit is set to 2mb to accommodate the shared-notes content.
 */
app.use(express.json({ limit: "2mb" }));

// Parse URL-encoded form data (standard HTML form submissions)
app.use(express.urlencoded({ extended: true }));

// ── Rate Limiting ──────────────────────────────────────────────────────────
/**
 * Strict limiter for auth endpoints – prevents brute-force attacks on login/register.
 * Allows 20 requests per 15-minute window per IP.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests from this IP. Please try again later." },
});

/**
 * General API limiter – applied to all other /api routes.
 * Allows 200 requests per 15-minute window per IP.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests from this IP. Please try again later." },
});

// ── 4. Mount Route Modules ────────────────────────────────────────────────────
// All routes are prefixed with /api so they're easy to proxy in production.

app.use("/api/auth", authLimiter, authRoutes);    // Authentication (register, login, Google)
app.use("/api/groups", apiLimiter, groupRoutes);  // Study group management
app.use("/api/chat", apiLimiter, chatRoutes);     // Chat messages
app.use("/api/notes", apiLimiter, notesRoutes);   // Shared notes
app.use("/api/tasks", apiLimiter, taskRoutes);    // Task management

// Health-check endpoint – useful for load balancers and uptime monitors
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── 5. Global Error-Handling Middleware ───────────────────────────────────────
// Must be defined AFTER all routes; Express recognises it by the 4-param signature.
// This catches any error passed to next(err) from route handlers.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({
    message: err.message || "An unexpected server error occurred.",
  });
});

// ── 6. Create HTTP Server & Attach Socket.io ──────────────────────────────────
/**
 * We wrap the Express app in a plain http.Server so that Socket.io can share
 * the same port instead of needing a separate WebSocket port.
 */
const httpServer = http.createServer(app);

/**
 * Socket.io server configuration.
 * The cors settings here mirror the Express CORS config above.
 */
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
  // Increase ping timeout for slower connections (default: 20 000 ms)
  pingTimeout: 60000,
});

// Make the io instance accessible inside route handlers via req.app.get('io')
// This lets HTTP routes (e.g., POST /api/chat/:groupId/messages) also emit events.
app.set("io", io);

// Register all Socket.io event listeners
setupSocketHandlers(io);

// ── 7. Start Listening ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} (${process.env.NODE_ENV || "development"} mode)`);
  console.log(`   REST API : http://localhost:${PORT}/api`);
  console.log(`   Health   : http://localhost:${PORT}/health`);
});

module.exports = { app, httpServer }; // export for testing
