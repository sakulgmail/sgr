export const WORK_REQUEST_STATUSES = {
  SUBMITTED: "submitted",
  REJECTED: "rejected",
  APPROVED: "approved",
  PREPARING: "preparing_goods_sampling",
  READY_TO_SHIP: "ready_to_ship",
  SHIPPED: "shipped"
};

const transitions = new Set([
  "submitted->approved",
  "submitted->rejected",
  "approved->preparing_goods_sampling",
  "preparing_goods_sampling->ready_to_ship",
  "ready_to_ship->shipped"
]);

export function canTransition(from, to) {
  return transitions.has(`${from}->${to}`);
}
