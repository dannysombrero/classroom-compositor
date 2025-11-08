// src/pages/JoinPage.tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { db, doc, getDoc } from "../firebase";

export default function JoinPage() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // If you share links like /join?code=ABC-123, prefill:
  useEffect(() => {
    const q = (search.get("joinCodes") || "").toUpperCase().replace(/\W/g, "");
    if (q) setCode(pretty(q));
    inputRef.current?.focus();
  }, [search]);

  function pretty(raw: string) {
    const clean = raw.replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (clean.length <= 3) return clean;
    return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const id = code.toUpperCase().replace(/-/g, "");
    console.log("[join] submit with code:", code);
    console.log("[join] looking up code doc:", id);

    try {
      const ref = doc(db, "joinCodes", id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        console.warn("[join] code not found");
        setError("Code not found. Double-check and try again.");
        return;
      }
      const data = snap.data() as any;
      const sessionId = data?.sessionId;
      console.log("[join] resolved sessionId:", sessionId);
      if (!sessionId) {
        setError("This code is not active.");
        return;
      }
      navigate(`/view/${sessionId}`);
    } catch (err) {
      console.error(err);
      setError("Couldn’t look up that code right now.");
    }
  }

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 640, width: "100%" }}>
        <div className="card-header">
          <div className="card-title">Join a Stream</div>
          <div className="card-subtle">Enter the 6-character code</div>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit} className="row" style={{ gap: 10 }}>
            <input
              ref={inputRef}
              className="input"
              value={code}
              onChange={(e) => setCode(pretty(e.target.value.toUpperCase()))}
              placeholder="ABC-123"
              inputMode="text"
              autoCapitalize="characters"
              maxLength={7}
              style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
            />
            <button type="submit" className="btn">Join</button>
          </form>
          {error && <div style={{ marginTop: 10, color: "#fca5a5" }}>{error}</div>}
          <div style={{ marginTop: 12 }} className="help">
            Example format: <code>ABC-123</code>
          </div>
        </div>
      </div>
    </div>
  );
}