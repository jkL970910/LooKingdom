import type { Coupon, KingdomState } from "./domain";
import { useKind } from "./coupon-flow";

// Presentation differences do not create a new entitlement. Different terms do.
function identity(card: Coupon) {
  return JSON.stringify([card.owner, card.title.trim(), useKind(card), card.minutes,
    useKind(card) === "timed" ? "" : card.benefit.trim(), card.expires]);
}
export function mergeCoupons(state: KingdomState): KingdomState {
  const groups = new Map<string, Coupon>();
  const aliases = new Map<string, string>();
  const coupons: Coupon[] = [];
  for (const card of state.coupons) {
    const key = identity(card);
    const ids = [...new Set([card.id, ...(card.issueIds || [])])];
    const existing = groups.get(key);
    if (existing) {
      existing.count += card.count;
      existing.remaining += card.remaining;
      existing.issueIds = [...new Set([...(existing.issueIds || []), ...ids])];
      for (const id of ids) aliases.set(id, existing.id);
    } else {
      const copy = { ...card, issueIds: ids };
      groups.set(key, copy);
      coupons.push(copy);
      for (const id of ids) aliases.set(id, copy.id);
    }
  }
  return {
    ...state, coupons,
    couponUses: (state.couponUses || []).map(u => ({ ...u, couponId: aliases.get(u.couponId) ?? u.couponId })),
    redemptions: state.redemptions.map(r => ({ ...r, couponId: aliases.get(r.couponId) ?? r.couponId })),
  };
}
