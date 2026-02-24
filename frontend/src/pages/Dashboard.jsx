/**
 * pages/Dashboard.jsx - User Dashboard
 *
 * The main landing page after login.  Shows the user's groups and provides
 * buttons to create a new group or join one via invite code.
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import GroupList from "../components/Groups/GroupList";
import CreateGroup from "../components/Groups/CreateGroup";
import JoinGroup from "../components/Groups/JoinGroup";

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Page
// ─────────────────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  // Modal visibility flags
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  // Re-render GroupList by bumping a key when a new group is created/joined
  const [groupListKey, setGroupListKey] = useState(0);
  const refreshGroups = () => setGroupListKey((k) => k + 1);

  // ── Callbacks ──────────────────────────────────────────────────────────────
  const handleGroupCreated = (group) => {
    setShowCreate(false);
    refreshGroups();
    // Navigate straight into the new group
    navigate(`/group/${group.groupId}`);
  };

  const handleGroupJoined = (group) => {
    setShowJoin(false);
    refreshGroups();
    navigate(`/group/${group.groupId}`);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Top navigation bar ─────────────────────────────────────────────── */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo + brand name */}
            <div className="flex items-center gap-2">
              <span className="text-xl">📚</span>
              <span className="font-bold text-indigo-700 text-lg">OnlineGS</span>
            </div>

            {/* User menu */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold text-sm">
                  {currentUser?.displayName?.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-gray-700 font-medium">
                  {currentUser?.displayName}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-red-500 transition"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome banner */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {currentUser?.displayName?.split(" ")[0]} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Select a group to start studying, or create / join a new one.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition shadow-sm"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            Create Group
          </button>

          <button
            onClick={() => setShowJoin(true)}
            className="flex items-center gap-2 px-5 py-2.5 border border-indigo-300 text-indigo-700 rounded-xl text-sm font-semibold hover:bg-indigo-50 transition"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Join with Code
          </button>
        </div>

        {/* Group list */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Your Groups
          </h2>
          {/* key forces a remount (= re-fetch) when a group is added */}
          <GroupList key={groupListKey} />
        </section>
      </main>

      {/* Modals */}
      {showCreate && (
        <CreateGroup
          onCreated={handleGroupCreated}
          onClose={() => setShowCreate(false)}
        />
      )}

      {showJoin && (
        <JoinGroup
          onJoined={handleGroupJoined}
          onClose={() => setShowJoin(false)}
        />
      )}
    </div>
  );
};

export default Dashboard;
