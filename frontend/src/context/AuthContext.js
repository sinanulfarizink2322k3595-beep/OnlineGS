/**
 * context/AuthContext.js - Authentication Context
 *
 * Provides global authentication state and helper functions to every component
 * in the tree via React Context.
 *
 * What's provided:
 *   currentUser  - The decoded user object { userId, email, displayName, ... }
 *   token        - The raw JWT string (also stored in localStorage)
 *   loading      - true while we're reading the initial token from localStorage
 *   login()      - Sign in with email + password
 *   register()   - Create account with email, password, and display name
 *   loginWithGoogle() - Sign in / register using a Google ID token
 *   logout()     - Clear session
 *
 * Usage in any component:
 *   import { useAuth } from '../context/AuthContext';
 *   const { currentUser, login, logout } = useAuth();
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authAPI } from "../utils/api";

// ── Create the context object ──────────────────────────────────────────────
const AuthContext = createContext(null);

// ── AuthProvider – wrap your app in this component ────────────────────────
/**
 * @param {{ children: React.ReactNode }} props
 */
export const AuthProvider = ({ children }) => {
  // The JWT string – null when logged out
  const [token, setToken] = useState(null);

  // Decoded user payload from the JWT; null when logged out
  const [currentUser, setCurrentUser] = useState(null);

  // True while we're reading the persisted token from localStorage on first load
  const [loading, setLoading] = useState(true);

  // ── Persist token helpers ───────────────────────────────────────────────
  /**
   * Saves the JWT to localStorage so the user stays logged in across page refreshes.
   * Also updates the in-memory token state used by protected routes.
   */
  const persistToken = useCallback((jwt, user) => {
    localStorage.setItem("token", jwt);
    setToken(jwt);
    setCurrentUser(user);
  }, []);

  /**
   * Removes all auth data and redirects to login.
   */
  const clearSession = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
    setCurrentUser(null);
  }, []);

  // ── On mount: restore session from localStorage ─────────────────────────
  /**
   * When the app first loads, check whether a JWT was saved previously.
   * If so, call /api/auth/me to verify the token is still valid and get
   * fresh user data (in case the display name changed, for example).
   */
  useEffect(() => {
    const restoreSession = async () => {
      const savedToken = localStorage.getItem("token");

      if (!savedToken) {
        setLoading(false);
        return;
      }

      try {
        // Verify token against the server and get up-to-date user info
        const response = await authAPI.getMe(savedToken);
        setToken(savedToken);
        setCurrentUser(response.data);
      } catch {
        // Token is expired or invalid – clear it so the user is redirected to login
        clearSession();
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, [clearSession]);

  // ── login() ─────────────────────────────────────────────────────────────
  /**
   * Authenticate with email + password.
   * On success, stores the JWT and updates currentUser.
   * On failure, throws the error so the Login component can display it.
   *
   * @param {string} email
   * @param {string} password
   * @returns {Promise<void>}
   */
  const login = async (email, password) => {
    const response = await authAPI.login({ email, password });
    const { token: jwt, user } = response.data;
    persistToken(jwt, user);
  };

  // ── register() ─────────────────────────────────────────────────────────
  /**
   * Create a new account and immediately log the user in.
   *
   * @param {string} email
   * @param {string} password
   * @param {string} displayName
   * @returns {Promise<void>}
   */
  const register = async (email, password, displayName) => {
    const response = await authAPI.register({ email, password, displayName });
    const { token: jwt, user } = response.data;
    persistToken(jwt, user);
  };

  // ── loginWithGoogle() ───────────────────────────────────────────────────
  /**
   * Exchange a Google ID token for our own JWT.
   * The frontend must complete the Google OAuth flow first to obtain googleToken.
   *
   * @param {string} googleToken - Google ID token from the OAuth flow
   * @returns {Promise<void>}
   */
  const loginWithGoogle = async (googleToken) => {
    const response = await authAPI.loginWithGoogle({ googleToken });
    const { token: jwt, user } = response.data;
    persistToken(jwt, user);
  };

  // ── logout() ────────────────────────────────────────────────────────────
  /**
   * Clear the session.  The router in App.js will redirect to /login
   * because `token` becomes null and ProtectedRoute redirects.
   */
  const logout = () => {
    clearSession();
  };

  // ── Context value ────────────────────────────────────────────────────────
  const value = {
    currentUser,
    token,
    loading,
    login,
    register,
    loginWithGoogle,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ── useAuth hook – convenient shorthand for consumers ─────────────────────
/**
 * Custom hook that returns the auth context value.
 * Must be used inside a component wrapped by <AuthProvider>.
 *
 * @returns {{ currentUser, token, loading, login, register, loginWithGoogle, logout }}
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside an <AuthProvider>");
  }
  return context;
};

export default AuthContext;
