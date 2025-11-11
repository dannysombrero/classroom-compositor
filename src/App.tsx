// src/App.tsx
import PresenterPage from "./pages/PresenterPage";
import { ViewerHostPage } from "./pages/ViewerHostPage";
import { ErrorBoundary } from "./components/ErrorBoundary";

/**
 * Main App component with simple route checking.
 * - /viewer -> ViewerHostPage
 * - /      -> PresenterPage
 */
export default function App() {
  const pathname = window.location.pathname;

  if (pathname === "/viewer") {
    return (
      <ErrorBoundary>
        <ViewerHostPage />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <PresenterPage />
    </ErrorBoundary>
  );
}