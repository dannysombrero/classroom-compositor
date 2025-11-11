export type Role = "host" | "viewer";

export class Signaling {
  private ws!: WebSocket;
  private sessionId!: string;
  private role!: Role;
  onSignal?: (from: Role, payload: any) => void;
  onPeerJoin?: (role: Role) => void;
  onPeerLeave?: (role: Role) => void;

  connect(baseURL: string, sessionId: string, role: Role) {
    return new Promise<void>((resolve, reject) => {
      this.sessionId = sessionId;
      this.role = role;
      this.ws = new WebSocket(`${baseURL.replace(/^http/,'ws')}/ws`);
      this.ws.onopen = () => {
        this.ws.send(JSON.stringify({ type: "join", sessionId, role }));
      };
      this.ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.type === "joined") return resolve();
        if (msg.type === "signal" && this.onSignal) this.onSignal(msg.from, msg.payload);
        if (msg.type === "peer-joined" && this.onPeerJoin) this.onPeerJoin(msg.role);
        if (msg.type === "peer-left" && this.onPeerLeave) this.onPeerLeave(msg.role);
      };
      this.ws.onerror = reject;
    });
  }

  sendSignal(payload: any) {
    this.ws?.send(JSON.stringify({ type: "signal", sessionId: this.sessionId, payload }));
  }
}