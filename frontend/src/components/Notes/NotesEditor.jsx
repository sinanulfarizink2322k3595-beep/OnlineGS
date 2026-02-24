/**
 * components/Notes/NotesEditor.jsx - Collaborative Shared Notes Editor
 *
 * Uses react-quill (a rich-text editor based on Quill.js) to provide
 * a WYSIWYG editing experience for the group's shared note document.
 *
 * Features:
 *  - Loads the current note from the API on mount
 *  - Auto-saves every 30 seconds if there are unsaved changes
 *  - Manual "Save" button for immediate persistence
 *  - Shows who last edited the note and when
 *  - Socket.io event notifies other group members when the note is saved
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css"; // Quill Snow theme CSS
import { format } from "date-fns";
import { notesAPI } from "../../utils/api";

// ── Quill toolbar configuration ────────────────────────────────────────────
// These buttons/dropdowns appear in the editor toolbar.
const TOOLBAR_OPTIONS = [
  [{ header: [1, 2, 3, false] }],
  ["bold", "italic", "underline", "strike"],
  [{ color: [] }, { background: [] }],
  [{ list: "ordered" }, { list: "bullet" }],
  [{ indent: "-1" }, { indent: "+1" }],
  ["blockquote", "code-block"],
  ["link"],
  ["clean"], // remove formatting
];

// ─────────────────────────────────────────────────────────────────────────────
// NotesEditor Component
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {{ groupId: string }} props
 */
const NotesEditor = ({ groupId }) => {
  // ── State ──────────────────────────────────────────────────────────────────
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState(""); // last known-good content
  const [lastEdit, setLastEdit] = useState(null); // { displayName, lastEditedAt }
  const [saving, setSaving] = useState(false);
  const [loadingNote, setLoadingNote] = useState(true);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  // Auto-save interval reference so we can clear it on unmount
  const autoSaveIntervalRef = useRef(null);
  // Track whether there are unsaved changes to avoid unnecessary API calls
  const hasUnsavedChanges = content !== savedContent;

  // ── Load note on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    const loadNote = async () => {
      try {
        const response = await notesAPI.getNote(groupId);
        const note = response.data.note;
        setContent(note.content || "");
        setSavedContent(note.content || "");
        if (note.lastEditedBy) {
          setLastEdit({
            displayName: note.lastEditedBy.displayName,
            lastEditedAt: note.lastEditedAt,
          });
        }
      } catch (err) {
        console.error("Load note error:", err);
        setSaveError("Failed to load note. Please refresh the page.");
      } finally {
        setLoadingNote(false);
      }
    };
    loadNote();
  }, [groupId]);

  // ── Save function ──────────────────────────────────────────────────────────
  /**
   * Persists the current editor content to the backend.
   * Also updates the savedContent state so hasUnsavedChanges resets to false.
   */
  const saveNote = useCallback(
    async (silent = false) => {
      if (!hasUnsavedChanges && !silent) return; // nothing new to save

      setSaving(true);
      setSaveError("");
      setSaveSuccess(false);

      try {
        const response = await notesAPI.updateNote(groupId, content);
        const note = response.data.note;

        // Mark current content as saved
        setSavedContent(content);

        // Update the "last edited by" info shown below the editor
        if (note.lastEditedBy) {
          setLastEdit({
            displayName: note.lastEditedBy.displayName,
            lastEditedAt: note.lastEditedAt,
          });
        }

        setSaveSuccess(true);
        // Hide the success banner after 3 seconds
        setTimeout(() => setSaveSuccess(false), 3000);
      } catch (err) {
        console.error("Save note error:", err);
        setSaveError("Failed to save note. Please try again.");
      } finally {
        setSaving(false);
      }
    },
    [content, groupId, hasUnsavedChanges]
  );

  // ── Auto-save every 30 seconds ─────────────────────────────────────────────
  useEffect(() => {
    // Start the interval
    autoSaveIntervalRef.current = setInterval(() => {
      // We access `hasUnsavedChanges` indirectly via `saveNote`'s closure
      saveNote(false);
    }, 30_000); // 30 000 ms = 30 seconds

    // Clear interval when component unmounts to prevent memory leaks
    return () => clearInterval(autoSaveIntervalRef.current);
  }, [saveNote]);

  // ── Keyboard shortcut: Ctrl/Cmd + S ───────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault(); // prevent browser's "Save page" dialog
        saveNote();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [saveNote]);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loadingNote) {
    return (
      <div className="flex items-center justify-center h-full py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Toolbar row */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <div className="text-sm font-medium text-gray-700">Shared Notes</div>

        <div className="flex items-center gap-3">
          {/* Unsaved indicator */}
          {hasUnsavedChanges && (
            <span className="text-xs text-amber-500 font-medium">
              • Unsaved changes
            </span>
          )}

          {/* Success banner */}
          {saveSuccess && (
            <span className="text-xs text-green-500 font-medium">
              ✓ Saved
            </span>
          )}

          {/* Save error */}
          {saveError && (
            <span className="text-xs text-red-500">{saveError}</span>
          )}

          {/* Manual save button */}
          <button
            onClick={() => saveNote()}
            disabled={saving || !hasUnsavedChanges}
            className="px-4 py-1.5 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1.5"
          >
            {saving ? (
              <>
                <svg
                  className="animate-spin h-3.5 w-3.5"
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
                Saving…
              </>
            ) : (
              "Save"
            )}
          </button>
        </div>
      </div>

      {/* Quill editor – flex-1 makes it fill remaining vertical space */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <ReactQuill
          theme="snow"
          value={content}
          onChange={setContent}
          modules={{ toolbar: TOOLBAR_OPTIONS }}
          placeholder="Start taking notes for your group…"
          style={{ flex: 1, display: "flex", flexDirection: "column" }}
        />
      </div>

      {/* Footer: last edited info + keyboard shortcut hint */}
      <div className="px-4 py-2 border-t bg-gray-50 flex items-center justify-between text-xs text-gray-400">
        {lastEdit ? (
          <span>
            Last saved by{" "}
            <span className="font-medium text-gray-500">
              {lastEdit.displayName}
            </span>{" "}
            at {format(new Date(lastEdit.lastEditedAt), "MMM d, HH:mm")}
          </span>
        ) : (
          <span>No saves yet</span>
        )}
        <span>Press Ctrl+S to save</span>
      </div>
    </div>
  );
};

export default NotesEditor;
