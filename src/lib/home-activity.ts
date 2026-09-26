import type { CouponUse } from "./coupon-flow";
// A temporary presentation derived from the accepted timer; never overwrite profiles.
export function activeHeadMassage(uses: CouponUse[], now: number) {
  return uses.filter(u => u.kind === "timed" && u.title.includes("揉头") &&
    u.status === "in_progress" && u.startedAt && Date.parse(u.startedAt) <= now &&
    u.endsAt && Date.parse(u.endsAt) > now)
    .sort((a,b) => (b.startedAt || "").localeCompare(a.startedAt || ""))[0];
}
