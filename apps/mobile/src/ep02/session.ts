import {
  canonical,
  decode,
  encode,
  MAX_WIRE_BYTES,
  byteLength,
  ProtocolError,
  type Hash,
  type PeerScope,
  type TestEnvelope,
} from "./protocol";
import { PeerStore } from "./store";
export type TransportEvent =
  | { type: "found"; endpointId: string; context: string }
  | { type: "lost"; endpointId: string }
  | { type: "verification"; endpointId: string; context: string; code: string }
  | { type: "connected" | "disconnected"; endpointId: string }
  | { type: "bytes"; endpointId: string; data: string }
  | { type: "error"; message: string };
/** send resolves when handed to the SDK, NEVER when the receiver has saved. */
export interface PeerTransport {
  subscribe(listener: (event: TransportEvent) => void): () => void;
  start(context: string, role: PeerScope["role"]): Promise<void>;
  connect(endpointId: string): Promise<void>;
  confirm(endpointId: string, accepted: boolean): Promise<void>;
  send(endpointId: string, data: string): Promise<void>;
  disconnect(endpointId: string): Promise<void>;
  stop(): Promise<void>;
}
export interface SessionState {
  phase: "idle" | "discovering" | "verify" | "connected" | "paused" | "error";
  message: string;
  peers: string[];
  challenge: { endpointId: string; code: string } | null;
}
export async function pairingContext(
  scope: PeerScope,
  hash: Hash,
): Promise<string> {
  return hash(canonical({ ...scope }));
}
function oppositeScope(scope: PeerScope): PeerScope {
  return {
    ...scope,
    localDeviceId: scope.peerDeviceId,
    peerDeviceId: scope.localDeviceId,
    role: scope.role === "cashier" ? "prep" : "cashier",
  };
}
/** An authenticated connection is disposable; all application progress lives in SQLite. */
export class PeerSession {
  state: SessionState = {
    phase: "idle",
    message: "Ready to connect the two test phones.",
    peers: [],
    challenge: null,
  };
  private expected = "";
  private attempts = new Map<string, number>();
  private latencySamples: number[] = [];
  private localContext = "";
  private endpoint: string | null = null;
  private approved: string | null = null;
  private active = false;
  private generation = 0;
  private queued = 0;
  private chain: Promise<void> = Promise.resolve();
  private flushing = false;
  private flushAgain = false;
  private flushingPromise: Promise<void> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribe: (() => void) | null = null;
  private listeners = new Set<() => void>();
  constructor(
    readonly store: PeerStore,
    private readonly transport: PeerTransport,
    private readonly hash: Hash,
    private readonly onNew: (envelope: TestEnvelope) => void = () => {},
  ) {}
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private update(patch: Partial<SessionState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  async start(): Promise<void> {
    const generation = this.generation + 1;
    await this.stop();
    if (generation !== this.generation) return;
    this.localContext = await pairingContext(this.store.scope, this.hash);
    this.expected = await pairingContext(
      oppositeScope(this.store.scope),
      this.hash,
    );
    if (generation !== this.generation) return;
    this.active = true;
    this.unsubscribe = this.transport.subscribe((event) => this.event(event));
    this.update({
      phase: "discovering",
      message:
        "Keep both phones open nearby. Cashier advertises; prep finds it.",
      peers: [],
      challenge: null,
    });
    try {
      await this.transport.start(this.localContext, this.store.scope.role);
    } catch (error) {
      if (generation !== this.generation) return;
      await this.stop();
      this.update({
        phase: "error",
        message: `Could not search. Check Bluetooth, nearby-device and local-network permissions in Settings, then retry. ${safeError(error)}`,
      });
    }
  }
  async connect(endpointId: string): Promise<void> {
    if (!this.active || !this.state.peers.includes(endpointId))
      throw new ProtocolError("unknown-peer");
    await this.transport.connect(endpointId);
  }
  async confirm(codeFromOtherPhone: string): Promise<void> {
    const challenge = this.state.challenge;
    if (!this.active || !challenge) throw new ProtocolError("no-challenge");
    if (codeFromOtherPhone.trim() !== challenge.code) {
      await this.transport.confirm(challenge.endpointId, false);
      this.approved = null;
      this.update({
        phase: "error",
        message: "The codes differ. Pair again with the intended test phone.",
        challenge: null,
      });
      throw new ProtocolError("code-mismatch");
    }
    this.approved = challenge.endpointId;
    try {
      await this.transport.confirm(challenge.endpointId, true);
      this.update({
        challenge: null,
        message: "Waiting for the other phone to confirm the same code.",
      });
    } catch (error) {
      this.approved = null;
      throw error;
    }
  }
  async cancelPairing(): Promise<void> {
    const endpoint = this.state.challenge?.endpointId;
    if (endpoint) await this.transport.confirm(endpoint, false);
    await this.stop();
  }
  async stop(paused = false): Promise<void> {
    this.active = false;
    this.attempts.clear();
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.generation++;
    this.endpoint = null;
    this.approved = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
    await this.transport.stop();
    this.update({
      phase: paused ? "paused" : "idle",
      message: paused
        ? "Paused while this phone is away. Saved tests remain; reconnect and compare codes on return."
        : "Disconnected. Saved tests stay on this phone until the other phone confirms receipt.",
      peers: [],
      challenge: null,
    });
  }
  async dispose(): Promise<void> {
    await this.stop();
    this.listeners.clear();
  }
  async save(envelope: TestEnvelope): Promise<void> {
    await this.store.enqueue(envelope);
    this.listeners.forEach((fn) => fn());
    void this.flush();
  }
  async flush(): Promise<void> {
    if (!this.active || !this.endpoint) return;
    if (this.flushing) {
      this.flushAgain = true;
      return this.flushingPromise ?? undefined;
    }
    this.flushing = true;
    this.flushingPromise = this.drain();
    return this.flushingPromise;
  }
  private async drain(): Promise<void> {
    const generation = this.generation;
    let attempted = false;
    try {
      do {
        this.flushAgain = false;
        const batch = await this.store.pending(256);
        attempted = batch.length > 0;
        for (const envelope of batch) {
          if (!this.active || !this.endpoint || generation !== this.generation)
            break;
          if (!this.attempts.has(envelope.messageId))
            this.recordAttempt(envelope.messageId);
          await this.transport.send(this.endpoint, encode(envelope));
        }
      } while (
        this.flushAgain &&
        this.active &&
        this.endpoint &&
        generation === this.generation
      );
    } catch (error) {
      this.update({
        message: `Saved tests are waiting for receipt. Retry after reconnecting. ${safeError(error)}`,
      });
    } finally {
      this.flushing = false;
      this.flushingPromise = null;
      if (attempted && this.active && this.endpoint && !this.retryTimer)
        this.retryTimer = setTimeout(() => {
          this.retryTimer = null;
          void this.flush();
        }, 1_000);
    }
  }
  private event(event: TransportEvent): void {
    if (!this.active) return;
    if (event.type === "found") {
      if (
        event.context === this.expected &&
        this.state.peers.length < 8 &&
        !this.state.peers.includes(event.endpointId)
      )
        this.update({ peers: [...this.state.peers, event.endpointId] });
    } else if (event.type === "lost")
      this.update({
        peers: this.state.peers.filter((id) => id !== event.endpointId),
      });
    else if (event.type === "verification") {
      if (
        event.context !== this.expected ||
        this.endpoint ||
        this.approved ||
        this.state.challenge ||
        !/^[A-Za-z0-9]{4,12}$/.test(event.code)
      ) {
        void this.transport.confirm(event.endpointId, false).catch(() => {});
        return;
      }
      this.update({
        phase: "verify",
        challenge: { endpointId: event.endpointId, code: event.code },
        message:
          "Compare the code in person on both phones. Enter the other phone’s code to confirm.",
      });
    } else if (event.type === "connected") {
      if (this.approved !== event.endpointId) {
        void this.transport.disconnect(event.endpointId).catch(() => {});
        return;
      }
      this.endpoint = event.endpointId;
      this.update({
        phase: "connected",
        peers: [],
        challenge: null,
        message:
          "Test phone connected. Only a saved receipt counts as received.",
      });
      void this.flush();
    } else if (event.type === "disconnected") {
      if (
        event.endpointId !== this.endpoint &&
        event.endpointId !== this.approved &&
        event.endpointId !== this.state.challenge?.endpointId
      )
        return;
      this.endpoint = null;
      this.approved = null;
      this.generation++;
      this.update({
        phase: "idle",
        challenge: null,
        message:
          "Connection lost. Tests remain saved. Reconnect and compare the new code.",
      });
    } else if (event.type === "error")
      this.update({ phase: "error", message: event.message });
    else if (event.type === "bytes") {
      if (event.endpointId !== this.endpoint || this.approved !== this.endpoint)
        return;
      if (
        typeof event.data !== "string" ||
        this.queued >= 64 ||
        byteLength(event.data) > MAX_WIRE_BYTES
      ) {
        this.update({
          message:
            "Incoming test exceeded the safe limit. It was not acknowledged; reconnect to retry.",
        });
        return;
      }
      const generation = this.generation;
      this.queued++;
      this.chain = this.chain
        .then(async () => {
          if (
            !this.active ||
            generation !== this.generation ||
            this.endpoint !== event.endpointId
          )
            return;
          try {
            const packet = await decode(
              event.data,
              this.store.scope,
              this.hash,
            );
            if (packet.type === "data") {
              const result = await this.store.accept(packet);
              // Any receipt is emitted strictly after the exclusive transaction has committed.
              if (result.isNew) {
                try {
                  this.onNew(packet);
                } catch {
                  /* An optional cue cannot roll back a saved inbox row. */
                }
              }
              if (
                this.active &&
                generation === this.generation &&
                this.endpoint === event.endpointId
              )
                await this.transport.send(
                  event.endpointId,
                  encode(result.receipt),
                );
            } else {
              await this.store.acknowledge(packet);
              const began = this.attempts.get(packet.messageId);
              if (began !== undefined) {
                const now = monotonicNow();
                const elapsed = now === null ? -1 : now - began;
                if (elapsed >= 0 && this.latencySamples.length < 10_000)
                  this.latencySamples.push(elapsed);
                this.attempts.delete(packet.messageId);
              }
            }
            this.listeners.forEach((fn) => fn());
          } catch (error) {
            const reason = safeError(error);
            try {
              await this.store.quarantine(reason, event.data);
            } catch {
              /* Storage failure must not cause a receipt. */
            }
            this.update({
              message: `A test was not acknowledged: ${reason}. Saved data is retained; retry after resolving the error.`,
            });
          }
        })
        .finally(() => {
          this.queued--;
        });
    }
  }
  private recordAttempt(messageId: string): void {
    const now = monotonicNow();
    if (now !== null) this.attempts.set(messageId, now);
  }
  /** Foreground process-local receipt timing; never persists or invents a device result. */
  measurements(): {
    sampleSize: number;
    p95Ms: number | null;
    maxMs: number | null;
  } {
    const sorted = [...this.latencySamples].sort((a, b) => a - b);
    return {
      sampleSize: sorted.length,
      p95Ms: sorted.length
        ? (sorted[Math.ceil(sorted.length * 0.95) - 1] ?? null)
        : null,
      maxMs: sorted.length ? (sorted[sorted.length - 1] ?? null) : null,
    };
  }
  /** Test/diagnostic drain; it is not a physical radio-latency measurement. */
  async settled(): Promise<void> {
    await this.chain;
  }
}
function safeError(error: unknown): string {
  return error instanceof ProtocolError
    ? error.code
    : error instanceof Error
      ? error.message.slice(0, 180)
      : "unknown error";
}

function monotonicNow(): number | null {
  const timer = (globalThis as unknown as { performance?: { now(): number } })
    .performance;
  return timer ? timer.now() : null;
}
