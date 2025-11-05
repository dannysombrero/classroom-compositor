import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const API = import.meta.env.VITE_API_BASE ?? "";

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
    if (cleaned.length < 7) return setError("Please enter a valid join code (e.g., 7D9-K2F).");
    setLoading(true);
    try {
      const url = `${API}/codes/${cleaned}`;
      console.log("Resolving join code via:", url);
      const res = await fetch(url);
      if (res.status === 404) return setError("Hmm… we couldn't find that code. Double-check and try again.");
      if (res.status === 410) return setError("That session isn’t live right now. Ask the presenter to go live.");
      if (!res.ok) return setError("Something went wrong resolving the code. Please try again.");
      const { sessionId } = await res.json();
      console.log("[join] cleaned:", cleaned);
      console.log("[join] resolved sessionId:", sessionId);
      nav(`/viewer/${sessionId}`);
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