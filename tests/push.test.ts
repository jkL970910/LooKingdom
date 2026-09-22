import { test, mock } from "node:test";
import assert from "node:assert/strict";
import webpush from "web-push";
import {
  validPushEndpoint,
  interactionNotice,
  saveSubscription,
  subscriptionsFor,
  sendPartnerPush,
  removeSubscription,
} from "../src/lib/push";
import { makeSeed } from "../src/lib/domain";
test("push destinations reject private hosts, spoofed suffixes and non-HTTPS URLs", () => {
  for (const url of [
    "http://fcm.googleapis.com/x",
    "https://127.0.0.1/x",
    "https://fcm.googleapis.com.evil.test/x",
    "https://web.push.apple.com@localhost/x",
    "https://web.push.apple.com:8443/x",
  ])
    assert.equal(validPushEndpoint(url), false);
  for (const url of [
    "https://fcm.googleapis.com/fcm/send/x",
    "https://web.push.apple.com/x",
    "https://updates.push.services.mozilla.com/wpush/v2/x",
    "https://wns2.notify.windows.com/x",
  ])
    assert.equal(validPushEndpoint(url), true);
});
test("notifications only describe requested interactions and changed mood/activity, never private notes", () => {
  const seed = makeSeed(false);
  const command = {
    type: "interact" as const,
    kind: "hug" as const,
    requestId: crypto.randomUUID(),
  };
  assert.match(interactionNotice(seed, command, "blue")!.body, /蓝Loo.*抱抱/);
  seed.interactions.push({
    id: command.requestId,
    kind: "hug",
    from: "blue",
    to: "red",
    seen: false,
    createdAt: new Date().toISOString(),
  });
  assert.equal(interactionNotice(seed, command, "blue"), null);
  const change = {
    type: "profile" as const,
    activity: 6,
    mood: 2,
    note: "PRIVATE NOTE",
  };
  const notice = interactionNotice(seed, change, "red")!;
  assert.match(notice.body, /干饭中.*想你/);
  assert.equal(JSON.stringify(notice).includes("PRIVATE NOTE"), false);
  assert.equal(
    interactionNotice(
      seed,
      {
        ...change,
        activity: seed.profiles.red.activity,
        mood: seed.profiles.red.mood,
      },
      "red",
    ),
    null,
  );
});
test("only partner devices receive encrypted sends and expired subscriptions are removed", async () => {
  const env = { ...process.env };
  process.env.DATABASE_URL = "";
  process.env.VERCEL = "";
  process.env.LOO_LOCAL_DEMO = "true";
  const keys = webpush.generateVAPIDKeys();
  process.env.VAPID_PUBLIC_KEY = keys.publicKey;
  process.env.VAPID_PRIVATE_KEY = keys.privateKey;
  const sub = (id: string) => ({
    endpoint: "https://fcm.googleapis.com/fcm/send/" + id,
    keys: { p256dh: "A".repeat(87), auth: "B".repeat(22) },
  });
  const own = sub("sender"),
    partner = sub("partner");
  const calls: string[] = [];
  const sender = mock.method(
    webpush,
    "sendNotification",
    async (s: { endpoint: string }) => {
      calls.push(s.endpoint);
      throw Object.assign(Error("gone"), { statusCode: 410 });
    },
  );
  try {
    await saveSubscription("blue", own);
    await saveSubscription("red", partner);
    await sendPartnerPush("blue", {
      title: "hello",
      body: "hug",
      tag: "test",
      url: "/",
    });
    assert.deepEqual(calls, [partner.endpoint]);
    assert.equal((await subscriptionsFor("red")).length, 0);
    assert.equal((await subscriptionsFor("blue")).length, 1);
    await removeSubscription("red", own.endpoint);
    assert.equal((await subscriptionsFor("blue")).length, 1);
    await removeSubscription("blue", own.endpoint);
  } finally {
    sender.mock.restore();
    for (const k of Object.keys(process.env))
      if (!(k in env)) delete process.env[k];
    Object.assign(process.env, env);
  }
});
