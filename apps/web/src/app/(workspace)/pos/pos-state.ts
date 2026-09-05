export type PosCartState = Readonly<Record<string, number>>;

export type PosCartAction =
  | { type: "set_quantity"; productId: string; quantity: number }
  | { type: "reset" }
  | { type: "restore"; cart: PosCartState };

export function posCartReducer(
  state: PosCartState,
  action: PosCartAction,
): PosCartState {
  if (action.type === "reset") return {};
  if (action.type === "restore") return action.cart;

  if (action.quantity <= 0) {
    const next = { ...state };
    delete next[action.productId];
    return next;
  }

  return { ...state, [action.productId]: Math.floor(action.quantity) };
}
