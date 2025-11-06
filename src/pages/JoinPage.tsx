import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { db } from "../firebase";                 // ← this resolves to src/firebase.ts
import { doc, getDoc } from "firebase/firestore";

export default function JoinPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();

  const [code, setCode] = useState((params.get("code") ?? "").toUpperCase());
  const inboundError = params.get("error");
  const [error, setError] = useState<string | null>(
    inboundError === "inactive" ? "Oops! It doesn't look like that session is live right now." : null
  );
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleaned = code.replace(/[^A-Z2-9]/g, "").toUpperCase();
    if (cleaned.length < 7) {
      setError("Please enter a valid join code (e.g., 7D9-K2F).");
      return;
    }

    setLoading(true);
    try {
      // Codes live at: sessions_join_codes/{CODEID}
      // Pretty code "H6J-4J6G" => id "H6J4J6G"
      const codeId = cleaned.replace(/-/g, "");
      console.log("[join] submit with code:", cleaned);
      console.log("[join] looking up code doc:", codeId);

      const snap = await getDoc(doc(db, "codes", codeId)); // ✅ match joinCodes.ts
      if (!snap.exists()) {
        console.warn("[join] code not found");
        setError("Hmm… we couldn't find that code. Double-check and try again.");
        return;
      }

      const data = snap.data() as any;
      const sessionId = data?.sessionId;
      if (!sessionId) {
        console.warn("[join] code doc missing sessionId");
        setError("Code is invalid. Ask the presenter to start a new session.");
        return;
      }

      console.log("[join] resolved sessionId:", sessionId);
      nav(`/viewer/${sessionId}`);
    } catch (err) {
      console.error("[join] lookup failed", err);
      setError("Something went wrong resolving the code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 p-6">
      <h1 className="text-xl font-semibold">Join a Presentation</h1>

      {error && (
        <div className="w-full max-w-md rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="flex items-center gap-2 w-full max-w-md">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="7D9-K2F"
          className="flex-1 border rounded px-3 py-2 font-mono"
          maxLength={9}
        />
        <button className="px-4 py-2 rounded bg-black text-white disabled:opacity-50" disabled={loading}>
          {loading ? "Checking…" : "Join"}
        </button>
      </form>
    </div>
  );
}