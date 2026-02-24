/**
 * components/Groups/CreateGroup.jsx - Create Group Modal
 *
 * Renders a modal dialog with a form to create a new study group.
 * On success, calls the onCreated callback so the parent can refresh its group list.
 */

import React, { useState } from "react";
import { groupsAPI } from "../../utils/api";

/**
 * @param {{ onCreated: (group) => void, onClose: () => void }} props
 *   onCreated - called with the new group object after successful creation
 *   onClose   - called when the user dismisses the modal
 */
const CreateGroup = ({ onCreated, onClose }) => {
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  // ── Input handler ──────────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = "Group name is required.";
    else if (formData.name.trim().length > 80)
      errs.name = "Name must be 80 characters or less.";
    if (formData.description.length > 500)
      errs.description = "Description must be 500 characters or less.";
    return errs;
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
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
      const response = await groupsAPI.createGroup({
        name: formData.name.trim(),
        description: formData.description.trim(),
      });
      onCreated(response.data.group);
    } catch (err) {
      setServerError(
        err.response?.data?.message || "Failed to create group. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    // Overlay backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-group-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2
            id="create-group-title"
            className="text-xl font-bold text-gray-900"
          >
            Create a Study Group
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* Server error */}
        {serverError && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Group name */}
          <div>
            <label
              htmlFor="cg-name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Group Name <span className="text-red-500">*</span>
            </label>
            <input
              id="cg-name"
              name="name"
              type="text"
              maxLength={80}
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. Calculus Study Crew"
              className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
                errors.name ? "border-red-400 bg-red-50" : "border-gray-300"
              }`}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="cg-desc"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Description{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="cg-desc"
              name="description"
              rows={3}
              maxLength={500}
              value={formData.description}
              onChange={handleChange}
              placeholder="What will this group study?"
              className={`w-full px-4 py-2.5 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
                errors.description
                  ? "border-red-400 bg-red-50"
                  : "border-gray-300"
              }`}
            />
            <div className="flex justify-between mt-0.5">
              {errors.description ? (
                <p className="text-xs text-red-500">{errors.description}</p>
              ) : (
                <span />
              )}
              <span className="text-xs text-gray-400">
                {formData.description.length}/500
              </span>
            </div>
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
              {loading ? "Creating…" : "Create Group"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateGroup;
