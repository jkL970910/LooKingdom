import type { Coupon } from "./domain";
import { useKind } from "./coupon-flow";
export function couponCategory(card: Coupon) {
  return JSON.stringify([card.owner, card.title.trim(), useKind(card), useKind(card) === "timed" ? "" : card.benefit.trim()]);
}
export type CouponGroup = Coupon & { variants: Coupon[]; totalMinutes: number };
export function groupCoupons(cards: Coupon[]): CouponGroup[] {
  const groups = new Map<string, CouponGroup>();
  for (const card of cards) {
    const key = couponCategory(card);
    const group = groups.get(key);
    if (group) {
      group.remaining += card.remaining;
      group.count += card.count;
      group.totalMinutes += card.remaining * card.minutes;
      group.variants.push(card);
    } else groups.set(key, { ...card, variants: [card], totalMinutes: card.remaining * card.minutes });
  }
  return [...groups.values()];
}
