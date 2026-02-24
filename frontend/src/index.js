/**
 * index.js - React Application Entry Point
 *
 * This is the very first JavaScript file that runs in the browser.
 * It mounts the React component tree onto the <div id="root"> in public/index.html.
 *
 * BrowserRouter enables client-side routing (URL changes without full page reload).
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css"; // Global TailwindCSS styles
import App from "./App";

// React 18 createRoot API – replaces the old ReactDOM.render()
const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  // StrictMode renders components twice in development to help catch side-effects
  <React.StrictMode>
    {/* BrowserRouter provides the routing context to all child components */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
