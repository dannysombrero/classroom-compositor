import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function ViewerPage() {
  const { sessionId } = useParams();
  const nav = useNavigate();

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!sessionId) return;
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (!res.ok) { if (!cancelled) nav("/join?error=inactive"); return; }
      const { active } = await res.json();
      if (!active && !cancelled) nav("/join?error=inactive");
    }
    check();
  }, [sessionId, nav]);

  return <div className="h-full">{/* viewer UI */}</div>;
}