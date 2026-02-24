/**
 * auth.js - JWT Authentication Middleware
 *
 * Express middleware that protects routes by verifying JSON Web Tokens (JWT).
 * Any route that requires a logged-in user should use this middleware.
 *
 * Usage in a route file:
 *   const authMiddleware = require('../middleware/auth');
 *   router.get('/protected', authMiddleware, (req, res) => { ... });
 *
 * After this middleware runs successfully, the decoded user payload is available
 * on `req.user` for the next handler to use.
 */

const jwt = require("jsonwebtoken");

/**
 * verifyToken - Express middleware function
 *
 * @param {import('express').Request}  req  - Express request object
 * @param {import('express').Response} res  - Express response object
 * @param {import('express').NextFunction} next - Calls the next middleware/handler
 */
const verifyToken = (req, res, next) => {
  // ── Step 1: Extract the token from the Authorization header ──────────────
  // The client sends: "Authorization: Bearer <token>"
  // We split on the space and take the second part.
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // No header or wrong format → reject immediately
    return res
      .status(401)
      .json({ message: "Access denied. No token provided." });
  }

  // Split "Bearer eyJ..." → ["Bearer", "eyJ..."] and grab index 1
  const token = authHeader.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ message: "Access denied. Token is missing." });
  }

  // ── Step 2: Verify the token signature and expiry ────────────────────────
  // jwt.verify() throws an error if:
  //   - The signature doesn't match (tampered token)
  //   - The token has expired (TokenExpiredError)
  //   - The token is malformed (JsonWebTokenError)
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ── Step 3: Attach the decoded payload to the request object ───────────
    // The payload we stored when signing the token (see auth routes) contains
    // { userId, email, displayName }.  Downstream handlers access it via req.user.
    req.user = decoded;

    // ── Step 4: Pass control to the next handler ────────────────────────────
    next();
  } catch (error) {
    // Distinguish between expired tokens and other JWT errors for clearer messages
    if (error.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ message: "Token has expired. Please log in again." });
    }

    // Any other verification failure (invalid signature, malformed, etc.)
    return res
      .status(401)
      .json({ message: "Invalid token. Please log in again." });
  }
};

module.exports = verifyToken;
