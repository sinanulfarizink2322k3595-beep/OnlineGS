/**
 * components/Auth/Login.jsx - Login Page
 *
 * Allows users to sign in with email + password or via Google OAuth.
 * On success the AuthContext stores the JWT and the router redirects to /dashboard.
 */

import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

// ─────────────────────────────────────────────────────────────────────────────
// Login Component
// ─────────────────────────────────────────────────────────────────────────────
const Login = () => {
  const navigate = useNavigate();
  const { login, loginWithGoogle } = useAuth();

  // ── Form state ─────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  // ── Input change handler ────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear field-level error when user starts typing again
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  // ── Client-side validation ──────────────────────────────────────────────────
  const validate = () => {
    const newErrors = {};
    if (!formData.email.trim()) {
      newErrors.email = "Email is required.";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address.";
    }
    if (!formData.password) {
      newErrors.password = "Password is required.";
    }
    return newErrors;
  };

  // ── Email/password submit ───────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");

    // Run client-side validation before hitting the API
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      await login(formData.email, formData.password);
      navigate("/dashboard");
    } catch (err) {
      // Display the server-returned error message (e.g., "Invalid email or password")
      setServerError(
        err.response?.data?.message || "Login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Google OAuth login ──────────────────────────────────────────────────────
  /**
   * Triggers the browser's Google sign-in popup via the Google Identity Services SDK.
   * The SDK must be loaded in index.html (we rely on window.google being available).
   */
  const handleGoogleLogin = () => {
    setServerError("");

    if (!window.google) {
      setServerError(
        "Google Sign-In is not available. Please check your configuration."
      );
      return;
    }

    // Initialize the Google OAuth client and prompt the consent screen
    window.google.accounts.id.initialize({
      client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
      callback: async (response) => {
        // response.credential is the Google ID token
        setLoading(true);
        try {
          await loginWithGoogle(response.credential);
          navigate("/dashboard");
        } catch (err) {
          setServerError(
            err.response?.data?.message || "Google login failed. Please try again."
          );
        } finally {
          setLoading(false);
        }
      },
    });

    window.google.accounts.id.prompt();
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center">
            <div className="h-16 w-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-3xl">📚</span>
            </div>
          </div>
          <h1 className="mt-4 text-3xl font-extrabold text-gray-900">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Sign in to your OnlineGS account
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl px-8 py-10 space-y-6">
          {/* Server-level error banner */}
          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {serverError}
            </div>
          )}

          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Email field */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className={`w-full px-4 py-2.5 border rounded-lg text-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  errors.email
                    ? "border-red-400 bg-red-50"
                    : "border-gray-300 bg-white"
                }`}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-500">{errors.email}</p>
              )}
            </div>

            {/* Password field */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                className={`w-full px-4 py-2.5 border rounded-lg text-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  errors.password
                    ? "border-red-400 bg-red-50"
                    : "border-gray-300 bg-white"
                }`}
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-500">{errors.password}</p>
              )}
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {loading && (
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
              )}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-gray-400 font-medium">
                or continue with
              </span>
            </div>
          </div>

          {/* Google login button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {/* Google "G" logo SVG */}
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign in with Google
          </button>
        </div>

        {/* Link to register */}
        <p className="text-center text-sm text-gray-500">
          Don't have an account?{" "}
          <Link
            to="/register"
            className="font-medium text-indigo-600 hover:text-indigo-500"
          >
            Create one for free
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
