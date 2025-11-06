import React, { useCallback, useRef, useState } from "react";
import { useSessionStore } from "../stores/sessionStore";
import { startHost } from "../utils/webrtc";
import { activateJoinCode } from "../utils/joinCodes";

export default function PresenterPage() {
  const { joinCode, isJoinCodeActive, goLive } = useSessionStore();
  const [copied, setCopied] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const hostingRef = useRef(false);
  const lastDisplayStreamRef = useRef<MediaStream | null>(null);

  const copyJoinInfo = useCallback(async () => {
    if (!joinCode) return;
    try {
      const url = `${window.location.origin}/join?code=${joinCode}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch (e) {
      console.warn("[copy] failed", e);
    }
  }, [joinCode]);

  const handleGoLive = useCallback(async () => {
    if (hostingRef.current) return;
    setLiveError(null);
    hostingRef.current = true;

    try {
      await goLive("host-123");
      const s = useSessionStore.getState().session;
      if (!s?.id) {
        setLiveError("Couldn’t create a session. Check Firestore rules/connection.");
        return;
      }

      // Screen capture (or reuse if already sharing)
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      } catch (err: any) {
        if (
          lastDisplayStreamRef.current &&
          lastDisplayStreamRef.current.getVideoTracks().some(t => t.readyState === "live")
        ) {
          stream = lastDisplayStreamRef.current;
        } else {
          const name = err?.name || "";
          if (name === "NotAllowedError") {
            setLiveError('Go Live was blocked. Click again and press "Allow".');
            return;
          }
          setLiveError(err?.message ?? "Failed to capture screen.");
          return;
        }
      }
      if (!stream) {
        setLiveError("No screen stream available.");
        return;
      }

      await startHost(s.id, stream);
      lastDisplayStreamRef.current = stream;

      const { codePretty } = await activateJoinCode(s.id);
      useSessionStore.setState({ joinCode: codePretty, isJoinCodeActive: true });
    } catch (e) {
      console.error("[host] failed:", e);
      setLiveError("Go Live failed. If the browser is still sharing, click its “Stop sharing”, then try again.");
    } finally {
      hostingRef.current = false;
    }
  }, [goLive]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        margin: 0,
        padding: 0,
        overflow: "hidden",
        backgroundColor: "#1a1a1a",
        color: "#eaeaea",
        position: "relative",
      }}
    >
      {/* Floating live pill at top-center */}
      <div
        style={{
          position: "fixed",
          top: 16,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10001,
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "rgba(20,20,20,0.85)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 10,
          padding: "6px 10px",
          fontSize: 12,
          boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
          backdropFilter: "blur(4px)",
        }}
      >
        {!isJoinCodeActive ? (
          <button
            onClick={handleGoLive}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "#e11d48",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "6px 12px",
              cursor: "pointer",
              fontWeight: 700,
            }}
            title="Start a live session and generate a join code"
          >
            <span
              style={{
                display: "inline-flex",
                width: 8,
                height: 8,
                borderRadius: 999,
                background: "white",
              }}
            />
            Go Live
          </button>
        ) : (
          <>
            <span
              style={{
                display: "inline-flex",
                width: 8,
                height: 8,
                borderRadius: 999,
                background: "#ef4444",
                boxShadow: "0 0 0 6px rgba(239,68,68,0.2)",
                marginRight: 2,
              }}
              title="Live"
            />
            <span style={{ opacity: 0.85, marginRight: 6 }}>Live</span>
            <code style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 700 }}>
              {joinCode ?? "— — —"}
            </code>
            <button
              onClick={copyJoinInfo}
              style={{
                marginLeft: 8,
                background: "transparent",
                color: "#eaeaea",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 6,
                padding: "4px 8px",
                cursor: "pointer",
              }}
              title="Copy /join link"
            >
              Copy link
            </button>
            {copied && (
              <span
                style={{
                  marginLeft: 8,
                  padding: "2px 6px",
                  borderRadius: 6,
                  background: "rgba(34,197,94,0.15)",
                  border: "1px solid rgba(34,197,94,0.35)",
                  color: "#86efac",
                  fontSize: 11,
                }}
              >
                Copied!
              </span>
            )}
          </>
        )}

        {liveError && (
          <span
            style={{
              marginLeft: 8,
              padding: "2px 6px",
              borderRadius: 6,
              background: "rgba(239,68,68,0.15)",
              border: "1px solid rgba(239,68,68,0.35)",
              color: "#fecaca",
              fontSize: 11,
            }}
          >
            {liveError}
          </span>
        )}
      </div>

      {/* Simple center content so we can see the page */}
      <div style={{ margin: "auto", textAlign: "center" }}>
        <h1 style={{ fontSize: 18, marginBottom: 8 }}>Presenter</h1>
        <p style={{ opacity: 0.8 }}>
          If you see this, <em>PresenterPage</em> is rendering.
        </p>
      </div>
    </div>
  );
}