import { requireOptionalNativeModule } from "expo-modules-core";
import * as Crypto from "expo-crypto";
import * as SQLite from "expo-sqlite";
import { PermissionsAndroid, Platform } from "react-native";
import {
  PeerStore,
  type SqlDatabase,
  type SqlExecutor,
  type SqlValue,
} from "./store";
import {
  PeerSession,
  type PeerTransport,
  type TransportEvent,
} from "./session";
import type { Hash, PeerScope, Role } from "./protocol";
interface NativePeerModule {
  isAvailable(): boolean;
  start(context: string, role: Role): Promise<void>;
  connect(endpoint: string): Promise<void>;
  confirm(endpoint: string, accept: boolean): Promise<void>;
  send(endpoint: string, data: string): Promise<void>;
  disconnect(endpoint: string): Promise<void>;
  stop(): Promise<void>;
  addListener(
    event: "onPeerEvent",
    listener: (event: TransportEvent) => void,
  ): { remove(): void };
}
export const hash: Hash = (value) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
function executor(db: SQLite.SQLiteDatabase): SqlExecutor {
  return {
    async run(sql: string, params: SqlValue[] = []) {
      await db.runAsync(sql, params);
    },
    all<T>(sql: string, params: SqlValue[] = []) {
      return db.getAllAsync<T>(sql, params);
    },
  };
}
function sqliteAdapter(db: SQLite.SQLiteDatabase): SqlDatabase {
  return {
    ...executor(db),
    async exclusive<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
      let result!: T;
      await db.withExclusiveTransactionAsync(async (tx) => {
        result = await work(executor(tx));
      });
      return result;
    },
  };
}
async function requestAndroidPermissions(): Promise<void> {
  if (Platform.OS !== "android") return;
  const version = Number(Platform.Version);
  const permissions: string[] =
    version >= 31
      ? [
          "android.permission.BLUETOOTH_SCAN",
          "android.permission.BLUETOOTH_CONNECT",
          "android.permission.BLUETOOTH_ADVERTISE",
        ]
      : [];
  if (version <= 31)
    permissions.push("android.permission.ACCESS_FINE_LOCATION");
  if (version >= 33) permissions.push("android.permission.NEARBY_WIFI_DEVICES");
  if (version >= 37)
    permissions.push("android.permission.ACCESS_LOCAL_NETWORK");
  const result = await PermissionsAndroid.requestMultiple(
    permissions as Parameters<typeof PermissionsAndroid.requestMultiple>[0],
  );
  if (
    Object.values(result).some(
      (value) => value !== PermissionsAndroid.RESULTS.GRANTED,
    )
  )
    throw new Error(
      "Nearby access was denied. Allow Nearby devices and any requested location/local-network access in Settings, then retry.",
    );
}
export function nativeTransport(): PeerTransport {
  const native = requireOptionalNativeModule<NativePeerModule>("MinirosPeer");
  if (!native || !native.isAvailable())
    throw new Error(
      "This needs the MINIROS Peer Spike native build. Expo Go and browser previews cannot test the two-phone link.",
    );
  return {
    subscribe(listener) {
      const subscription = native.addListener("onPeerEvent", listener);
      return () => subscription.remove();
    },
    async start(context, role) {
      await requestAndroidPermissions();
      await native.start(context, role);
    },
    connect: (endpoint) => native.connect(endpoint),
    confirm: (endpoint, accepted) => native.confirm(endpoint, accepted),
    send: (endpoint, data) => native.send(endpoint, data),
    disconnect: (endpoint) => native.disconnect(endpoint),
    stop: () => native.stop(),
  };
}
/** Only synthetic identities: EP07 enrollment and production grants are deliberately absent. */
export async function createNativeSpike(
  role: Role,
  pairingId: string,
): Promise<{ session: PeerSession; close: () => Promise<void> }> {
  const transport = nativeTransport();
  const scope: PeerScope = {
    businessId: "ep02-synthetic-business",
    shiftId: "ep02-synthetic-shift",
    snapshotId: "ep02-synthetic-snapshot",
    snapshotHash: await hash("ep02-synthetic-catalog-v1"),
    authorityEpoch: 1,
    pairingId,
    localDeviceId:
      role === "cashier" ? "ep02-cashier-phone" : "ep02-prep-phone",
    peerDeviceId: role === "cashier" ? "ep02-prep-phone" : "ep02-cashier-phone",
    role,
  };
  const db = await SQLite.openDatabaseAsync("miniros-ep02-spike.db");
  const store = new PeerStore(sqliteAdapter(db), scope);
  try {
    await store.initialize();
  } catch (error) {
    await db.closeAsync();
    throw error;
  }
  const session = new PeerSession(store, transport, hash);
  return {
    session,
    async close() {
      await session.dispose();
      await session.settled();
      await db.closeAsync();
    },
  };
}
