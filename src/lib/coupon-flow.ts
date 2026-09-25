import { z } from "zod";
import type { Coupon, KingdomState, Role } from "./domain";
import { DomainError } from "./errors";
export type UseKind = "timed" | "instant" | "goods";
export type UseStatus =
  | "pending"
  | "in_progress"
  | "awaiting_fulfillment"
  | "awaiting_confirmation"
  | "completed"
  | "declined"
  | "cancelled"
  | "expired";
export type ProductRecord = {
  name: string;
  parameters: string;
  price: number;
  currency: "CAD" | "CNY" | "USD" | "JPY" | "EUR";
  date: string;
  photoId: string | null;
  note: string;
  recordedBy: Role;
  recordedAt: string;
};
export type CouponUse = {
  id: string;
  couponId: string;
  title: string;
  owner: Role;
  recipient: Role;
  kind: UseKind;
  minutes: number;
  benefit: string;
  art: number;
  status: UseStatus;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  endsAt: string | null;
  completedAt: string | null;
  reason: string;
  product: ProductRecord | null;
  confirmedBy: Role | null;
};
export const useStatusLabel: Record<UseStatus, string> = {
  pending: "等待接受",
  in_progress: "正在使用",
  awaiting_fulfillment: "等待兑现",
  awaiting_confirmation: "等待确认收好",
  completed: "已使用",
  declined: "这次先不了",
  cancelled: "已取消",
  expired: "申请已过期",
};
export function useKind(
  card: Pick<Coupon, "minutes" | "art" | "useKind">,
): UseKind {
  return (
    card.useKind ||
    (card.minutes > 0 ? "timed" : card.art >= 2 ? "goods" : "instant")
  );
}
export function isActiveUse(use: CouponUse) {
  return [
    "pending",
    "in_progress",
    "awaiting_fulfillment",
    "awaiting_confirmation",
  ].includes(use.status);
}
export function activeUseFor(state: KingdomState, id: string) {
  return (state.couponUses || []).find(
    (u) => u.couponId === id && isActiveUse(u),
  );
}
const id = z.string().min(1).max(100);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const n = new Date(v + "T12:00:00Z");
    return (
      !Number.isNaN(+n) &&
      n.toISOString().slice(0, 10) === v &&
      v >= "1900-01-01" &&
      v <= "2200-12-31"
    );
  }, "请选择有效日期");
export const productInput = z.object({
  name: z.string().trim().min(1, "给这份礼物起个名字吧").max(80),
  parameters: z.string().trim().min(1, "请记录规格、品种或产品参数").max(2000),
  price: z
    .number()
    .finite()
    .min(0)
    .max(100000000)
    .refine(
      (v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.000001,
      "金额最多保留两位小数",
    ),
  currency: z.enum(["CAD", "CNY", "USD", "JPY", "EUR"]),
  date,
  photoId: z.string().uuid().nullable(),
  note: z.string().trim().max(2000),
});
export const couponFlowSchemas = [
  z.object({
    type: z.literal("coupon.request"),
    id,
    requestId: z.string().uuid(),
  }),
  z.object({ type: z.literal("coupon.accept"), id }),
  z.object({
    type: z.literal("coupon.decline"),
    id,
    reason: z.string().trim().max(200),
  }),
  z.object({
    type: z.literal("coupon.cancel"),
    id,
    reason: z.string().trim().max(200),
  }),
  z.object({
    type: z.literal("coupon.product"),
    id,
    expectedUpdatedAt: z.string(),
    product: productInput,
  }),
  z.object({
    type: z.literal("coupon.confirm-product"),
    id,
    expectedUpdatedAt: z.string(),
  }),
  z.object({
    type: z.literal("coupon.return-product"),
    id,
    expectedUpdatedAt: z.string(),
    reason: z.string().trim().max(200),
  }),
] as const;
export const couponFlowSchema = z.discriminatedUnion("type", couponFlowSchemas);
type FlowCommand = z.infer<typeof couponFlowSchema>;
function localDate(zone: string, now: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
}
function finish(state: KingdomState, use: CouponUse, at: string) {
  if (use.status === "completed") return;
  if (state.redemptions.some((r) => r.requestId === use.id))
    throw new DomainError("这份申请已经记过账，请刷新", 409);
  const card = state.coupons.find((c) => c.id === use.couponId);
  if (!card || card.remaining < 1)
    throw new DomainError("卡片权益不一致，请刷新后重试", 409);
  card.remaining--;
  use.status = "completed";
  use.completedAt = at;
  use.updatedAt = at;
  state.redemptions.unshift({
    id: use.id,
    requestId: use.id,
    couponId: card.id,
    title: use.title,
    owner: use.owner,
    minutes: use.minutes,
    benefit: use.benefit,
    createdAt: at,
    remaining: card.remaining,
  });
}
// Durable deadlines are settled under the same storage lock as all writes.
// Reopening either phone after the deadline settles once, even after a restart.
export function settleCouponUses(
  state: KingdomState,
  now = new Date().toISOString(),
): KingdomState {
  const date = localDate(state.timeZone, now);
  const due = (state.couponUses || []).some(
    (u) =>
      (u.status === "in_progress" && u.endsAt && u.endsAt <= now) ||
      (u.status === "pending" &&
        state.coupons.some(
          (c) => c.id === u.couponId && c.expires && c.expires < date,
        )),
  );
  if (!due) return state;
  const s = structuredClone(state);
  for (const u of s.couponUses || []) {
    if (u.status === "in_progress" && u.endsAt && u.endsAt <= now)
      finish(s, u, u.endsAt);
    else if (
      u.status === "pending" &&
      s.coupons.some(
        (c) => c.id === u.couponId && c.expires && c.expires < date,
      )
    ) {
      u.status = "expired";
      u.updatedAt = now;
    }
  }
  s.version++;
  return s;
}
export function applyCouponFlow(
  state: KingdomState,
  command: FlowCommand,
  actor: Role,
  now: string,
): KingdomState {
  const settled = settleCouponUses(state, now);
  const s = structuredClone(settled);
  s.couponUses ??= [];
  if (command.type === "coupon.request") {
    const canonical = s.coupons.find(c => c.id === command.id || c.issueIds?.includes(command.id));
    const cardId = canonical?.id ?? command.id;
    const previous = s.couponUses.find((u) => u.id === command.requestId);
    if (previous) {
      if (previous.owner !== actor || previous.couponId !== cardId)
        throw new DomainError("申请请求不匹配", 409);
      return settled;
    }
    if (s.redemptions.some((r) => r.requestId === command.requestId))
      throw new DomainError("这个请求编号已使用", 409);
    const card = s.coupons.find((c) => c.id === cardId);
    if (!card) throw new DomainError("这张卡不存在", 404);
    if (card.owner !== actor)
      throw new DomainError("这是对方的专属卡片哦", 403);
    if (card.remaining < 1) throw new DomainError("这张卡已经用完啦", 409);
    if (card.expires && card.expires < localDate(s.timeZone, now))
      throw new DomainError("这张卡已经过期啦", 409);
    if (activeUseFor(s, card.id))
      throw new DomainError(
        "这张卡还有一份未完成申请，先把这份偏爱收好吧",
        409,
      );
    const kind = useKind(card);
    s.couponUses.unshift({
      id: command.requestId,
      couponId: card.id,
      title: card.title,
      owner: actor,
      recipient: actor === "blue" ? "red" : "blue",
      kind,
      minutes: kind === "timed" ? card.minutes : 0,
      benefit: card.benefit,
      art: card.art,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      endsAt: null,
      completedAt: null,
      reason: "",
      product: null,
      confirmedBy: null,
    });
  } else {
    const u = s.couponUses.find((u) => u.id === command.id);
    if (!u) throw new DomainError("这份申请已经不在了", 404);
    switch (command.type) {
      case "coupon.accept": {
        if (actor !== u.recipient)
          throw new DomainError("需要另一位Loo接受申请哦", 403);
        if (
          [
            "in_progress",
            "awaiting_fulfillment",
            "awaiting_confirmation",
            "completed",
          ].includes(u.status)
        )
          return settled;
        if (u.status !== "pending")
          throw new DomainError("这份申请已经结束了", 409);
        u.startedAt = now;
        u.updatedAt = now;
        if (u.kind === "timed") {
          u.status = "in_progress";
          u.endsAt = new Date(
            Date.parse(now) + u.minutes * 60000,
          ).toISOString();
        } else if (u.kind === "goods") u.status = "awaiting_fulfillment";
        else finish(s, u, now);
        break;
      }
      case "coupon.decline":
        if (actor !== u.recipient)
          throw new DomainError("只有收到申请的Loo可以婉拒", 403);
        if (u.status === "declined") return settled;
        if (u.status !== "pending")
          throw new DomainError("这份申请已被处理", 409);
        u.status = "declined";
        u.reason = command.reason;
        u.updatedAt = now;
        break;
      case "coupon.cancel":
        if (u.status === "cancelled") return settled;
        if (!isActiveUse(u))
          throw new DomainError("这份申请已结束，不能再取消", 409);
        if (u.status === "pending" && actor !== u.owner)
          throw new DomainError("收到申请的一方可以选择婉拒", 403);
        u.status = "cancelled";
        u.reason = command.reason;
        u.updatedAt = now;
        break;
      case "coupon.product":
        if (
          u.kind !== "goods" ||
          !["awaiting_fulfillment", "awaiting_confirmation"].includes(u.status)
        )
          throw new DomainError("这份申请现在不能填写兑现记录", 409);
        if (u.updatedAt !== command.expectedUpdatedAt)
          throw new DomainError("对方刚更新了记录，请重新打开后填写", 409);
        if (command.product.date > localDate(s.timeZone, now))
          throw new DomainError("实际购买日期不能在未来");
        u.product = { ...command.product, recordedBy: actor, recordedAt: now };
        u.status = "awaiting_confirmation";
        u.updatedAt = now;
        u.reason = "";
        break;
      case "coupon.confirm-product":
        if (!u.product || actor === u.product.recordedBy)
          throw new DomainError("需要另一位Loo核对后确认收好", 403);
        if (u.status === "completed") return settled;
        if (
          u.status !== "awaiting_confirmation" ||
          u.updatedAt !== command.expectedUpdatedAt
        )
          throw new DomainError("兑现记录有更新，请重新核对后确认", 409);
        u.confirmedBy = actor;
        finish(s, u, now);
        break;
      case "coupon.return-product":
        if (!u.product || actor === u.product.recordedBy)
          throw new DomainError("需要另一位Loo核对这份记录", 403);
        if (
          u.status !== "awaiting_confirmation" ||
          u.updatedAt !== command.expectedUpdatedAt
        )
          throw new DomainError("记录已更新，请刷新", 409);
        u.status = "awaiting_fulfillment";
        u.reason = command.reason;
        u.updatedAt = now;
        break;
    }
  }
  s.version++;
  return s;
}
