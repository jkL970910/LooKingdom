import { z } from "zod";
import { DomainError } from "./errors";
import {
  couponFlowSchemas,
  couponFlowSchema,
  applyCouponFlow,
  settleCouponUses,
  useKind,
  type CouponUse,
  type UseKind,
} from "./coupon-flow";
export { DomainError } from "./errors";
import {
  emptyLifestyle,
  normalizeState,
  lifestyleCommandSchemas,
  lifestyleCommandSchema,
  applyLifestyle,
  syncEventToTrip,
  placeInput,
  type LifestyleState,
} from "./lifestyle";

export const roles = ["blue", "red"] as const;
export type Role = (typeof roles)[number];
export const roleName = (role: Role) => (role === "blue" ? "蓝Loo" : "红Loo");
export const otherRole = (role: Role): Role =>
  role === "blue" ? "red" : "blue";
export const activities = [
  "工作中",
  "休闲中",
  "做饭中",
  "健身中",
  "追剧中",
  "昏迷中",
  "干饭中",
  "躺尸中",
  "加班中",
  "摸鱼中",
] as const;
export const moods = [
  "开心",
  "烦躁",
  "想你",
  "低电量",
  "忙碌",
  "期待",
] as const;
export const moodEmoji = ["☺️", "😤", "💗", "🪫", "💦", "🤩"];
export const themes = [
  "纪念日",
  "生日",
  "旅行",
  "回国",
  "日常",
  "自定义",
] as const;
export const themeEmoji = ["💗", "🎂", "🧳", "🏡", "🍳", "📖"];
export const cardTemplates = [
  {
    title: "揉头卡",
    description: "今天的脑袋，也需要被宠爱",
    minutes: 15,
    count: 3,
    art: 0,
    benefit: "每次 15 分钟",
    color: "blue",
  },
  {
    title: "免喷券",
    description: "暂停吐槽，今天只许说我可爱",
    minutes: 0,
    count: 1,
    art: 1,
    benefit: "免喷一次",
    color: "lavender",
  },
  {
    title: "Loo猫领养券",
    description: "给我们的小窝，添一位毛茸茸国民",
    minutes: 0,
    count: 1,
    art: 2,
    benefit: "领养一只猫咪的约定",
    color: "coral",
  },
  {
    title: "Loo金兑换券",
    description: "一颗小金豆，存下满满的偏爱",
    minutes: 0,
    count: 1,
    art: 3,
    benefit: "1g 小金豆",
    color: "gold",
  },
  {
    title: "Loo心愿兑现券",
    description: "你的小心愿，我来认真兑现",
    minutes: 0,
    count: 1,
    art: 4,
    benefit: "一份约好的心愿礼物",
    color: "lavender",
  },
] as const;
export type Profile = {
  activity: number;
  mood: number;
  note: string;
  updatedAt: string;
};
export type DiaryEvent = {
  id: string;
  theme: number;
  title: string;
  date: string;
  mood: number;
  note: string;
  photoId: string | null;
  countdown: boolean;
  annual: boolean;
  author: Role;
  createdAt: string;
  updatedAt: string;
};
export type Coupon = {
  useKind?: UseKind;
  id: string;
  title: string;
  description: string;
  owner: Role;
  count: number;
  remaining: number;
  minutes: number;
  benefit: string;
  art: number;
  color: string;
  expires: string;
  createdAt: string;
};
export type Redemption = {
  id: string;
  requestId: string;
  couponId: string;
  title: string;
  owner: Role;
  minutes: number;
  benefit: string;
  createdAt: string;
  remaining: number;
};
export type Interaction = {
  id: string;
  from: Role;
  to: Role;
  kind: "pat" | "hug" | "poke";
  createdAt: string;
  seen: boolean;
};
export type KingdomState = LifestyleState & {
  serverNow?: string;
  couponUses: CouponUse[];
  version: number;
  demo: boolean;
  timeZone: string;
  profiles: Record<Role, Profile>;
  events: DiaryEvent[];
  coupons: Coupon[];
  redemptions: Redemption[];
  interactions: Interaction[];
  pinnedEventId: string | null;
};

export function today(timeZone = "America/Toronto", now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function shiftDate(date: string, days: number) {
  return new Date(Date.parse(date + "T12:00:00Z") + days * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function nextOccurrence(
  event: Pick<DiaryEvent, "date" | "annual">,
  current: string,
) {
  if (!event.annual) return event.date;
  const monthDay = event.date.slice(5);
  let year = Number(current.slice(0, 4));
  const dateInYear = (y: number) =>
    monthDay === "02-29" && new Date(Date.UTC(y, 1, 29)).getUTCMonth() !== 1
      ? `${y}-02-28`
      : `${y}-${monthDay}`;
  if (dateInYear(year) < current) year++;
  return dateInYear(year);
}
export function daysUntil(
  event: Pick<DiaryEvent, "date" | "annual">,
  current: string,
) {
  return Math.round(
    (Date.parse(nextOccurrence(event, current) + "T12:00:00Z") -
      Date.parse(current + "T12:00:00Z")) /
      86400000,
  );
}
export function makeSeed(
  demo = true,
  timeZone = "America/Toronto",
): KingdomState {
  const date = today(timeZone);
  const now = new Date().toISOString();
  const events: DiaryEvent[] = demo
    ? [
        {
          id: "demo-homecoming",
          theme: 3,
          title: "回国倒计时",
          date: shiftDate(date, 18),
          mood: 5,
          note: "终于又能一起吃饭啦！",
          photoId: null,
          countdown: true,
          annual: false,
          author: "red",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "demo-cooking",
          theme: 4,
          title: "今天也是大厨Loo",
          date,
          mood: 0,
          note: "两个人把厨房变成了快乐现场。\n你负责掌勺，我负责夸夸。",
          photoId: null,
          countdown: false,
          annual: false,
          author: "blue",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "demo-travel",
          theme: 2,
          title: "第一次一起旅行",
          date: shiftDate(date, -35),
          mood: 0,
          note: "和你，看更远的世界。",
          photoId: null,
          countdown: false,
          annual: false,
          author: "red",
          createdAt: now,
          updatedAt: now,
        },
      ]
    : [];
  return {
    ...emptyLifestyle(),
    version: 1,
    demo,
    timeZone,
    profiles: {
      blue: {
        activity: demo ? 0 : 1,
        mood: demo ? 1 : 0,
        note: demo ? "今天被工作拿捏了，求摸头。" : "",
        updatedAt: now,
      },
      red: {
        activity: demo ? 4 : 1,
        mood: 0,
        note: demo ? "快乐追剧中，给你留了爆米花！" : "",
        updatedAt: now,
      },
    },
    events,
    coupons: demo
      ? roles.flatMap((owner) =>
          cardTemplates.map((template, i) => ({
            ...template,
            id: `demo-${owner}-${i}`,
            owner,
            remaining: template.count,
            expires: "",
            createdAt: now,
          })),
        )
      : [],
    redemptions: [],
    couponUses: [],
    interactions: [],
    pinnedEventId: demo ? "demo-homecoming" : null,
  };
}

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(value + "T12:00:00Z");
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value &&
      value >= "1900-01-01" &&
      value <= "2200-12-31"
    );
  }, "请选择有效日期");
const id = z.string().min(1).max(100);
export const eventInput = z.object({
  travelPlaces: z.array(placeInput).max(30).optional(),
  id: id.optional(),
  theme: z.number().int().min(0).max(5),
  title: z.string().trim().min(1, "给大事件起个名字吧").max(60),
  date: dateString,
  mood: z.number().int().min(0).max(5),
  note: z.string().trim().max(2000),
  photoId: z.string().uuid().nullable(),
  countdown: z.boolean(),
  annual: z.boolean(),
});
export const couponInput = z.object({
  useKind: z.enum(["timed", "instant", "goods"]).optional(),
  title: z.string().trim().min(1).max(40),
  description: z.string().trim().max(120),
  owner: z.enum(roles),
  count: z.number().int().min(1).max(999),
  minutes: z.number().int().min(0).max(1440),
  benefit: z.string().trim().max(120),
  art: z
    .number()
    .int()
    .min(0)
    .max(cardTemplates.length - 1),
  color: z.enum(["blue", "coral", "lavender", "gold"]),
  expires: z.union([z.literal(""), dateString]),
});
export const commandSchema = z.discriminatedUnion("type", [
  ...couponFlowSchemas,
  ...lifestyleCommandSchemas,
  z.object({
    type: z.literal("profile"),
    activity: z
      .number()
      .int()
      .min(0)
      .max(activities.length - 1),
    mood: z.number().int().min(0).max(5),
    note: z.string().trim().max(120),
  }),
  z.object({
    type: z.literal("event.save"),
    event: eventInput,
    expectedUpdatedAt: z.string().optional(),
  }),
  z.object({ type: z.literal("event.delete"), id }),
  z.object({ type: z.literal("event.pin"), id: id.nullable() }),
  z.object({
    type: z.literal("coupon.create"),
    coupon: couponInput,
    requestId: z.string().uuid(),
  }),
  z.object({
    type: z.literal("coupon.redeem"),
    id,
    requestId: z.string().uuid(),
  }),
  z.object({
    type: z.literal("interact"),
    kind: z.enum(["pat", "hug", "poke"]),
    requestId: z.string().uuid(),
  }),
  z.object({ type: z.literal("interactions.read"), ids: z.array(id).max(200) }),
  z.object({ type: z.literal("demo.clear") }),
]);
export type Command = z.infer<typeof commandSchema>;

// Runs inside the storage transaction. Never trust an owner/remaining value from the browser.
export function applyCommand(
  state: KingdomState,
  command: Command,
  actor: Role,
  now = new Date().toISOString(),
  newId = () => crypto.randomUUID(),
): KingdomState {
  state = settleCouponUses(normalizeState(state), now);
  const flow = couponFlowSchema.safeParse(command);
  if (flow.success) return applyCouponFlow(state, flow.data, actor, now);
  const lifestyle = lifestyleCommandSchema.safeParse(command);
  if (lifestyle.success)
    return applyLifestyle(state, lifestyle.data, actor, now);
  const s = structuredClone(normalizeState(state));
  switch (command.type) {
    case "profile":
      s.profiles[actor] = {
        activity: command.activity,
        mood: command.mood,
        note: command.note,
        updatedAt: now,
      };
      break;
    case "event.save": {
      const existing = command.event.id
        ? s.events.find((e) => e.id === command.event.id)
        : undefined;
      if (command.event.id && !existing)
        throw new DomainError("这条记录已被删除，请刷新后重试", 409);
      if (existing && command.expectedUpdatedAt !== existing.updatedAt)
        throw new DomainError("对方刚刚修改了这条记录，请重新打开后编辑", 409);
      const { travelPlaces, ...eventFields } = command.event;
      const event: DiaryEvent = {
        ...eventFields,
        id: existing?.id ?? newId(),
        author: existing?.author ?? actor,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      s.events = [event, ...s.events.filter((e) => e.id !== event.id)];
      syncEventToTrip(s, event, now);
      if (event.theme === 2 && travelPlaces)
        s.trips.find((t) => t.eventId === event.id)!.places = travelPlaces;
      if (!event.countdown && s.pinnedEventId === event.id)
        s.pinnedEventId = null;
      break;
    }
    case "event.delete":
      s.trips.forEach((trip) => {
        if (trip.eventId === command.id) trip.eventId = null;
      });
      s.events = s.events.filter((e) => e.id !== command.id);
      if (s.pinnedEventId === command.id) s.pinnedEventId = null;
      break;
    case "event.pin": {
      if (
        command.id &&
        !s.events.some((e) => e.id === command.id && e.countdown)
      )
        throw new DomainError("只能置顶倒计时事件");
      s.pinnedEventId = command.id;
      break;
    }
    case "coupon.create": {
      if (command.coupon.owner === actor)
        throw new DomainError("小特权只能送给对方，不能给自己发卡哦", 403);
      if (s.coupons.some((c) => c.id === command.requestId)) return state;
      const kind = useKind(command.coupon);
      if (kind === "timed" && command.coupon.minutes < 1)
        throw new DomainError("计时卡每次至少 1 分钟");
      if (kind !== "timed" && command.coupon.minutes !== 0)
        throw new DomainError("非计时卡的分钟数应为 0");
      if (
        command.coupon.expires &&
        command.coupon.expires < today(s.timeZone, new Date(now))
      )
        throw new DomainError("有效期不能早于今天");
      s.coupons.push({
        ...command.coupon,
        useKind: kind,
        id: command.requestId,
        remaining: command.coupon.count,
        createdAt: now,
      });
      break;
    }
    case "coupon.redeem":
      return applyCouponFlow(
        state,
        {
          type: "coupon.request",
          id: command.id,
          requestId: command.requestId,
        },
        actor,
        now,
      );
    case "interact": {
      if (s.interactions.some((i) => i.id === command.requestId)) return state;
      const latest = s.interactions.find((i) => i.from === actor);
      if (latest && Date.parse(now) - Date.parse(latest.createdAt) < 1000)
        throw new DomainError("心意正在路上，等一下下再发吧", 429);
      s.interactions.unshift({
        id: command.requestId,
        from: actor,
        to: otherRole(actor),
        kind: command.kind,
        createdAt: now,
        seen: false,
      });
      s.interactions = s.interactions.slice(0, 200);
      break;
    }
    case "interactions.read":
      s.interactions.forEach((i) => {
        if (i.to === actor && command.ids.includes(i.id)) i.seen = true;
      });
      break;
    case "demo.clear": {
      if (!s.demo) throw new DomainError("当前已经是你们自己的小窝");
      const clean = makeSeed(false, s.timeZone);
      clean.version = s.version + 1;
      return clean;
    }
  }
  s.version++;
  return s;
}
