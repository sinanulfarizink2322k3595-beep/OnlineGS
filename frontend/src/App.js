/**
 * App.js - Root Application Component
 *
 * Defines the top-level route structure and wraps the whole app in
 * the AuthProvider so every component can access authentication state.
 *
 * Route map:
 *   /              → redirects to /dashboard (if logged in) or /login
 *   /login         → Login page
 *   /register      → Register page
 *   /dashboard     → Dashboard (protected – requires login)
 *   /group/:groupId→ Group workspace (protected)
 */

import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";

// Page components
import Dashboard from "./pages/Dashboard";
import GroupPage from "./pages/GroupPage";

// Auth components
import Login from "./components/Auth/Login";
import Register from "./components/Auth/Register";

// ─────────────────────────────────────────────────────────────────────────────
// ProtectedRoute - wrapper that redirects unauthenticated users to /login
// ─────────────────────────────────────────────────────────────────────────────
/**
 * If the user is not logged in, render a <Navigate> redirect to /login.
 * Otherwise render the child component/element as-is.
 *
 * @param {{ children: React.ReactNode }} props
 */
const ProtectedRoute = ({ children }) => {
  const { token, loading } = useAuth();

  // While the auth context is initialising (e.g., reading from localStorage),
  // show a full-screen spinner so the route doesn't flash incorrectly.
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  // No token → redirect to login; 'replace' prevents a back-button loop
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// ─────────────────────────────────────────────────────────────────────────────
// AppRoutes - declares the route tree inside AuthProvider's context
// ─────────────────────────────────────────────────────────────────────────────
const AppRoutes = () => {
  const { token } = useAuth();

  return (
    <Routes>
      {/* Root: redirect based on auth status */}
      <Route
        path="/"
        element={<Navigate to={token ? "/dashboard" : "/login"} replace />}
      />

      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/group/:groupId"
        element={
          <ProtectedRoute>
            <GroupPage />
          </ProtectedRoute>
        }
      />

      {/* Catch-all: send unknown paths back to root */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// App - Top-level component that provides auth context to everything below
// ─────────────────────────────────────────────────────────────────────────────
const App = () => {
  return (
    // AuthProvider must wrap all routes so every page has access to auth state
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
};

export default App;
