import { ViewerHostPage } from "./pages/ViewerHostPage";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { PresenterPage } from "./pages/PresenterPage";
import JoinPage from "./pages/JoinPage";
import ViewerPage from "./pages/ViewerPage";

const router = createBrowserRouter([
  { path: "/", element: <PresenterPage /> },
  { path: "/join", element: <JoinPage /> },
  { path: "/viewer", element: <ViewerHostPage /> },          // local pop-out
  { path: "/viewer/:sessionId", element: <ViewerPage /> },   // remote viewer (join-code)
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);