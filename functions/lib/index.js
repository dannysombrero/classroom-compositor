"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.appApi = void 0;
// functions/src/index.ts
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
admin.initializeApp();
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: true }));
app.options("*", (_req, res) => res.status(204).send(""));
app.use(express_1.default.json());
const sessions = new Map();
const codeToSession = new Map();
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const rand = () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
const base32 = (n) => ALPHABET[n & 31];
const checksum = (raw) => base32([...raw].reduce((a, ch) => a + ALPHABET.indexOf(ch), 0) % 32);
function genCode() {
    const raw = Array.from({ length: 6 }, rand).join("");
    return `${raw.slice(0, 3)}-${raw.slice(3)}${checksum(raw)}`;
}
// Create: POST /sessions
app.post("/sessions", (req, res) => {
    const hostId = String(req.body?.hostId ?? "host");
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const code = genCode();
    const session = { id, hostId, createdAt: Date.now(), active: true, code };
    sessions.set(id, session);
    codeToSession.set(code.replace(/-/g, ""), id);
    return res.json({ ...session, code });
});
// Resolve: GET /codes/:code  ← this is the “codes” route
app.get("/joinCodes/:code", (req, res) => {
    const key = req.params.code.replace(/-/g, "");
    const sessionId = codeToSession.get(key);
    if (!sessionId)
        return res.status(404).json({ error: "invalid_code" });
    const s = sessions.get(sessionId);
    if (!s || !s.active)
        return res.status(410).json({ error: "not_live" });
    return res.json({ sessionId });
});
// Check: GET /sessions/:id
app.get("/sessions/:id", (req, res) => {
    const s = sessions.get(req.params.id);
    return res.json({ active: !!(s && s.active) });
});
// End: DELETE /sessions/:id
app.delete("/sessions/:id", (req, res) => {
    const s = sessions.get(req.params.id);
    if (s) {
        s.active = false;
        if (s.code)
            codeToSession.delete(s.code.replace(/-/g, ""));
        sessions.set(s.id, s);
    }
    return res.status(204).end();
});
exports.appApi = functions.https.onRequest(app);
//# sourceMappingURL=index.js.map