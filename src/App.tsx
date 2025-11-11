// src/App.tsx
import PresenterPage from "./pages/PresenterPage"; // ⬅️ default import (fix)
import { ViewerHostPage } from "./pages/ViewerHostPage"; // keep as-is if ViewerHostPage is a named export
import { useEffect } from "react";
import { useSessionStore } from "./stores/sessionStore";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Outlet } from "react-router-dom";

/** Inline BottomBarLiveLite (unchanged) */
function BottomBarLiveLite({ hostId }: { hostId: string }) {
  const { session, goLive, endLive, joinCode, isJoinCodeActive } = useSessionStore();

  useEffect(() => {
    if (!session) return;
    const cleanup = () => {
      try { endLive(); } catch {}
    };
    window.addEventListener("pagehide", cleanup);
    window.addEventListener("beforeunload", cleanup);
    return () => {
      window.removeEventListener("pagehide", cleanup);
      window.removeEventListener("beforeunload", cleanup);
    };
  }, [session, endLive]);

  const copyLink = async () => {
    if (!joinCode || !session) return;
    const link = `${location.origin}/join?code=${joinCode}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      window.prompt("Copy link:", link);
    }
  };

  return (
    <div className="flex items-center gap-3 px-2 py-1">
      {!session ? (
        <button
          className="px-3 py-1 rounded-lg bg-red-600 text-white"
          onClick={() => goLive(hostId)}
        >
          ● Go Live
        </button>
      ) : (
        <>
          <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-red-600 text-white">
            <span className="w-2.5 h-2.5 rounded-full bg-white/90 animate-pulse" />
            <span className="text-xs font-semibold tracking-wide">LIVE</span>
          </div>
          {isJoinCodeActive && (
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded bg-neutral-900 text-white font-mono text-sm">
                {joinCode}
              </span>
              <button
                className="px-2 py-1 text-xs rounded border hover:bg-neutral-50"
                onClick={copyLink}
              >
                Copy Link
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Main App component with simple route checking.
 * - /viewer -> ViewerHostPage
 * - /      -> PresenterPage + bottom bar
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