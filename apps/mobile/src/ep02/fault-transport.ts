import { ProtocolError, type PeerScope } from "./protocol";
import type { PeerTransport, TransportEvent } from "./session";
export interface FaultRule {
  drop?: boolean;
  duplicate?: number;
  delay?: number;
}
interface Delivery {
  due: number;
  recipient: FaultTransport;
  event: TransportEvent;
}
/** Explicit simulated transport. No native, encryption, timing or device-evidence claim. */
export class FaultNetwork {
  private time = 0;
  private deliveries: Delivery[] = [];
  private sent = 0;
  readonly a = new FaultTransport(this, "sim-a");
  readonly b = new FaultTransport(this, "sim-b");
  constructor(
    public rule: (
      data: string,
      count: number,
      from: string,
    ) => FaultRule = () => ({}),
  ) {}
  counterpart(sender: FaultTransport): FaultTransport {
    return sender === this.a ? this.b : this.a;
  }
  enqueue(sender: FaultTransport, data: string): void {
    const recipient = this.counterpart(sender);
    const rule = this.rule(data, ++this.sent, sender.id);
    if (rule.drop) return;
    const copies = Math.min(8, 1 + Math.max(0, rule.duplicate ?? 0));
    if (this.deliveries.length + copies > 1024)
      throw new ProtocolError("simulation-queue-bound");
    for (let i = 0; i < copies; i++)
      this.deliveries.push({
        due: this.time + Math.max(0, rule.delay ?? 0),
        recipient,
        event: { type: "bytes", endpointId: sender.id, data },
      });
  }
  deliver(advance = 0, reverse = false): number {
    this.time += advance;
    const ready = this.deliveries.filter((item) => item.due <= this.time);
    this.deliveries = this.deliveries.filter((item) => item.due > this.time);
    if (reverse) ready.reverse();
    for (const item of ready) {
      if (item.recipient.connected) item.recipient.emit(item.event);
    }
    return ready.length;
  }
  clear(): void {
    this.deliveries = [];
  }
}
export class FaultTransport implements PeerTransport {
  listeners = new Set<(event: TransportEvent) => void>();
  context = "";
  active = false;
  connected = false;
  accepted = false;
  denyPermissions = false;
  constructor(
    private readonly network: FaultNetwork,
    readonly id: string,
  ) {}
  subscribe(listener: (event: TransportEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  emit(event: TransportEvent): void {
    for (const listener of this.listeners) listener(event);
  }
  async start(context: string, _role: PeerScope["role"]): Promise<void> {
    if (!["cashier", "prep"].includes(_role))
      throw new ProtocolError("invalid-role");
    if (this.denyPermissions) throw new ProtocolError("permission-denied");
    this.active = true;
    this.context = context;
    const other = this.network.counterpart(this);
    if (other.active) {
      this.emit({
        type: "found",
        endpointId: other.id,
        context: other.context,
      });
      other.emit({ type: "found", endpointId: this.id, context });
    }
  }
  async connect(endpointId: string): Promise<void> {
    const other = this.network.counterpart(this);
    if (!this.active || !other.active || endpointId !== other.id)
      throw new ProtocolError("peer-unavailable");
    this.emit({
      type: "verification",
      endpointId: other.id,
      code: "4826",
      context: other.context,
    });
    other.emit({
      type: "verification",
      endpointId: this.id,
      code: "4826",
      context: this.context,
    });
  }
  async confirm(endpointId: string, accepted: boolean): Promise<void> {
    const other = this.network.counterpart(this);
    if (endpointId !== other.id) throw new ProtocolError("unknown-peer");
    if (!accepted) {
      await this.disconnect(endpointId);
      return;
    }
    this.accepted = true;
    if (other.accepted && this.active && other.active) {
      this.connected = other.connected = true;
      this.emit({ type: "connected", endpointId: other.id });
      other.emit({ type: "connected", endpointId: this.id });
    }
  }
  async send(endpointId: string, data: string): Promise<void> {
    if (!this.connected || endpointId !== this.network.counterpart(this).id)
      throw new ProtocolError("disconnected");
    this.network.enqueue(this, data);
  }
  async disconnect(_endpointId: string): Promise<void> {
    const other = this.network.counterpart(this);
    if (_endpointId !== other.id) throw new ProtocolError("unknown-peer");
    this.connected = other.connected = this.accepted = other.accepted = false;
    this.network.clear();
    this.emit({ type: "disconnected", endpointId: other.id });
    other.emit({ type: "disconnected", endpointId: this.id });
  }
  async stop(): Promise<void> {
    this.active = false;
    await this.disconnect(this.network.counterpart(this).id);
  }
}
