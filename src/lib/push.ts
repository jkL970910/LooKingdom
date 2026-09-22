import webpush from "web-push";
import { createHash } from "node:crypto";
import { z } from "zod";
import { localMode, pool, ready } from "./storage";
import {
  activities,
  moods,
  roleName,
  otherRole,
  type Role,
  type Command,
  type KingdomState,
} from "./domain";
export function validPushEndpoint(value: string) {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      !u.hash &&
      (u.hostname === "fcm.googleapis.com" ||
        u.hostname === "updates.push.services.mozilla.com" ||
        u.hostname.endsWith(".push.apple.com") ||
        u.hostname.endsWith(".notify.windows.com"))
    );
  } catch {
    return false;
  }
}
export const subscriptionSchema = z.object({
  endpoint: z
    .string()
    .max(2048)
    .refine(validPushEndpoint, "这台设备的推送服务暂不支持"),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
  }),
});
export type Subscription = z.infer<typeof subscriptionSchema>;
export const pushConfigured = () =>
  Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
export const subscriptionId = (endpoint: string) =>
  createHash("sha256").update(endpoint).digest("hex");
const local = globalThis as typeof globalThis & {
  looPush?: Map<string, { owner: Role; subscription: Subscription }>;
};
export async function saveSubscription(
  owner: Role,
  subscription: Subscription,
) {
  const id = subscriptionId(subscription.endpoint);
  if (localMode()) {
    (local.looPush ??= new Map()).set(id, { owner, subscription });
    return;
  }
  await ready();
  await pool().query(
    "INSERT INTO loo_push_subscriptions(id, owner, subscription) VALUES($1,$2,$3::jsonb) ON CONFLICT(id) DO UPDATE SET owner=EXCLUDED.owner, subscription=EXCLUDED.subscription, updated_at=now()",
    [id, owner, JSON.stringify(subscription)],
  );
}
export async function removeSubscription(owner: Role, endpoint: string) {
  const id = subscriptionId(endpoint);
  if (localMode()) {
    if (local.looPush?.get(id)?.owner === owner) local.looPush.delete(id);
    return;
  }
  await ready();
  await pool().query(
    "DELETE FROM loo_push_subscriptions WHERE id=$1 AND owner=$2",
    [id, owner],
  );
}
export async function subscriptionsFor(owner: Role): Promise<Subscription[]> {
  if (localMode())
    return [...(local.looPush?.values() || [])]
      .filter((x) => x.owner === owner)
      .map((x) => x.subscription);
  await ready();
  return (
    await pool().query(
      "SELECT subscription FROM loo_push_subscriptions WHERE owner=$1 ORDER BY updated_at DESC LIMIT 20",
      [owner],
    )
  ).rows.map((x) => x.subscription);
}
export type Notice = { title: string; body: string; tag: string; url: string };
export function interactionNotice(
  before: KingdomState,
  command: Command,
  actor: Role,
): Notice | null {
  if (
    command.type === "interact" &&
    !before.interactions.some((i) => i.id === command.requestId)
  )
    return {
      title: "Loo国有一份小心意 ♡",
      body:
        roleName(actor) +
        {
          pat: "摸了摸你的头，辛苦啦 ♡",
          hug: "给你一个大大的抱抱 ♡",
          poke: "戳了戳你：在想你啦 ♡",
        }[command.kind],
      tag: command.requestId,
      url: "/",
    };
  if (command.type === "profile") {
    const old = before.profiles[actor];
    if (old.activity === command.activity && old.mood === command.mood)
      return null;
    return {
      title: roleName(actor) + "更新了小状态",
      body:
        activities[command.activity] +
        " · " +
        moods[command.mood] +
        "，来小窝看看吧 ♡",
      tag: "loo-status-" + actor,
      url: "/",
    };
  }
  return null;
}
export async function sendPartnerPush(actor: Role, notice: Notice) {
  if (!pushConfigured()) return;
  const owner = otherRole(actor);
  await Promise.all(
    (await subscriptionsFor(owner)).map(async (subscription) => {
      if (!validPushEndpoint(subscription.endpoint)) return;
      try {
        await webpush.sendNotification(subscription, JSON.stringify(notice), {
          vapidDetails: {
            subject: process.env.APP_ORIGIN || "https://loo-kingdom.vercel.app",
            publicKey: process.env.VAPID_PUBLIC_KEY!,
            privateKey: process.env.VAPID_PRIVATE_KEY!,
          },
          TTL: 3600,
          timeout: 8000,
        });
      } catch (error) {
        const code = (error as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410)
          await removeSubscription(owner, subscription.endpoint);
        else console.warn("Push delivery unavailable", code || "network");
      }
    }),
  );
}
