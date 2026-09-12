import type { Hash, Role } from "./protocol";
import type { PeerSession } from "./session";
const unsupported =
  "This needs the MINIROS Peer Spike native build. Browser previews and Expo Go cannot test the two-phone link.";
export const hash: Hash = async () => {
  throw new Error(unsupported);
};
export async function createNativeSpike(
  role: Role,
  pairingId: string,
): Promise<{ session: PeerSession; close: () => Promise<void> }> {
  if (!role || !pairingId) throw new Error("Choose a role and test group.");
  throw new Error(unsupported);
}
