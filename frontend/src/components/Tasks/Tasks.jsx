/**
 * components/Tasks/Tasks.jsx - Group Task Manager
 *
 * A full CRUD task list for a study group.  Members can add tasks with a
 * title, optional description, assignee, and due date; mark them complete;
 * edit them inline; and delete them.
 *
 * Features:
 *  - Filter bar: All / Pending / Completed
 *  - Inline add-task form
 *  - Edit-in-place with a collapsible edit panel
 *  - Delete with confirmation
 *  - Complete/incomplete toggle
 *  - Due-date badge turns red when overdue
 */

import React, { useState, useEffect } from "react";
import { format, isPast, parseISO } from "date-fns";
import { tasksAPI } from "../../utils/api";
import { useAuth } from "../../context/AuthContext";

// ─────────────────────────────────────────────────────────────────────────────
// Tasks Component
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {{ groupId: string, members: Array }} props
 *   members - list of group members ({ userId, displayName }) for the assignee picker
 */
const Tasks = ({ groupId, members = [] }) => {
  const { currentUser } = useAuth();

  // ── State ──────────────────────────────────────────────────────────────────
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // "all" | "pending" | "completed"
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [error, setError] = useState("");

  // ── New-task form state ────────────────────────────────────────────────────
  const emptyForm = {
    title: "",
    description: "",
    assignee: null,
    dueDate: "",
  };
  const [newTask, setNewTask] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // ── Edit-task form state ───────────────────────────────────────────────────
  const [editForm, setEditForm] = useState({});

  // ── Fetch tasks ────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await tasksAPI.getTasks(groupId);
        setTasks(response.data.tasks || []);
      } catch (err) {
        setError("Failed to load tasks.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, [groupId]);

  // ── Filtered task list ─────────────────────────────────────────────────────
  const filteredTasks = tasks.filter((t) => {
    if (filter === "pending") return !t.completed;
    if (filter === "completed") return t.completed;
    return true;
  });

  // ── Add task ───────────────────────────────────────────────────────────────
  const validateNewTask = () => {
    const errs = {};
    if (!newTask.title.trim()) errs.title = "Title is required.";
    return errs;
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    const errs = validateNewTask();
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      const response = await tasksAPI.createTask(groupId, {
        title: newTask.title.trim(),
        description: newTask.description.trim(),
        assignee: newTask.assignee
          ? JSON.parse(newTask.assignee) // assignee stored as JSON string in select
          : null,
        dueDate: newTask.dueDate || null,
      });
      setTasks((prev) => [...prev, response.data.task]);
      setNewTask(emptyForm);
      setShowAddForm(false);
    } catch (err) {
      setError("Failed to create task.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Toggle complete ────────────────────────────────────────────────────────
  const handleToggleComplete = async (task) => {
    try {
      const response = await tasksAPI.completeTask(
        groupId,
        task.taskId,
        !task.completed
      );
      setTasks((prev) =>
        prev.map((t) => (t.taskId === task.taskId ? response.data.task : t))
      );
    } catch (err) {
      setError("Failed to update task.");
    }
  };

  // ── Delete task ────────────────────────────────────────────────────────────
  const handleDeleteTask = async (taskId) => {
    if (!window.confirm("Delete this task? This cannot be undone.")) return;
    try {
      await tasksAPI.deleteTask(groupId, taskId);
      setTasks((prev) => prev.filter((t) => t.taskId !== taskId));
    } catch (err) {
      setError("Failed to delete task.");
    }
  };

  // ── Start editing ──────────────────────────────────────────────────────────
  const startEditing = (task) => {
    setEditingTaskId(task.taskId);
    setEditForm({
      title: task.title,
      description: task.description || "",
      assignee: task.assignee ? JSON.stringify(task.assignee) : "",
      dueDate: task.dueDate || "",
    });
  };

  // ── Save edit ──────────────────────────────────────────────────────────────
  const handleSaveEdit = async (taskId) => {
    if (!editForm.title.trim()) return;

    try {
      const response = await tasksAPI.updateTask(groupId, taskId, {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        assignee: editForm.assignee ? JSON.parse(editForm.assignee) : null,
        dueDate: editForm.dueDate || null,
      });
      setTasks((prev) =>
        prev.map((t) => (t.taskId === taskId ? response.data.task : t))
      );
      setEditingTaskId(null);
    } catch (err) {
      setError("Failed to update task.");
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Tasks</span>
          <span className="text-xs bg-gray-200 text-gray-600 rounded-full px-2 py-0.5 font-medium">
            {tasks.filter((t) => !t.completed).length} pending
          </span>
        </div>

        {/* Add task button */}
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition"
        >
          {showAddForm ? "✕ Cancel" : "+ Add Task"}
        </button>
      </div>

      {/* Inline add-task form */}
      {showAddForm && (
        <form
          onSubmit={handleAddTask}
          className="px-4 py-4 border-b bg-indigo-50 space-y-3"
        >
          <div className="grid sm:grid-cols-2 gap-3">
            {/* Title */}
            <div className="sm:col-span-2">
              <input
                type="text"
                value={newTask.title}
                onChange={(e) => {
                  setNewTask((p) => ({ ...p, title: e.target.value }));
                  setFormErrors((p) => ({ ...p, title: "" }));
                }}
                placeholder="Task title *"
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  formErrors.title ? "border-red-400 bg-red-50" : "border-gray-300"
                }`}
              />
              {formErrors.title && (
                <p className="text-xs text-red-500 mt-0.5">{formErrors.title}</p>
              )}
            </div>

            {/* Description */}
            <div className="sm:col-span-2">
              <textarea
                value={newTask.description}
                onChange={(e) =>
                  setNewTask((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="Description (optional)"
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Assignee */}
            <div>
              <select
                value={newTask.assignee || ""}
                onChange={(e) =>
                  setNewTask((p) => ({ ...p, assignee: e.target.value }))
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option
                    key={m.userId}
                    value={JSON.stringify({
                      userId: m.userId,
                      displayName: m.displayName,
                    })}
                  >
                    {m.displayName}
                  </option>
                ))}
              </select>
            </div>

            {/* Due date */}
            <div>
              <input
                type="date"
                value={newTask.dueDate}
                onChange={(e) =>
                  setNewTask((p) => ({ ...p, dueDate: e.target.value }))
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setNewTask(emptyForm);
                setFormErrors({});
              }}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {submitting ? "Adding…" : "Add Task"}
            </button>
          </div>
        </form>
      )}

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-2">
          {error}
          <button
            className="ml-2 text-red-400 hover:text-red-600"
            onClick={() => setError("")}
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 px-4 py-2 border-b">
        {["all", "pending", "completed"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
              filter === f
                ? "bg-indigo-100 text-indigo-700"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto divide-y">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            {filter === "all"
              ? "No tasks yet. Add one above!"
              : `No ${filter} tasks.`}
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isEditing = editingTaskId === task.taskId;
            const overdue =
              task.dueDate && !task.completed && isPast(parseISO(task.dueDate));

            return (
              <div
                key={task.taskId}
                className={`px-4 py-3 ${
                  task.completed ? "bg-gray-50" : "bg-white"
                }`}
              >
                {isEditing ? (
                  /* ── Edit form ─────────────────────────────────────────── */
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, title: e.target.value }))
                      }
                      className="w-full border border-indigo-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <textarea
                      value={editForm.description}
                      onChange={(e) =>
                        setEditForm((p) => ({
                          ...p,
                          description: e.target.value,
                        }))
                      }
                      rows={2}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="flex gap-2">
                      <select
                        value={editForm.assignee || ""}
                        onChange={(e) =>
                          setEditForm((p) => ({
                            ...p,
                            assignee: e.target.value,
                          }))
                        }
                        className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                      >
                        <option value="">Unassigned</option>
                        {members.map((m) => (
                          <option
                            key={m.userId}
                            value={JSON.stringify({
                              userId: m.userId,
                              displayName: m.displayName,
                            })}
                          >
                            {m.displayName}
                          </option>
                        ))}
                      </select>
                      <input
                        type="date"
                        value={editForm.dueDate}
                        onChange={(e) =>
                          setEditForm((p) => ({
                            ...p,
                            dueDate: e.target.value,
                          }))
                        }
                        className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setEditingTaskId(null)}
                        className="px-3 py-1 text-sm text-gray-500 hover:bg-gray-100 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveEdit(task.taskId)}
                        className="px-3 py-1 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Task row ──────────────────────────────────────────── */
                  <div className="flex items-start gap-3">
                    {/* Complete checkbox */}
                    <button
                      onClick={() => handleToggleComplete(task)}
                      className={`mt-0.5 h-5 w-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition ${
                        task.completed
                          ? "bg-green-500 border-green-500 text-white"
                          : "border-gray-300 hover:border-indigo-400"
                      }`}
                      aria-label={
                        task.completed
                          ? "Mark as incomplete"
                          : "Mark as complete"
                      }
                    >
                      {task.completed && (
                        <svg
                          className="w-3 h-3"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          task.completed
                            ? "line-through text-gray-400"
                            : "text-gray-800"
                        }`}
                      >
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {task.description}
                        </p>
                      )}

                      {/* Meta badges */}
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        {task.assignee && (
                          <span className="text-xs bg-indigo-50 text-indigo-600 rounded-full px-2 py-0.5">
                            👤 {task.assignee.displayName}
                          </span>
                        )}
                        {task.dueDate && (
                          <span
                            className={`text-xs rounded-full px-2 py-0.5 ${
                              overdue
                                ? "bg-red-50 text-red-600"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            📅{" "}
                            {format(parseISO(task.dueDate), "MMM d, yyyy")}
                            {overdue && " (overdue)"}
                          </span>
                        )}
                        {task.completed && task.completedBy && (
                          <span className="text-xs bg-green-50 text-green-600 rounded-full px-2 py-0.5">
                            ✓ {task.completedBy.displayName}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons (visible on hover) */}
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => startEditing(task)}
                        className="p-1 text-gray-400 hover:text-indigo-600 transition text-xs"
                        aria-label="Edit task"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => handleDeleteTask(task.taskId)}
                        className="p-1 text-gray-400 hover:text-red-500 transition text-xs"
                        aria-label="Delete task"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Tasks;
