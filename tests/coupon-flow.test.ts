import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyCommand,
  makeSeed,
  type Command,
  type KingdomState,
} from "../src/lib/domain";
import { settleCouponUses, activeUseFor } from "../src/lib/coupon-flow";
import { resolveTimeZone } from "../src/lib/time-zone";
const start = "2026-09-21T15:00:00.000Z";
const run = (
  s: KingdomState,
  c: Command,
  actor: "blue" | "red" = "blue",
  now = start,
) => applyCommand(s, c, actor, now);
function request(card = "demo-blue-0") {
  return run(makeSeed(), {
    type: "coupon.request",
    id: card,
    requestId: crypto.randomUUID(),
  });
}
test("request reserves one use, only partner accepts, timer starts on acceptance and settles once at deadline", () => {
  let s = request();
  const id = s.couponUses[0].id;
  assert.equal(s.coupons[0].remaining, 3);
  assert.equal(s.redemptions.length, 0);
  assert.ok(activeUseFor(s, "demo-blue-0"));
  assert.throws(() => run(s, { type: "coupon.accept", id }), /另一位/);
  assert.throws(
    () =>
      run(s, {
        type: "coupon.request",
        id: "demo-blue-0",
        requestId: crypto.randomUUID(),
      }),
    /未完成/,
  );
  s = run(s, { type: "coupon.accept", id }, "red", "2026-09-21T15:05:00.000Z");
  assert.equal(s.couponUses[0].endsAt, "2026-09-21T15:20:00.000Z");
  assert.equal(s.coupons[0].remaining, 3);
  assert.deepEqual(settleCouponUses(s, "2026-09-21T15:19:59.000Z"), s);
  s = settleCouponUses(s, "2026-09-21T16:00:00.000Z");
  assert.equal(s.coupons[0].remaining, 2);
  assert.equal(s.redemptions[0].minutes, 15);
  assert.equal(s.redemptions[0].createdAt, "2026-09-21T15:20:00.000Z");
  assert.deepEqual(settleCouponUses(s, "2026-09-22T16:00:00.000Z"), s);
  assert.throws(
    () =>
      run(
        s,
        { type: "coupon.cancel", id, reason: "" },
        "red",
        "2026-09-21T16:00:00.000Z",
      ),
    /已结束/,
  );
});
test("decline, withdrawal and in-progress cancellation do not charge and release reservation", () => {
  for (const type of ["coupon.decline", "coupon.cancel"] as const) {
    let s = request();
    s = run(
      s,
      { type, id: s.couponUses[0].id, reason: "下次一起" },
      type === "coupon.decline" ? "red" : "blue",
    );
    assert.equal(s.coupons[0].remaining, 3);
    assert.equal(s.redemptions.length, 0);
    assert.equal(activeUseFor(s, "demo-blue-0"), undefined);
  }
  let s = request();
  const id = s.couponUses[0].id;
  s = run(s, { type: "coupon.accept", id }, "red");
  s = run(
    s,
    { type: "coupon.cancel", id, reason: "今天临时有事" },
    "blue",
    "2026-09-21T15:05:00.000Z",
  );
  s = settleCouponUses(s, "2026-09-21T16:00:00.000Z");
  assert.equal(s.coupons[0].remaining, 3);
  assert.equal(s.couponUses[0].status, "cancelled");
});
test("pending expired request cannot be accepted; previously accepted session can finish across expiry", () => {
  let s = request();
  s.coupons[0].expires = "2026-09-21";
  const id = s.couponUses[0].id;
  assert.throws(
    () =>
      run(s, { type: "coupon.accept", id }, "red", "2026-09-22T05:00:00.000Z"),
    /已经结束/,
  );
  s = run(s, { type: "coupon.accept", id }, "red", "2026-09-22T03:59:00.000Z");
  s = settleCouponUses(s, "2026-09-22T04:14:00.000Z");
  assert.equal(s.coupons[0].remaining, 2);
});
test("instant coupons charge only on partner acceptance and retries do not charge again", () => {
  let s = request("demo-blue-1");
  const id = s.couponUses[0].id;
  assert.equal(s.coupons[1].remaining, 1);
  s = run(s, { type: "coupon.accept", id }, "red");
  assert.equal(s.coupons[1].remaining, 0);
  assert.deepEqual(run(s, { type: "coupon.accept", id }, "red"), s);
  assert.equal(s.redemptions.length, 1);
});
test("goods record requires partner confirmation, detects edits and snapshots actual product values", () => {
  let s = request("demo-blue-3");
  const id = s.couponUses[0].id;
  s = run(s, { type: "coupon.accept", id }, "red");
  assert.equal(s.couponUses[0].status, "awaiting_fulfillment");
  const product = {
    name: "小金豆",
    parameters: "1g / 足金999 / 商家A",
    price: 800.5,
    currency: "CNY" as const,
    date: "2026-09-21",
    photoId: null,
    note: "第一颗",
  };
  s = run(
    s,
    {
      type: "coupon.product",
      id,
      expectedUpdatedAt: s.couponUses[0].updatedAt,
      product,
    },
    "red",
    "2026-09-21T15:01:00.000Z",
  );
  assert.equal(s.coupons[3].remaining, 1);
  assert.throws(
    () =>
      run(
        s,
        {
          type: "coupon.confirm-product",
          id,
          expectedUpdatedAt: s.couponUses[0].updatedAt,
        },
        "red",
      ),
    /另一位/,
  );
  assert.throws(
    () =>
      run(s, { type: "coupon.confirm-product", id, expectedUpdatedAt: start }),
    /更新/,
  );
  s = run(
    s,
    {
      type: "coupon.confirm-product",
      id,
      expectedUpdatedAt: s.couponUses[0].updatedAt,
    },
    "blue",
    "2026-09-21T15:02:00.000Z",
  );
  assert.equal(s.coupons[3].remaining, 0);
  assert.equal(s.couponUses[0].product?.price, 800.5);
  assert.equal(s.couponUses[0].confirmedBy, "blue");
  assert.throws(
    () =>
      run(
        s,
        {
          type: "coupon.product",
          id,
          expectedUpdatedAt: s.couponUses[0].updatedAt,
          product,
        },
        "red",
      ),
    /不能填写/,
  );
});
test("returning a product record preserves details for correction without charging", () => {
  let s = request("demo-blue-2");
  const id = s.couponUses[0].id;
  s = run(s, { type: "coupon.accept", id }, "red");
  s = run(
    s,
    {
      type: "coupon.product",
      id,
      expectedUpdatedAt: s.couponUses[0].updatedAt,
      product: {
        name: "Loo猫",
        parameters: "橘猫",
        price: 0,
        currency: "CAD",
        date: "2026-09-21",
        photoId: null,
        note: "",
      },
    },
    "red",
  );
  s = run(s, {
    type: "coupon.return-product",
    id,
    expectedUpdatedAt: s.couponUses[0].updatedAt,
    reason: "加上生日吧",
  });
  assert.equal(s.couponUses[0].status, "awaiting_fulfillment");
  assert.equal(s.couponUses[0].product?.name, "Loo猫");
  assert.equal(s.coupons[2].remaining, 1);
});
test("display time zone resolves Toronto, Beijing and device without changing shared calendar", () => {
  assert.equal(resolveTimeZone("toronto", "Europe/London"), "America/Toronto");
  assert.equal(resolveTimeZone("beijing"), "Asia/Shanghai");
  assert.equal(resolveTimeZone("local", "Asia/Tokyo"), "Asia/Tokyo");
  assert.equal(resolveTimeZone("local", "invalid"), "America/Toronto");
  assert.equal(makeSeed().timeZone, "America/Toronto");
});
