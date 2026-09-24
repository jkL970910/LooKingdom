import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyCommand,
  commandSchema,
  daysUntil,
  makeSeed,
  nextOccurrence,
  today,
} from "../src/lib/domain";
import { createToken, verifyToken } from "../src/lib/auth";
import { settleCouponUses } from "../src/lib/coupon-flow";

test("timed coupon deducts exactly one use and derived duration stays correct", () => {
  const seed = makeSeed();
  let next = applyCommand(
    seed,
    {
      type: "coupon.redeem",
      id: "demo-blue-0",
      requestId: crypto.randomUUID(),
    },
    "blue",
  );
  assert.equal(next.coupons[0].remaining, 3);
  next = applyCommand(
    next,
    { type: "coupon.accept", id: next.couponUses[0].id },
    "red",
  );
  next = settleCouponUses(next, next.couponUses[0].endsAt!);
  const coupon = next.coupons.find((c) => c.id === "demo-blue-0")!;
  assert.equal(coupon.remaining, 2);
  assert.equal(coupon.remaining * coupon.minutes, 30);
  assert.equal(next.redemptions.length, 1);
  assert.equal(next.redemptions[0].minutes, 15);
  assert.equal(seed.coupons[0].remaining, 3, "input state is not mutated");
});
test("retrying the same redemption cannot spend twice", () => {
  const command = {
    type: "coupon.redeem" as const,
    id: "demo-blue-0",
    requestId: crypto.randomUUID(),
  };
  const next = applyCommand(makeSeed(), command, "blue");
  const retry = applyCommand(next, command, "blue");
  assert.deepEqual(retry, next);
});
test("coupon owner is enforced on server, including replay attacks", () => {
  const command = {
    type: "coupon.redeem" as const,
    id: "demo-blue-0",
    requestId: crypto.randomUUID(),
  };
  assert.throws(() => applyCommand(makeSeed(), command, "red"), /专属/);
  const next = applyCommand(makeSeed(), command, "blue");
  assert.throws(() => applyCommand(next, command, "red"), /不匹配/);
});
test("exhaustion and expiry cannot produce a negative balance", () => {
  const seed = makeSeed();
  const c = seed.coupons[0];
  c.remaining = 0;
  assert.throws(
    () =>
      applyCommand(
        seed,
        { type: "coupon.redeem", id: c.id, requestId: crypto.randomUUID() },
        "blue",
      ),
    /用完/,
  );
  c.remaining = 1;
  c.expires = "2020-01-01";
  assert.throws(
    () =>
      applyCommand(
        seed,
        { type: "coupon.redeem", id: c.id, requestId: crypto.randomUUID() },
        "blue",
      ),
    /过期/,
  );
});
test("expiry includes the full calendar day in kingdom time zone", () => {
  const seed = makeSeed();
  seed.timeZone = "America/Toronto";
  seed.coupons[0].expires = "2026-09-20";
  assert.equal(
    applyCommand(
      seed,
      {
        type: "coupon.redeem",
        id: seed.coupons[0].id,
        requestId: crypto.randomUUID(),
      },
      "blue",
      "2026-09-21T02:00:00Z",
    ).coupons[0].remaining,
    3,
  );
});
test("profile changes affect only authenticated identity", () => {
  const seed = makeSeed();
  const next = applyCommand(
    seed,
    { type: "profile", activity: 3, mood: 4, note: "健身去了" },
    "red",
  );
  assert.deepEqual(next.profiles.blue, seed.profiles.blue);
  assert.equal(next.profiles.red.activity, 3);
});
test("dates are calendar based across DST and time zones", () => {
  assert.equal(
    daysUntil({ date: "2026-03-09", annual: false }, "2026-03-07"),
    2,
  );
  assert.equal(
    today("America/Toronto", new Date("2026-09-21T02:00:00Z")),
    "2026-09-20",
  );
  assert.equal(
    today("Asia/Shanghai", new Date("2026-09-21T02:00:00Z")),
    "2026-09-21",
  );
});
test("annual events roll over and leap anniversaries use February 28", () => {
  assert.equal(
    nextOccurrence({ date: "2024-02-29", annual: true }, "2027-01-01"),
    "2027-02-28",
  );
  assert.equal(
    nextOccurrence({ date: "2024-02-29", annual: true }, "2027-03-01"),
    "2028-02-29",
  );
  assert.equal(
    daysUntil({ date: "2020-09-21", annual: true }, "2026-09-21"),
    0,
  );
});
test("event edit conflicts do not overwrite a newer diary version", () => {
  const seed = makeSeed();
  const event = seed.events[1];
  const command = {
    type: "event.save" as const,
    event: { ...event, title: "新版" },
    expectedUpdatedAt: "stale",
  };
  assert.throws(() => applyCommand(seed, command, "red"), /刚刚修改/);
  const next = applyCommand(
    seed,
    { ...command, expectedUpdatedAt: event.updatedAt },
    "red",
  );
  assert.equal(next.events[0].title, "新版");
  assert.equal(next.events[0].author, "blue");
});
test("invalid dates, negative uses and malformed commands are rejected", () => {
  const seed = makeSeed();
  assert.equal(
    commandSchema.safeParse({
      type: "event.save",
      event: { ...seed.events[0], date: "2026-02-30" },
    }).success,
    false,
  );
  assert.equal(
    commandSchema.safeParse({
      type: "coupon.create",
      requestId: crypto.randomUUID(),
      coupon: { ...seed.coupons[0], count: -1 },
    }).success,
    false,
  );
  assert.equal(
    commandSchema.safeParse({
      type: "profile",
      activity: 99,
      mood: 0,
      note: "",
    }).success,
    false,
  );
});
test("interactions target the partner and reads cannot mark partner inbox", () => {
  let state = applyCommand(
    makeSeed(),
    { type: "interact", kind: "hug", requestId: crypto.randomUUID() },
    "blue",
  );
  assert.equal(state.interactions[0].to, "red");
  state = applyCommand(
    state,
    { type: "interactions.read", ids: [state.interactions[0].id] },
    "blue",
  );
  assert.equal(state.interactions[0].seen, false);
  state = applyCommand(
    state,
    { type: "interactions.read", ids: [state.interactions[0].id] },
    "red",
  );
  assert.equal(state.interactions[0].seen, true);
});
test("session signature rejects tampering and unknown roles", () => {
  const token = createToken("blue");
  assert.equal(verifyToken(token), "blue");
  assert.equal(verifyToken(token.replace("blue", "red")), null);
  assert.equal(verifyToken("bad.0.foo"), null);
});
test("production seed has no invented personal memories or issued coupons", () => {
  const state = makeSeed(false);
  assert.equal(state.demo, false);
  assert.equal(state.events.length, 0);
  assert.equal(state.coupons.length, 0);
});

test("only the partner can issue a card, including an existing request id", () => {
  for (const actor of ["blue", "red"] as const) {
    const seed = makeSeed(false);
    const owner = actor === "blue" ? "red" : "blue";
    const requestId = crypto.randomUUID();
    const coupon = {
      title: "心愿",
      description: "",
      owner,
      count: 1,
      minutes: 0,
      art: 4,
      color: "lavender",
      benefit: "相机",
      expires: "",
    };
    const command = commandSchema.parse({
      type: "coupon.create",
      coupon,
      requestId,
    });
    const created = applyCommand(seed, command, actor);
    assert.equal(created.coupons[0].owner, owner);
    assert.equal(created.coupons[0].useKind, "goods");
    assert.deepEqual(applyCommand(created, command, actor), created);
    assert.throws(() => applyCommand(created, command, owner), /只能送给对方/);
    const self = commandSchema.parse({
      type: "coupon.create",
      coupon: { ...coupon, owner: actor },
      requestId: crypto.randomUUID(),
    });
    assert.throws(() => applyCommand(seed, self, actor), /只能送给对方/);
    assert.equal(seed.coupons.length, 0);
  }
});
test("eating, lounging and overtime are persisted for the authenticated role without changing older activity ids", () => {
  const seed = makeSeed(false);
  const cmd = commandSchema.parse({
    type: "profile",
    activity: 6,
    mood: 0,
    note: "干饭第一名",
  });
  const result = applyCommand(seed, cmd, "red");
  assert.equal(result.profiles.red.activity, 6);
  assert.deepEqual(result.profiles.blue, seed.profiles.blue);
  const lounging = commandSchema.parse({ ...cmd, activity: 7 });
  assert.equal(applyCommand(seed, lounging, "blue").profiles.blue.activity, 7);
  for (const role of ["blue", "red"] as const) {
    const overtime = commandSchema.parse({ ...cmd, activity: 8 });
    assert.equal(applyCommand(seed, overtime, role).profiles[role].activity, 8);
  }
  assert.equal(commandSchema.safeParse({ ...cmd, activity: 9 }).success, false);
});
