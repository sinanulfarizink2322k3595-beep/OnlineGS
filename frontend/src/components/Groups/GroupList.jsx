/**
 * components/Groups/GroupList.jsx - User's Group List
 *
 * Fetches and displays all study groups the current user belongs to.
 * Provides quick navigation into each group workspace.
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { groupsAPI } from "../../utils/api";

/**
 * @param {{ onGroupSelect?: (group) => void }} props
 */
const GroupList = ({ onGroupSelect }) => {
  const navigate = useNavigate();

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ── Fetch groups on mount ─────────────────────────────────────────────────
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const response = await groupsAPI.getGroups();
        setGroups(response.data.groups || []);
      } catch (err) {
        setError("Failed to load groups. Please refresh the page.");
        console.error("Fetch groups error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchGroups();
  }, []);

  // ── Navigate into a group workspace ──────────────────────────────────────
  const handleGroupClick = (group) => {
    if (onGroupSelect) {
      onGroupSelect(group);
    } else {
      navigate(`/group/${group.groupId}`);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
        {error}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-3">📖</div>
        <p className="text-gray-500 text-sm">
          You haven't joined any groups yet.
        </p>
        <p className="text-gray-400 text-xs mt-1">
          Create or join a group to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((group) => (
        <button
          key={group.groupId}
          onClick={() => handleGroupClick(group)}
          className="text-left bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition p-5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {/* Colored avatar using first letter of group name */}
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg flex-shrink-0">
              {group.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">
                {group.name}
              </h3>
              <p className="text-xs text-gray-400">
                {group.members?.length || 0} member
                {(group.members?.length || 0) !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* Description (truncated to 2 lines) */}
          {group.description && (
            <p className="text-sm text-gray-500 line-clamp-2">
              {group.description}
            </p>
          )}

          {/* Invite code (greyed out) */}
          <div className="mt-3 flex items-center gap-1">
            <span className="text-xs text-gray-400">Code:</span>
            <span className="text-xs font-mono text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">
              {group.inviteCode}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
};

export default GroupList;
