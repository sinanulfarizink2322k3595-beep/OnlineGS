/**
 * components/Chat/Chat.jsx - Real-Time Group Chat
 *
 * Displays the chat history for a group and lets members send new messages.
 * Real-time updates arrive over Socket.io; historical messages are loaded
 * via the REST API on first render.
 *
 * Features:
 *  - Message history with sender name, avatar initial, and timestamp
 *  - Typing indicator ("Alex is typing…")
 *  - Auto-scroll to the latest message
 *  - Online user count badge
 *  - Delete own messages
 *  - Responsive layout (full height flex column)
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { format } from "date-fns";
import { useAuth } from "../../context/AuthContext";
import { chatAPI } from "../../utils/api";
import {
  connectSocket,
  joinGroup,
  leaveGroup,
  sendMessage as socketSendMessage,
  onMessage,
  onMessageDeleted,
  onTyping,
  onStopTyping,
  onUserJoined,
  onUserLeft,
  onOnlineUsers,
  emitTyping,
  emitStopTyping,
} from "../../utils/socket";

// ─────────────────────────────────────────────────────────────────────────────
// Chat Component
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {{ groupId: string }} props
 */
const Chat = ({ groupId }) => {
  const { currentUser, token } = useAuth();

  // ── State ──────────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sendError, setSendError] = useState("");
  // Set of userIds currently typing (used to render the typing indicator)
  const [typingUsers, setTypingUsers] = useState(new Map());
  // List of online users in this room
  const [onlineUsers, setOnlineUsers] = useState([]);

  // ── Refs ───────────────────────────────────────────────────────────────────
  // Ref to the bottom-of-messages sentinel div for auto-scroll
  const messagesEndRef = useRef(null);
  // Ref to track the typing debounce timer
  const typingTimerRef = useRef(null);

  // ── Auto-scroll helper ─────────────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Scroll whenever messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // ── Load message history ───────────────────────────────────────────────────
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await chatAPI.getMessages(groupId);
        setMessages(response.data.messages || []);
      } catch (err) {
        console.error("Load history error:", err);
      } finally {
        setLoadingHistory(false);
      }
    };
    loadHistory();
  }, [groupId]);

  // ── Socket setup ───────────────────────────────────────────────────────────
  useEffect(() => {
    // Connect (or reuse) socket with the current user's JWT
    connectSocket(token);
    // Join the group room
    joinGroup(groupId);

    // Subscribe to incoming messages
    const unsubMessage = onMessage((msg) => {
      setMessages((prev) => {
        // Prevent duplicate messages (can happen if HTTP POST + socket both deliver)
        if (prev.some((m) => m.messageId === msg.messageId)) return prev;
        return [...prev, msg];
      });
    });

    // Subscribe to message-deleted events
    const unsubDeleted = onMessageDeleted(({ messageId }) => {
      setMessages((prev) => prev.filter((m) => m.messageId !== messageId));
    });

    // Subscribe to typing indicators
    const unsubTyping = onTyping(({ userId, displayName }) => {
      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.set(userId, displayName);
        return next;
      });
    });

    const unsubStopTyping = onStopTyping(({ userId }) => {
      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.delete(userId);
        return next;
      });
    });

    // Online-user presence events
    const unsubOnlineUsers = onOnlineUsers(({ users }) => {
      setOnlineUsers(users || []);
    });

    const unsubUserJoined = onUserJoined((user) => {
      setOnlineUsers((prev) => {
        if (prev.some((u) => u.userId === user.userId)) return prev;
        return [...prev, user];
      });
    });

    const unsubUserLeft = onUserLeft(({ userId }) => {
      setOnlineUsers((prev) => prev.filter((u) => u.userId !== userId));
    });

    // Cleanup: unsubscribe listeners and leave the room when unmounting
    return () => {
      unsubMessage();
      unsubDeleted();
      unsubTyping();
      unsubStopTyping();
      unsubOnlineUsers();
      unsubUserJoined();
      unsubUserLeft();
      leaveGroup(groupId);
      clearTimeout(typingTimerRef.current);
    };
  }, [groupId, token]);

  // ── Send message ───────────────────────────────────────────────────────────
  const handleSend = (e) => {
    e.preventDefault();
    const text = newMessage.trim();
    if (!text) return;
    if (text.length > 2000) {
      setSendError("Message is too long (max 2000 characters).");
      return;
    }

    setSendError("");
    socketSendMessage(groupId, text);
    setNewMessage("");

    // Clear typing indicator on send
    clearTimeout(typingTimerRef.current);
    emitStopTyping(groupId);
  };

  // ── Typing indicator ───────────────────────────────────────────────────────
  /**
   * Emit a "typing" event on each keystroke but debounce the "stop_typing"
   * event so it fires 2 s after the user stops pressing keys.
   */
  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    emitTyping(groupId);

    // Reset the stop-typing debounce
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      emitStopTyping(groupId);
    }, 2000);
  };

  // ── Delete message ─────────────────────────────────────────────────────────
  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm("Delete this message?")) return;
    try {
      await chatAPI.deleteMessage(groupId, messageId);
      // The socket event will remove it from the list; optimistically remove too
      setMessages((prev) => prev.filter((m) => m.messageId !== messageId));
    } catch (err) {
      console.error("Delete message error:", err);
    }
  };

  // ── Typing indicator text ──────────────────────────────────────────────────
  const typingText = () => {
    // Filter out the current user themselves
    const others = Array.from(typingUsers.entries())
      .filter(([uid]) => uid !== currentUser?.userId)
      .map(([, name]) => name);

    if (others.length === 0) return null;
    if (others.length === 1) return `${others[0]} is typing…`;
    if (others.length === 2)
      return `${others[0]} and ${others[1]} are typing…`;
    return "Several people are typing…";
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Online users header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-white">
        <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
        <span className="text-xs text-gray-500">
          {onlineUsers.length} online
        </span>
        <div className="flex -space-x-1 ml-1">
          {onlineUsers.slice(0, 5).map((u) => (
            <div
              key={u.userId}
              title={u.displayName}
              className="h-6 w-6 rounded-full bg-indigo-200 text-indigo-700 text-xs flex items-center justify-center font-semibold border-2 border-white"
            >
              {u.displayName?.charAt(0).toUpperCase()}
            </div>
          ))}
          {onlineUsers.length > 5 && (
            <div className="h-6 w-6 rounded-full bg-gray-200 text-gray-600 text-xs flex items-center justify-center font-semibold border-2 border-white">
              +{onlineUsers.length - 5}
            </div>
          )}
        </div>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {loadingHistory ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            No messages yet. Say hello! 👋
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.senderId === currentUser?.userId;
            return (
              <div
                key={msg.messageId}
                className={`flex items-end gap-2 ${
                  isOwn ? "flex-row-reverse" : "flex-row"
                }`}
              >
                {/* Avatar */}
                <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-600 text-sm flex items-center justify-center font-semibold flex-shrink-0">
                  {msg.senderName?.charAt(0).toUpperCase()}
                </div>

                {/* Bubble */}
                <div
                  className={`group relative max-w-xs lg:max-w-md ${
                    isOwn ? "items-end" : "items-start"
                  } flex flex-col`}
                >
                  {/* Sender name (only on others' messages) */}
                  {!isOwn && (
                    <span className="text-xs text-gray-400 mb-0.5 ml-1">
                      {msg.senderName}
                    </span>
                  )}

                  <div
                    className={`px-4 py-2 rounded-2xl text-sm leading-relaxed ${
                      isOwn
                        ? "bg-indigo-600 text-white rounded-br-sm"
                        : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm shadow-sm"
                    }`}
                  >
                    {msg.text}
                  </div>

                  {/* Timestamp + delete */}
                  <div
                    className={`flex items-center gap-2 mt-0.5 ${
                      isOwn ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    <span className="text-xs text-gray-400">
                      {format(new Date(msg.createdAt), "HH:mm")}
                    </span>
                    {isOwn && (
                      <button
                        onClick={() => handleDeleteMessage(msg.messageId)}
                        className="text-xs text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                        aria-label="Delete message"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {typingText() && (
          <div className="flex items-center gap-2 text-xs text-gray-400 italic pl-2">
            <span className="flex gap-1">
              <span className="animate-bounce delay-75">•</span>
              <span className="animate-bounce delay-150">•</span>
              <span className="animate-bounce delay-300">•</span>
            </span>
            {typingText()}
          </div>
        )}

        {/* Invisible sentinel div used for auto-scroll */}
        <div ref={messagesEndRef} />
      </div>

      {/* Message input */}
      <div className="border-t bg-white p-3">
        {sendError && (
          <p className="text-xs text-red-500 mb-1 px-1">{sendError}</p>
        )}
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={handleInputChange}
            placeholder="Type a message…"
            maxLength={2000}
            className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="h-9 w-9 flex items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex-shrink-0"
            aria-label="Send message"
          >
            {/* Paper-plane icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
