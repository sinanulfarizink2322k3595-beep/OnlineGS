/**
 * components/Groups/JoinGroup.jsx - Join Group via Invite Code
 *
 * Renders a small form (modal or inline) where users can enter an 8-character
 * invite code to join a study group. On success it calls onJoined with the group data.
 */

import React, { useState } from "react";
import { groupsAPI } from "../../utils/api";

/**
 * @param {{
 *   groupId?: string,   // if known (from URL), supply it; otherwise the backend will look it up
 *   onJoined: (group) => void,
 *   onClose: () => void
 * }} props
 *
 * NOTE: The backend join endpoint requires a groupId in the URL path.
 * Because we share invite codes as just the code (no groupId embedded),
 * we first search by invite code to discover the groupId, then call join.
 * For simplicity this component uses a two-field form (groupId + code) which
 * is the clearest UX for this demo.
 */
const JoinGroup = ({ onJoined, onClose }) => {
  const [formData, setFormData] = useState({ groupId: "", inviteCode: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Auto-uppercase the invite code as the user types
    const formatted = name === "inviteCode" ? value.toUpperCase() : value;
    setFormData((prev) => ({ ...prev, [name]: formatted }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const errs = {};
    if (!formData.groupId.trim()) errs.groupId = "Group ID is required.";
    if (!formData.inviteCode.trim()) errs.inviteCode = "Invite code is required.";
    else if (formData.inviteCode.trim().length !== 8)
      errs.inviteCode = "Invite codes are exactly 8 characters.";
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      const response = await groupsAPI.joinGroup(
        formData.groupId.trim(),
        formData.inviteCode.trim()
      );
      onJoined(response.data.group);
    } catch (err) {
      setServerError(
        err.response?.data?.message || "Failed to join group. Check the ID and code."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    // Modal overlay
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="join-group-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2
            id="join-group-title"
            className="text-xl font-bold text-gray-900"
          >
            Join a Study Group
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {serverError && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Group ID */}
          <div>
            <label
              htmlFor="jg-groupId"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Group ID <span className="text-red-500">*</span>
            </label>
            <input
              id="jg-groupId"
              name="groupId"
              type="text"
              value={formData.groupId}
              onChange={handleChange}
              placeholder="Paste the group ID here"
              className={`w-full px-4 py-2.5 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
                errors.groupId ? "border-red-400 bg-red-50" : "border-gray-300"
              }`}
            />
            {errors.groupId && (
              <p className="mt-1 text-xs text-red-500">{errors.groupId}</p>
            )}
            <p className="mt-1 text-xs text-gray-400">
              Ask the group admin for the Group ID (shown in the group card).
            </p>
          </div>

          {/* Invite Code */}
          <div>
            <label
              htmlFor="jg-code"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Invite Code <span className="text-red-500">*</span>
            </label>
            <input
              id="jg-code"
              name="inviteCode"
              type="text"
              maxLength={8}
              value={formData.inviteCode}
              onChange={handleChange}
              placeholder="e.g. A3F9B2C1"
              className={`w-full px-4 py-2.5 border rounded-lg text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
                errors.inviteCode
                  ? "border-red-400 bg-red-50"
                  : "border-gray-300"
              }`}
            />
            {errors.inviteCode && (
              <p className="mt-1 text-xs text-red-500">{errors.inviteCode}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex justify-center items-center gap-2 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {loading && (
                <svg
                  className="animate-spin h-4 w-4"
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
              {loading ? "Joining…" : "Join Group"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JoinGroup;
