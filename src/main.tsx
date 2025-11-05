import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { PresenterPage } from "./pages/PresenterPage";
import JoinPage from "./pages/JoinPage";
import ViewerPage from "./pages/ViewerPage";

const router = createBrowserRouter([
  { path: "/", element: <PresenterPage /> },           // ← Go Live pill is here
  { path: "/join", element: <JoinPage /> },
  { path: "/viewer/:sessionId", element: <ViewerPage /> },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);