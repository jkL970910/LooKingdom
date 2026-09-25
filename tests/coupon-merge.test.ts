import assert from "node:assert/strict";
import { test } from "node:test";
import { applyCommand, commandSchema, makeSeed, type Coupon, type Command } from "../src/lib/domain";
import { normalizeState } from "../src/lib/lifestyle";
const now = "2026-09-25T12:00:00.000Z";
function fixture() { const s = makeSeed(); s.coupons = [s.coupons[0]]; return s; }
function gift(card: Coupon, overrides = {}): Command {
 return commandSchema.parse({ type: "coupon.create", requestId: crypto.randomUUID(), coupon: { ...card, count: 1, ...overrides } });
}
test("repeat gifts add quantity and duration once, including after serialization", () => {
 let s = fixture(); const cmd = gift(s.coupons[0]);
 s = applyCommand(s, cmd, "red", now);
 assert.equal(s.coupons.length, 1); assert.equal(s.coupons[0].count, 4);
 assert.equal(s.coupons[0].remaining, 4); assert.equal(s.coupons[0].remaining * s.coupons[0].minutes, 60);
 assert.deepEqual(applyCommand(JSON.parse(JSON.stringify(s)), cmd, "red", now), s);
 assert.throws(() => applyCommand(s, cmd, "blue", now), /只能送给对方/);
});
test("legacy duplicates retain balances, active requests, history and old IDs", () => {
 let s = fixture(); const original = structuredClone(s);
 const duplicate = { ...s.coupons[0], id: crypto.randomUUID(), count: 2, remaining: 1 };
 s.coupons.push(duplicate);
 const requestId = crypto.randomUUID();
 s = applyCommand(s, { type: "coupon.request", id: duplicate.id, requestId }, "blue", now);
 assert.equal(s.coupons.length, 1); assert.equal(s.coupons[0].count, 5); assert.equal(s.coupons[0].remaining, 4);
 assert.equal(s.couponUses[0].couponId, s.coupons[0].id);
 assert.deepEqual(applyCommand(s, { type: "coupon.request", id: duplicate.id, requestId }, "blue", now), s);
 s = applyCommand(s, { type: "coupon.accept", id: requestId }, "red", now);
 s = applyCommand(s, gift(s.coupons[0]), "red", now);
 assert.equal(s.coupons[0].remaining, 5);
 s = applyCommand(s, { type: "profile", activity: 0, mood: 0, note: "" }, "blue", "2026-09-25T13:00:00.000Z");
 assert.equal(s.coupons[0].remaining, 4); assert.equal(s.redemptions.length, 1);
 assert.equal(s.redemptions[0].minutes, 15);
 assert.deepEqual(normalizeState(normalizeState(s)), normalizeState(s));
 assert.equal(original.coupons[0].remaining, 3);
 const replay = commandSchema.parse({ type: "coupon.create", requestId: duplicate.id, coupon: duplicate });
 assert.deepEqual(applyCommand(s, replay, "red", "2026-09-25T13:00:00.000Z"), s);
});
test("different owners or entitlement terms remain separate; cosmetic differences merge", () => {
 const base = fixture(); const card = base.coupons[0];
 for (const changes of [{minutes:30}, {expires:"2027-01-01"}, {title:"另一种卡"}, {useKind:"instant", minutes:0}]) {
  assert.equal(applyCommand(base, gift(card, changes), "red", now).coupons.length, 2);
 }
 assert.equal(applyCommand(base, gift(card, {owner:"red"}), "blue", now).coupons.length, 2);
 assert.equal(applyCommand(base, gift(card, {description:"新的赠言", color:"coral"}), "red", now).coupons.length, 1);
 assert.equal(base.coupons[0].remaining, 3);
});

test("migration remaps pre-existing active uses and historical references without rewriting snapshots", () => {
 let a = fixture();
 a = applyCommand(a, {type:"coupon.request", id:a.coupons[0].id, requestId:crypto.randomUUID()}, "blue", now);
 a = applyCommand(a, {type:"coupon.accept", id:a.couponUses[0].id}, "red", now);
 const b = structuredClone(a.coupons[0]); b.id = crypto.randomUUID(); b.issueIds = [b.id]; b.count = 1; b.remaining = 1;
 a.coupons.push(b);
 a.couponUses.push({...a.couponUses[0], id:crypto.randomUUID(), couponId:b.id});
 a.redemptions.push({id:"past",requestId:"past",couponId:b.id,title:b.title,owner:b.owner,minutes:15,benefit:b.benefit,createdAt:now,remaining:1});
 const before = structuredClone(a);
 const normalized = normalizeState(a);
 assert.deepEqual(a,before);
 assert.equal(normalized.coupons.length,1);
 assert.ok(normalized.couponUses.every(u=>u.couponId===a.coupons[0].id));
 assert.equal(normalized.redemptions[0].couponId,a.coupons[0].id);
 assert.equal(normalized.redemptions[0].remaining,1);
 const settled = applyCommand(normalized,{type:"profile",activity:0,mood:0,note:""},"blue","2026-09-25T13:00:00.000Z");
 assert.equal(settled.coupons[0].remaining,2);
 assert.equal(settled.redemptions.length,3);
});

test("mixed durations form one 4-card 75-minute category, while redemption spends only the chosen denomination", async () => {
 const {groupCoupons} = await import("../src/lib/coupon-groups");
 let s = fixture();
 s = applyCommand(s, gift(s.coupons[0], {minutes:30, benefit:"每次 30 分钟"}), "red", now);
 let groups = groupCoupons(s.coupons);
 assert.equal(groups.length,1); assert.equal(groups[0].remaining,4); assert.equal(groups[0].totalMinutes,75);
 const card30 = s.coupons.find(c=>c.minutes===30)!;
 const id=crypto.randomUUID();
 s=applyCommand(s,{type:"coupon.request",id:card30.id,requestId:id},"blue",now);
 assert.equal(s.couponUses[0].minutes,30);
 s=applyCommand(s,{type:"coupon.accept",id},"red",now);
 s=applyCommand(s,{type:"profile",activity:0,mood:0,note:""},"blue","2026-09-25T13:00:00.000Z");
 assert.equal(s.coupons.find(c=>c.minutes===15)!.remaining,3);
 assert.equal(s.coupons.find(c=>c.minutes===30)!.remaining,0);
 groups=groupCoupons(s.coupons.filter(c=>c.remaining>0));
 assert.equal(groups[0].remaining,3);assert.equal(groups[0].totalMinutes,45);
 assert.equal(s.redemptions[0].minutes,30);
});
