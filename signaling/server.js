import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";

// --- env + deploy-friendly defaults ---
const HOST = process.env.HOST || "0.0.0.0"; // bind all interfaces in prod
const PORT = process.env.PORT || 8787;      // Heroku/CloudRun/etc. will inject PORT
const ORIGINS = (process.env.ALLOWED_ORIGINS || "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// --- simple in-memory join codes -> room mapping (optional)
const sessions = new Map();          // sessionId -> { hostId, active }
const codeToSession = new Map();     // "ABCDEFZ" -> sessionId

const app = express();
app.use(
  cors({
    origin: ORIGINS.includes("*") ? true : ORIGINS,
    credentials: true,
  })
);
app.use(express.json());

// Create a session and a human join code (sticky for this run)
function genCode() {
  const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const rand = () => ALPHA[Math.floor(Math.random() * ALPHA.length)];
  const raw = Array.from({ length: 6 }, rand).join("");
  const sum = [...raw].reduce((a, ch) => a + ALPHA.indexOf(ch), 0) & 31;
  const chk = ALPHA[sum];
  return `${raw.slice(0,3)}-${raw.slice(3)}${chk}`;
}

app.post("/sessions", (req, res) => {
  const hostId = String(req.body?.hostId ?? "host");
  const id = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const code = genCode();
  sessions.set(id, { hostId, active: true, createdAt: Date.now(), code });
  codeToSession.set(code.replace(/-/g, ""), id);
  res.json({ id, hostId, createdAt: Date.now(), active: true, code });
});

app.get("/joinCodes/:code", (req, res) => {
  const key = req.params.code.toUpperCase().replace(/-/g, "");
  const sessionId = codeToSession.get(key);
  if (!sessionId) return res.status(404).json({ error: "invalid_code" });
  const s = sessions.get(sessionId);
  if (!s?.active) return res.status(410).json({ error: "not_live" });
  res.json({ sessionId });
});

app.delete("/sessions/:id", (req, res) => {
  const s = sessions.get(req.params.id);
  if (s) {
    s.active = false;
    if (s.code) codeToSession.delete(s.code.replace(/-/g,""));
    sessions.set(req.params.id, s);
  }
  res.status(204).end();
});

const server = http.createServer(app);

// ----- WebSocket signaling -----
// rooms: sessionId -> Set<WebSocket>
const rooms = new Map();

const wss = new WebSocketServer({ server, path: "/ws" });

function joinRoom(ws, sessionId, role) {
  if (!rooms.has(sessionId)) rooms.set(sessionId, new Set());
  rooms.get(sessionId).add(ws);
  ws._room = sessionId;
  ws._role = role;
  // tell others someone joined
  broadcast(sessionId, { type: "peer-joined", role });
}

function leaveRoom(ws) {
  const sessionId = ws._room;
  if (!sessionId) return;
  const set = rooms.get(sessionId);
  if (set) {
    set.delete(ws);
    if (set.size === 0) rooms.delete(sessionId);
  }
  broadcast(sessionId, { type: "peer-left", role: ws._role });
}

function broadcast(sessionId, msg, except) {
  const set = rooms.get(sessionId);
  if (!set) return;
  const payload = JSON.stringify(msg);
  for (const s of set) {
    if (s !== except && s.readyState === WebSocket.OPEN) s.send(payload);
  }
}

wss.on("connection", (ws) => {
  // keepalive (helps behind proxies/load balancers)
  ws.isAlive = true;
  ws.on("pong", () => (ws.isAlive = true));

  ws.on("message", (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }

    // expected messages:
    // { type:"join", sessionId, role: "host"|"viewer" }
    // { type:"signal", sessionId, to: "host"|"all", payload: {...offer/answer/candidate...} }
    switch (msg.type) {
      case "join":
        joinRoom(ws, msg.sessionId, msg.role);
        ws.send(JSON.stringify({ type: "joined", role: msg.role }));
        break;
      case "signal":
        // host/viewer exchange; for simplicity, broadcast to others in room
        broadcast(msg.sessionId, { type: "signal", from: ws._role, payload: msg.payload }, ws);
        break;
      default:
        // ignore
        break;
    }
  });

  ws.on("close", () => leaveRoom(ws));
});

const interval = setInterval(() => {
  wss.clients.forEach((client) => {
    if (client.isAlive === false) return client.terminate();
    client.isAlive = false;
    try { client.ping(); } catch {}
  });
}, 30000);

wss.on("close", () => clearInterval(interval));

server.listen(PORT, HOST, () => {
  const addr = server.address();
  const hostShown = typeof addr === "object" && addr ? `${addr.address}:${addr.port}` : `${HOST}:${PORT}`;
  console.log(`Signaling server listening on http://${hostShown}  (WS path: /ws)`);
});