import { afterEach, describe, expect, it, vi } from "vitest";
import { FaultNetwork } from "../../src/ep02/fault-transport";
import { encode, makeEnvelope } from "../../src/ep02/protocol";
import { PeerSession, pairingContext } from "../../src/ep02/session";
import { PeerStore } from "../../src/ep02/store";
import { cashier, hash, prep, ReviewSqlite } from "./fixtures";

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  vi.useRealTimers();
});
async function pair(network = new FaultNetwork()) {
  const senderDb = new ReviewSqlite();
  const receiverDb = new ReviewSqlite();
  const senderStore = new PeerStore(senderDb, cashier);
  const receiverStore = new PeerStore(receiverDb, prep);
  await senderStore.initialize();
  await receiverStore.initialize();
  const alerts: string[] = [];
  const a = new PeerSession(senderStore, network.a, hash);
  const b = new PeerSession(receiverStore, network.b, hash, (packet) =>
    alerts.push(packet.messageId),
  );
  cleanup.push(async () => {
    await a.dispose();
    await b.dispose();
    senderDb.dispose();
    receiverDb.dispose();
  });
  await a.start();
  await b.start();
  async function connect() {
    await a.connect("sim-b");
    await a.confirm("4826");
    await b.confirm("4826");
    expect(a.state.phase).toBe("connected");
    expect(b.state.phase).toBe("connected");
  }
  async function pump(advance = 0, reverse = false) {
    for (let count = 0; count < 5; count++) {
      await Promise.resolve();
      network.deliver(count === 0 ? advance : 0, reverse);
      await a.settled();
      await b.settled();
    }
  }
  return {
    network,
    senderDb,
    receiverDb,
    senderStore,
    receiverStore,
    alerts,
    a,
    b,
    connect,
    pump,
  };
}
const envelope = (sequence: number, scope = cashier) =>
  makeEnvelope(
    scope,
    {
      messageId: `fault-${sequence}`,
      sequence,
      number: sequence,
      text: "fixture only",
    },
    hash,
  );

describe("EP02 independent simulated-link faults over real SQLite", () => {
  it("serializes competing starts without leaving duplicate discovery listeners after cancellation", async () => {
    const h = await pair();
    await Promise.all([h.a.start(), h.a.start()]);
    expect(h.network.a.listeners.size).toBe(1);
    await h.a.stop();
    expect(h.network.a.listeners.size).toBe(0);
  });

  it("sends a new save made while another send is waiting, without requiring a third sale or manual retry", async () => {
    const h = await pair();
    await h.connect();
    let releaseSend!: () => void;
    let enteredSend!: () => void;
    const hold = new Promise<void>((resolve) => {
      releaseSend = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      enteredSend = resolve;
    });
    const originalSend = h.network.a.send.bind(h.network.a);
    let first = true;
    h.network.a.send = async (endpointId, raw) => {
      if (first) {
        first = false;
        enteredSend();
        await hold;
      }
      await originalSend(endpointId, raw);
    };
    const firstSave = h.a.save(await envelope(1));
    await entered;
    await h.a.save(await envelope(2));
    expect((await h.senderStore.stats()).saved).toBe(2);
    releaseSend();
    await firstSave;
    await h.pump();
    expect(await h.receiverStore.stats()).toMatchObject({
      received: 2,
      contiguous: 2,
    });
    expect((await h.senderStore.stats()).pending).toBe(0);
  });

  it("automatically retries a 300-message backlog in bounded batches using controlled timers, then cancels timers on stop", async () => {
    vi.useFakeTimers();
    const h = await pair();
    await h.connect();
    for (let sequence = 1; sequence <= 300; sequence++)
      await h.senderStore.enqueue(await envelope(sequence));
    await h.a.flush();
    await h.pump();
    expect((await h.senderStore.stats()).pending).toBe(236);
    for (let cycle = 0; cycle < 5; cycle++) {
      await vi.advanceTimersByTimeAsync(1000);
      await h.pump();
    }
    expect(await h.receiverStore.stats()).toMatchObject({
      received: 300,
      contiguous: 300,
    });
    expect((await h.senderStore.stats()).pending).toBe(0);
    expect(h.alerts).toHaveLength(300);
    await h.a.stop();
    await h.b.stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("survives 20 disconnect/duplicate/lost-ACK cycles without duplicate alerts or forgotten evidence", async () => {
    const h = await pair();
    await h.connect();
    for (let sequence = 1; sequence <= 20; sequence++) {
      h.network.rule = (raw) =>
        JSON.parse(raw).type === "receipt" ? { drop: true } : { duplicate: 2 };
      await h.a.save(await envelope(sequence));
      await h.pump();
      expect((await h.senderStore.stats()).pending).toBe(1);
      expect((await h.receiverStore.stats()).received).toBe(sequence);
      await h.a.stop(true);
      h.network.rule = () => ({ duplicate: 2 });
      await h.a.start();
      await h.connect();
      await h.pump();
      expect((await h.senderStore.stats()).pending).toBe(0);
    }
    expect(await h.receiverStore.stats()).toMatchObject({
      received: 20,
      contiguous: 20,
    });
    expect(h.alerts).toHaveLength(20);
    expect(new Set(h.alerts).size).toBe(20);
  });

  it("EP02-T02 keeps transport-delivered data pending until its durable receipt actually arrives", async () => {
    const h = await pair(
      new FaultNetwork((raw) =>
        JSON.parse(raw).type === "receipt" ? { drop: true } : {},
      ),
    );
    await h.connect();
    await h.a.save(await envelope(1));
    await h.pump();
    expect((await h.receiverStore.stats()).received).toBe(1);
    expect((await h.senderStore.stats()).pending).toBe(1);
    expect(h.alerts).toEqual(["fault-1"]);
    h.network.rule = () => ({ duplicate: 2 });
    await h.a.flush();
    await h.pump();
    expect((await h.senderStore.stats()).pending).toBe(0);
    expect((await h.receiverStore.stats()).received).toBe(1);
    expect(h.alerts).toEqual(["fault-1"]);
  });

  it("EP02-T04 independently drops, duplicates, delays and reverses messages, retaining truthful gaps and catching up", async () => {
    const h = await pair(
      new FaultNetwork((raw) => {
        const packet = JSON.parse(raw);
        if (packet.type === "data" && packet.sequence === 1)
          return { drop: true };
        if (packet.type === "data" && packet.sequence === 2)
          return { delay: 100, duplicate: 2 };
        return { duplicate: 1 };
      }),
    );
    await h.connect();
    for (let n = 1; n <= 3; n++) await h.a.save(await envelope(n));
    await h.pump(0, true);
    expect(await h.receiverStore.stats()).toMatchObject({
      received: 1,
      contiguous: 0,
    });
    expect((await h.senderStore.stats()).pending).toBe(2);
    await h.pump(100, true);
    expect(await h.receiverStore.stats()).toMatchObject({
      received: 2,
      contiguous: 0,
    });
    h.network.rule = () => ({});
    await h.a.flush();
    await h.pump();
    expect(await h.receiverStore.stats()).toMatchObject({
      received: 3,
      contiguous: 3,
    });
    expect((await h.senderStore.stats()).pending).toBe(0);
    expect(new Set(h.alerts).size).toBe(3);
    expect(h.alerts).toHaveLength(3);
  });

  it("round-trips authorized prep commands separately from cashier numbered orders", async () => {
    const h = await pair();
    await h.connect();
    await h.a.save(await envelope(1));
    await h.b.save(await envelope(1, prep));
    await h.pump();
    expect(await h.senderStore.stats()).toMatchObject({
      saved: 1,
      received: 1,
      pending: 0,
    });
    expect(await h.receiverStore.stats()).toMatchObject({
      saved: 1,
      received: 1,
      pending: 0,
    });
  });

  it("does not auto-trust a connected event or accept data before both codes are confirmed", async () => {
    const h = await pair();
    await h.a.connect("sim-b");
    await h.a.confirm("4826");
    expect(h.network.a.connected).toBe(false);
    h.network.b.emit({ type: "connected", endpointId: "sim-a" });
    h.network.b.emit({
      type: "bytes",
      endpointId: "sim-a",
      data: encode(await envelope(1)),
    });
    await h.pump();
    expect((await h.receiverStore.stats()).received).toBe(0);
    expect(h.b.state.phase).not.toBe("connected");
  });

  it("rejects mismatched verification codes and discards challenges on cancellation", async () => {
    const h = await pair();
    await h.a.connect("sim-b");
    await expect(h.a.confirm("0000")).rejects.toThrow("code-mismatch");
    expect(h.network.a.connected).toBe(false);
    expect(h.network.b.connected).toBe(false);
    await h.a.cancelPairing();
    expect(h.a.state.phase).toBe("idle");
    expect(h.a.state.challenge).toBeNull();
    expect(h.network.a.listeners.size).toBe(0);
  });

  it("rejects an advertised or verification scope for another shift without nearby auto-trust", async () => {
    const h = await pair();
    const foreignContext = await pairingContext(
      { ...prep, shiftId: "foreign-shift" },
      hash,
    );
    h.network.a.emit({
      type: "found",
      endpointId: "foreign",
      context: foreignContext,
    });
    h.network.a.emit({
      type: "verification",
      endpointId: "foreign",
      context: foreignContext,
      code: "4826",
    });
    expect(h.a.state.peers).not.toContain("foreign");
    expect(h.a.state.challenge).toBeNull();
    await expect(h.a.connect("foreign")).rejects.toThrow("unknown-peer");
  });

  it("EP02-T05 controlled permission denial cleans listeners and recovers after grant without clearing saved data", async () => {
    const h = await pair();
    await h.a.save(await envelope(1));
    h.network.a.denyPermissions = true;
    await h.a.start();
    expect(h.a.state.phase).toBe("error");
    expect(h.a.state.message).toMatch(/Settings.*retry/i);
    expect(h.network.a.listeners.size).toBe(0);
    expect((await h.senderStore.stats()).pending).toBe(1);
    h.network.a.denyPermissions = false;
    await h.a.start();
    await h.connect();
    await h.pump();
    expect((await h.senderStore.stats()).pending).toBe(0);
  });

  it("EP02-T03 controlled background stop invalidates authorization and resumes pending work only after fresh confirmation", async () => {
    const h = await pair(new FaultNetwork(() => ({ drop: true })));
    await h.connect();
    await h.a.save(await envelope(1));
    await h.a.stop(true);
    expect(h.a.state.phase).toBe("paused");
    expect(h.network.a.listeners.size).toBe(0);
    expect((await h.senderStore.stats()).pending).toBe(1);
    h.network.rule = () => ({});
    await h.a.start();
    await h.pump();
    expect((await h.receiverStore.stats()).received).toBe(0);
    await h.connect();
    await h.pump();
    expect((await h.senderStore.stats()).pending).toBe(0);
  });

  it("never emits a receipt after real SQLite write failure and recovers retained sender work on retry", async () => {
    const h = await pair();
    await h.connect();
    h.receiverDb.db.exec("PRAGMA query_only=ON");
    await h.a.save(await envelope(1));
    await h.pump();
    expect((await h.receiverStore.stats()).received).toBe(0);
    expect((await h.senderStore.stats()).pending).toBe(1);
    expect(h.alerts).toEqual([]);
    expect(h.b.state.message).toMatch(/not acknowledged/i);
    h.receiverDb.db.exec("PRAGMA query_only=OFF");
    await h.a.flush();
    await h.pump();
    expect((await h.receiverStore.stats()).received).toBe(1);
    expect((await h.senderStore.stats()).pending).toBe(0);
    expect(h.alerts).toEqual(["fault-1"]);
  });

  it("quarantines wrong-shift bytes and processes a later valid packet without losing its receive chain", async () => {
    const h = await pair();
    await h.connect();
    const foreign = await makeEnvelope(
      { ...cashier, shiftId: "foreign-shift" },
      { messageId: "foreign", sequence: 1, number: 1, text: "wrong shift" },
      hash,
    );
    await h.network.a.send("sim-b", encode(foreign));
    await h.network.a.send("sim-b", "malformed{");
    await h.pump();
    expect((await h.receiverStore.stats()).received).toBe(0);
    const quarantine = await h.receiverDb.all<{ reason: string }>(
      "SELECT reason FROM ep02_quarantine ORDER BY id",
    );
    expect(quarantine.map((row) => row.reason)).toEqual([
      "wrong-scope",
      "malformed",
    ]);
    await h.a.save(await envelope(1));
    await h.pump();
    expect((await h.receiverStore.stats()).received).toBe(1);
    expect((await h.senderStore.stats()).pending).toBe(0);
  });

  it("bounds the queued receive burst and leaves dropped excess pending for an explicit retry", async () => {
    const h = await pair();
    await h.connect();
    for (let sequence = 1; sequence <= 80; sequence++)
      await h.senderStore.enqueue(await envelope(sequence));
    await h.a.flush();
    await h.pump();
    expect((await h.receiverStore.stats()).received).toBe(64);
    expect((await h.senderStore.stats()).pending).toBe(16);
    await h.a.flush();
    await h.pump();
    expect(await h.receiverStore.stats()).toMatchObject({
      received: 80,
      contiguous: 80,
    });
    expect((await h.senderStore.stats()).pending).toBe(0);
    expect(h.alerts).toHaveLength(80);
  });
});
