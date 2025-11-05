import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { db, doc, getDoc } from "../firebase";

export default function JoinPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();

  const [code, setCode] = useState<string>((params.get("code") ?? "").toUpperCase());
  const inboundError = params.get("error");
  const [error, setError] = useState<string | null>(
    inboundError === "inactive"
      ? "Oops! It doesn't look like that session is live right now."
      : null
  );
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleaned = code.replace(/[^A-Z0-9-]/g, "").toUpperCase();
    if (cleaned.replace(/-/g, "").length < 7) {
      setError("Please enter a valid join code (e.g., 7D9-K2F).");
      return;
    }

    setLoading(true);
    try {
      console.log("[join] submit with code:", cleaned);
      const id = cleaned.replace(/-/g, "");
      console.log("[join] looking up code doc:", id);

      const snap = await getDoc(doc(db, "codes", id));
      if (!snap.exists()) {
        console.warn("[join] code not found");
        setError("Hmm… we couldn't find that code. Double-check and try again.");
        return;
      }

      const data = snap.data() as { sessionId?: string; active?: boolean } | undefined;
      if (!data?.sessionId) {
        console.warn("[join] code doc missing sessionId");
        setError("Something went wrong resolving the code. Please try again.");
        return;
      }
      if (data.active === false) {
        console.warn("[join] code inactive");
        setError("That session isn’t live right now. Ask the presenter to go live.");
        return;
      }

      console.log("[join] resolved sessionId:", data.sessionId);
      nav(`/viewer/${data.sessionId}`);
    } catch (err) {
      console.error("[join] failed", err);
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
        <button
          type="submit"
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Checking…" : "Join"}
        </button>
      </form>
    </div>
  );
}