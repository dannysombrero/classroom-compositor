// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

// ⬇️ Add this import
import "./global.css";

import App from "./App";
import JoinPage from "./pages/JoinPage";
import ViewerPage from "./pages/ViewerPage";
import { ViewerHostPage } from "./pages/ViewerHostPage";
import PhoneCameraPage from "./pages/PhoneCameraPage";
import { ErrorBoundary } from "./components/ErrorBoundary";

function RouteError() {
  return (
    <div style={{ padding: 24, color: "#fff", background: "#111", height: "100vh" }}>
      <h1 style={{ marginBottom: 8 }}>Something went wrong</h1>
      <p>That route wasn’t found or threw an error.</p>
    </div>
  );
}

const router = createBrowserRouter([
  { path: "/", element: <App />, errorElement: <RouteError /> },
  { path: "/join", element: <JoinPage />, errorElement: <RouteError /> },
  { path: "/view/:sessionId", element: <ViewerPage />, errorElement: <RouteError /> },
  { path: "/viewer", element: <ViewerHostPage />, errorElement: <RouteError /> },
  { path: "/phone-camera/:sessionId", element: <PhoneCameraPage />, errorElement: <RouteError /> },
]);

const isStandaloneViewer = window.location.pathname === "/viewer";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isStandaloneViewer ? (
      <ErrorBoundary>
        <ViewerHostPage />
      </ErrorBoundary>
    ) : (
      <RouterProvider router={router} />
    )}
  </React.StrictMode>
);
