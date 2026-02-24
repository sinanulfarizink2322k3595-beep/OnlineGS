# OnlineGS – Group Study Collaboration Platform

A full-stack, real-time study-group collaboration web application.  
Groups can chat live, share rich-text notes, and manage tasks together — all in one place.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔐 Authentication | Email/password + Google OAuth (JWT-based) |
| 💬 Real-time Chat | Socket.io-powered group chat with typing indicators & online presence |
| 📝 Shared Notes | WYSIWYG editor (react-quill) with auto-save, version history |
| ✅ Task Manager | Create, assign, filter, and track tasks per group |
| 👥 Group Management | Create groups, share invite codes, manage members |

---

## 🗂 Project Structure

```
OnlineGS/
├── backend/                   # Node.js + Express REST API + Socket.io
│   ├── config/
│   │   └── firebase.js        # Firebase Admin SDK initialisation
│   ├── middleware/
│   │   └── auth.js            # JWT verification middleware
│   ├── routes/
│   │   ├── auth.js            # /api/auth  – register, login, Google OAuth
│   │   ├── groups.js          # /api/groups – CRUD + join/leave
│   │   ├── chat.js            # /api/chat  – message history + delete
│   │   ├── notes.js           # /api/notes – shared note + history
│   │   └── tasks.js           # /api/tasks – full task CRUD
│   ├── socket/
│   │   └── socketHandler.js   # All Socket.io event handlers
│   ├── server.js              # App entry point
│   ├── package.json
│   └── .env.example
│
└── frontend/                  # React 18 + TailwindCSS SPA
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── components/
    │   │   ├── Auth/          # Login.jsx, Register.jsx
    │   │   ├── Chat/          # Chat.jsx
    │   │   ├── Groups/        # GroupList.jsx, CreateGroup.jsx, JoinGroup.jsx
    │   │   ├── Notes/         # NotesEditor.jsx
    │   │   └── Tasks/         # Tasks.jsx
    │   ├── context/
    │   │   └── AuthContext.js # Global auth state
    │   ├── pages/
    │   │   ├── Dashboard.jsx
    │   │   └── GroupPage.jsx
    │   ├── utils/
    │   │   ├── api.js         # Axios instance + all API functions
    │   │   └── socket.js      # Socket.io client helpers
    │   ├── App.js
    │   ├── index.js
    │   └── index.css
    ├── package.json
    ├── tailwind.config.js
    ├── postcss.config.js
    └── .env.example
```

---

## 🛠 Tech Stack

### Backend
- **Node.js / Express** – REST API
- **Socket.io** – real-time WebSocket events
- **Firebase Admin SDK** – Firestore NoSQL database
- **JWT (jsonwebtoken)** – stateless authentication
- **bcryptjs** – password hashing
- **google-auth-library** – Google ID token verification
- **express-validator** – input validation
- **uuid** – invite code generation

### Frontend
- **React 18** – UI library
- **React Router v6** – client-side routing
- **TailwindCSS** – utility-first styling
- **Axios** – HTTP client
- **Socket.io-client** – real-time communication
- **react-quill** – rich-text notes editor
- **date-fns** – date formatting

---

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 18
- A Firebase project (Firestore enabled)
- A Google Cloud project with OAuth 2.0 credentials

---

### 1. Clone the repo

```bash
git clone https://github.com/your-org/OnlineGS.git
cd OnlineGS
```

---

### 2. Backend setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your real values (see Environment Variables below)
npm run dev        # starts with nodemon on port 5000
```

---

### 3. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env with your real values
npm start          # starts on port 3000
```

---

## 🔑 Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default `5000`) |
| `NODE_ENV` | `development` or `production` |
| `JWT_SECRET` | Long random string for signing JWTs |
| `JWT_EXPIRES_IN` | Token lifetime e.g. `7d` |
| `FIREBASE_PROJECT_ID` | From Firebase Console → Project Settings |
| `FIREBASE_PRIVATE_KEY_ID` | From service account JSON |
| `FIREBASE_PRIVATE_KEY` | PEM key (keep `\n` escaped in the value) |
| `FIREBASE_CLIENT_EMAIL` | Service account email |
| `FIREBASE_CLIENT_ID` | Service account client ID |
| `FIREBASE_AUTH_URI` | Usually `https://accounts.google.com/o/oauth2/auth` |
| `FIREBASE_TOKEN_URI` | Usually `https://oauth2.googleapis.com/token` |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID from Google Cloud Console |
| `FRONTEND_URL` | CORS allowed origin e.g. `http://localhost:3000` |

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `REACT_APP_API_URL` | Backend API base URL e.g. `http://localhost:5000/api` |
| `REACT_APP_FIREBASE_API_KEY` | From Firebase Console → Your App |
| `REACT_APP_FIREBASE_AUTH_DOMAIN` | `<project>.firebaseapp.com` |
| `REACT_APP_FIREBASE_PROJECT_ID` | Firebase project ID |
| `REACT_APP_FIREBASE_STORAGE_BUCKET` | `<project>.appspot.com` |
| `REACT_APP_FIREBASE_MESSAGING_SENDER_ID` | Messaging sender ID |
| `REACT_APP_FIREBASE_APP_ID` | Firebase app ID |
| `REACT_APP_GOOGLE_CLIENT_ID` | Same Google OAuth client ID as backend |

---

## 📡 API Endpoints

### Auth  `/api/auth`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/register` | ✗ | Create account |
| POST | `/login` | ✗ | Email/password login |
| POST | `/google` | ✗ | Google ID token exchange |
| GET | `/me` | ✓ | Current user profile |

### Groups  `/api/groups`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | ✓ | Create group |
| GET | `/` | ✓ | List user's groups |
| GET | `/:groupId` | ✓ | Group details |
| POST | `/:groupId/join` | ✓ | Join with invite code |
| POST | `/:groupId/leave` | ✓ | Leave group |
| GET | `/:groupId/members` | ✓ | Member list |

### Chat  `/api/chat`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/:groupId/messages` | ✓ | Paginated history |
| POST | `/:groupId/messages` | ✓ | Post message |
| DELETE | `/:groupId/messages/:messageId` | ✓ | Delete own message |

### Notes  `/api/notes`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/:groupId` | ✓ | Get current note |
| PUT | `/:groupId` | ✓ | Save note |
| GET | `/:groupId/history` | ✓ | Last 10 versions |

### Tasks  `/api/tasks`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/:groupId` | ✓ | List tasks |
| POST | `/:groupId` | ✓ | Create task |
| PUT | `/:groupId/:taskId` | ✓ | Update task |
| DELETE | `/:groupId/:taskId` | ✓ | Delete task |
| PATCH | `/:groupId/:taskId/complete` | ✓ | Toggle completion |

---

## 🔌 Socket.io Events

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `join_group` | `{ groupId }` | Join a room |
| `leave_group` | `{ groupId }` | Leave a room |
| `send_message` | `{ groupId, text }` | Send chat message |
| `typing` | `{ groupId }` | Started typing |
| `stop_typing` | `{ groupId }` | Stopped typing |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `new_message` | message object | New chat message |
| `message_deleted` | `{ messageId, groupId }` | Message removed |
| `typing` | `{ userId, displayName, groupId }` | Someone is typing |
| `stop_typing` | `{ userId, groupId }` | Stopped typing |
| `user_joined` | `{ userId, displayName }` | User entered room |
| `user_left` | `{ userId, displayName }` | User left room |
| `online_users` | `{ groupId, users[] }` | Current online list |

---

## 📄 License

MIT