/**
 * pages/GroupPage.jsx - Group Workspace
 *
 * The main collaboration page for a specific study group.
 * Three tabbed panels: Chat | Notes | Tasks
 * A sidebar lists group members and shows who is online.
 *
 * Layout (desktop):
 *   ┌─────────────────────────────────────────────────┐
 *   │  Header: group name + tabs + leave button        │
 *   ├──────────────────────────────────┬──────────────┤
 *   │  Active panel (Chat/Notes/Tasks) │  Member list  │
 *   └──────────────────────────────────┴──────────────┘
 */

import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { groupsAPI } from "../utils/api";
import Chat from "../components/Chat/Chat";
import NotesEditor from "../components/Notes/NotesEditor";
import Tasks from "../components/Tasks/Tasks";

// Tab identifiers
const TABS = ["chat", "notes", "tasks"];

// ─────────────────────────────────────────────────────────────────────────────
// GroupPage Component
// ─────────────────────────────────────────────────────────────────────────────
const GroupPage = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();

  // ── State ──────────────────────────────────────────────────────────────────
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("chat");
  const [leavingGroup, setLeavingGroup] = useState(false);
  // Mobile sidebar visibility
  const [showSidebar, setShowSidebar] = useState(false);

  // ── Load group data ────────────────────────────────────────────────────────
  useEffect(() => {
    const loadGroup = async () => {
      try {
        const response = await groupsAPI.getGroup(groupId);
        setGroup(response.data.group);
      } catch (err) {
        if (err.response?.status === 403) {
          setError("You are not a member of this group.");
        } else if (err.response?.status === 404) {
          setError("Group not found.");
        } else {
          setError("Failed to load group. Please try again.");
        }
        console.error("Load group error:", err);
      } finally {
        setLoading(false);
      }
    };
    loadGroup();
  }, [groupId]);

  // ── Leave group ────────────────────────────────────────────────────────────
  const handleLeaveGroup = async () => {
    if (
      !window.confirm(
        "Are you sure you want to leave this group? You'll need a new invite code to rejoin."
      )
    )
      return;

    setLeavingGroup(true);
    try {
      await groupsAPI.leaveGroup(groupId);
      navigate("/dashboard");
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to leave group."
      );
    } finally {
      setLeavingGroup(false);
    }
  };

  // ── Loading / error states ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-6 py-4 text-sm max-w-md text-center">
          {error}
        </div>
        <Link
          to="/dashboard"
          className="text-sm text-indigo-600 hover:underline"
        >
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* ── Top header bar ─────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14 gap-4">
            {/* Back + group name */}
            <div className="flex items-center gap-3 min-w-0">
              <Link
                to="/dashboard"
                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                aria-label="Back to Dashboard"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 19.5L8.25 12l7.5-7.5"
                  />
                </svg>
              </Link>
              <div className="min-w-0">
                <h1 className="font-bold text-gray-900 text-base truncate">
                  {group?.name}
                </h1>
                <p className="text-xs text-gray-400 truncate hidden sm:block">
                  {group?.members?.length} member
                  {group?.members?.length !== 1 ? "s" : ""} ·{" "}
                  <span className="font-mono">{group?.inviteCode}</span>
                </p>
              </div>
            </div>

            {/* Tabs (hidden on very small screens) */}
            <nav className="hidden md:flex items-center gap-1">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition capitalize ${
                    activeTab === tab
                      ? "bg-indigo-100 text-indigo-700"
                      : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  {tab === "chat" && "💬 "}
                  {tab === "notes" && "📝 "}
                  {tab === "tasks" && "✅ "}
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </nav>

            {/* Right: sidebar toggle (mobile) + leave */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Mobile member list toggle */}
              <button
                className="md:hidden text-gray-500 hover:text-gray-700"
                onClick={() => setShowSidebar((v) => !v)}
                aria-label="Toggle member list"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>

              <button
                onClick={handleLeaveGroup}
                disabled={leavingGroup}
                className="text-xs text-red-500 hover:text-red-700 font-medium transition disabled:opacity-50"
              >
                {leavingGroup ? "Leaving…" : "Leave"}
              </button>
            </div>
          </div>

          {/* Mobile tab bar */}
          <div className="flex md:hidden border-t overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-xs font-medium capitalize whitespace-nowrap ${
                  activeTab === tab
                    ? "border-b-2 border-indigo-600 text-indigo-600"
                    : "text-gray-500"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Body: panel + sidebar ──────────────────────────────────────────── */}
      <div className="flex flex-1 max-w-7xl mx-auto w-full overflow-hidden">
        {/* Main panel */}
        <main
          className="flex-1 overflow-hidden"
          style={{ height: "calc(100vh - 3.5rem)" }}
        >
          {activeTab === "chat" && <Chat groupId={groupId} />}
          {activeTab === "notes" && <NotesEditor groupId={groupId} />}
          {activeTab === "tasks" && (
            <Tasks groupId={groupId} members={group?.members || []} />
          )}
        </main>

        {/* Sidebar: member list */}
        <aside
          className={`w-56 flex-shrink-0 bg-white border-l border-gray-200 overflow-y-auto transition-all ${
            showSidebar ? "block" : "hidden md:block"
          }`}
          style={{ height: "calc(100vh - 3.5rem)" }}
        >
          <div className="p-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Members
            </h3>
            <ul className="space-y-2">
              {(group?.members || []).map((member) => (
                <li key={member.userId} className="flex items-center gap-2">
                  {/* Avatar */}
                  <div className="h-7 w-7 rounded-full bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-semibold flex-shrink-0">
                    {member.displayName?.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 truncate font-medium">
                      {member.displayName}
                    </p>
                    <p className="text-xs text-gray-400 capitalize">
                      {member.role}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            {/* Invite code section */}
            <div className="mt-6 pt-4 border-t">
              <p className="text-xs text-gray-400 mb-1">Invite Code</p>
              <div className="flex items-center gap-1">
                <code className="text-sm font-mono bg-gray-100 text-gray-700 rounded px-2 py-1 flex-1 text-center tracking-widest">
                  {group?.inviteCode}
                </code>
                <button
                  onClick={() =>
                    navigator.clipboard?.writeText(group?.inviteCode || "")
                  }
                  className="text-xs text-gray-400 hover:text-indigo-600 transition"
                  aria-label="Copy invite code"
                >
                  📋
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Group ID: <span className="font-mono text-xs">{groupId.slice(0, 8)}…</span>
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default GroupPage;
