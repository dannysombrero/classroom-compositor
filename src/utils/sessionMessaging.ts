export const SESSION_MESSAGE_SCOPE = "classroom-compositor/session" as const;
export const SESSION_MESSAGE_VERSION = 1 as const;

export type SessionMessagePayload =
  | {
      type: "viewer-ready";
      viewerId: string;
      sessionId?: string | null;
      capabilities?: {
        acceptsStreamTransfer?: boolean;
      };
    }
  | {
      type: "stream-announce";
      streamId: string;
      label?: string;
      viewerId?: string;
      sessionId?: string | null;
      hasStream?: boolean;
      transferSupported?: boolean;
    }
  | {
      type: "request-stream";
      viewerId: string;
      streamId: string;
      sessionId?: string | null;
    }
  | {
      type: "deliver-stream";
      streamId: string;
      viewerId?: string;
      sessionId?: string | null;
      stream?: MediaStream;
    }
  | {
      type: "stream-ended";
      streamId: string;
      viewerId?: string;
      sessionId?: string | null;
      reason?: string;
    }
  | {
      type: "error";
      code: string;
      message: string;
      streamId?: string;
      viewerId?: string;
      sessionId?: string | null;
    };

export interface SessionMessageEnvelope<M extends SessionMessagePayload = SessionMessagePayload> {
  scope: typeof SESSION_MESSAGE_SCOPE;
  version: typeof SESSION_MESSAGE_VERSION;
  message: M;
}

export function createSessionMessage<M extends SessionMessagePayload>(message: M): SessionMessageEnvelope<M> {
  return {
    scope: SESSION_MESSAGE_SCOPE,
    version: SESSION_MESSAGE_VERSION,
    message,
  };
}

export function isSessionMessageEnvelope(value: unknown): value is SessionMessageEnvelope {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SessionMessageEnvelope>;
  return candidate.scope === SESSION_MESSAGE_SCOPE && candidate.version === SESSION_MESSAGE_VERSION && !!candidate.message;
}

export function extractSessionMessage(event: MessageEvent): SessionMessagePayload | null {
  if (typeof window !== "undefined" && event.origin && event.origin !== window.location.origin) {
    return null;
  }

  const data = event.data;
  if (isSessionMessageEnvelope(data)) {
    return data.message;
  }

  return null;
}

export interface PostMessageOptions {
  transfer?: Transferable[];
  origin?: string;
}

export function postSessionMessage(
  targetWindow: Window,
  message: SessionMessagePayload,
  options: PostMessageOptions = {},
): void {
  try {
    const origin = options.origin ?? resolveTargetOrigin(targetWindow);
    const envelope = createSessionMessage(message);
    if (options.transfer && options.transfer.length > 0) {
      targetWindow.postMessage(envelope, origin, options.transfer);
    } else {
      targetWindow.postMessage(envelope, origin);
    }
  } catch (error) {
    console.error("Failed to post session message", { message, error });
  }
}

export type SessionMessageHandler = (
  payload: SessionMessagePayload,
  event: MessageEvent<SessionMessageEnvelope>,
) => void;

export function addSessionMessageListener(handler: SessionMessageHandler): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const listener = (event: MessageEvent<SessionMessageEnvelope>) => {
    const payload = extractSessionMessage(event);
    if (!payload) return;
    handler(payload, event);
  };

  window.addEventListener("message", listener as EventListener);
  return () => window.removeEventListener("message", listener as EventListener);
}

export function resolveTargetOrigin(targetWindow: Window): string {
  try {
    const origin = targetWindow.location?.origin;
    if (origin && origin !== "null") {
      return origin;
    }
  } catch (error) {
    console.warn("Could not resolve window origin", error);
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "*";
}
