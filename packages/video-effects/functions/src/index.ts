// functions/src/index.ts
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import express from "express";

admin.initializeApp();
const app = express();
app.use(express.json());

// test route
app.post("/api/sessions", (req, res) => {
  const hostId = (req.body && req.body.hostId) || "host";
  res.json({ id: "test-session", createdAt: Date.now(), hostId, code: "ABC-DEFZ" });
});

export const appApi = functions.https.onRequest(app); // <-- name must be appApi