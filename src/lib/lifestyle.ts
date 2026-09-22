import { z } from "zod";
import type { DiaryEvent, KingdomState, Role } from "./domain";
import { DomainError } from "./errors";

export const cuisines = [
  "中式家常",
  "川湘风味",
  "日韩料理",
  "西式料理",
  "甜品烘焙",
  "其他美味",
] as const;
export const cuisineEmoji = ["🍳", "🌶️", "🍣", "🍝", "🍰", "🥘"];
export type Recipe = {
  id: string;
  title: string;
  cuisine: number;
  sourceUrl: string;
  note: string;
  ingredients: string;
  steps: string;
  favorite: boolean;
  photoId: string | null;
  author: Role;
  createdAt: string;
  updatedAt: string;
};
export type MealWish = {
  id: string;
  recipeId: string;
  author: Role;
  createdAt: string;
};
export type CookedMeal = {
  id: string;
  recipeId: string;
  title: string;
  cuisine: number;
  date: string;
  note: string;
  rating: number;
  photoId: string | null;
  author: Role;
  createdAt: string;
};
export type Place = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  countryCode: string;
  country: string;
};
export type Trip = {
  id: string;
  title: string;
  status: "planned" | "visited";
  startDate: string;
  endDate: string;
  note: string;
  places: Place[];
  photoId: string | null;
  eventId: string | null;
  author: Role;
  createdAt: string;
  updatedAt: string;
};
export type LifestyleState = {
  recipes: Recipe[];
  mealWaitlist: MealWish[];
  mealHistory: CookedMeal[];
  trips: Trip[];
  schemaVersion: number;
};
const ident = z.string().min(1).max(100);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v + "T12:00:00Z")) &&
      new Date(v + "T12:00:00Z").toISOString().slice(0, 10) === v &&
      v >= "1900-01-01" &&
      v <= "2200-12-31",
    "请选择有效日期",
  );
export function isRecipeUrl(value: string) {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      [
        "xiaohongshu.com",
        "www.xiaohongshu.com",
        "xhslink.com",
        "www.xhslink.com",
      ].includes(u.hostname)
    );
  } catch {
    return false;
  }
}
export const recipeInput = z.object({
  id: ident,
  title: z.string().trim().min(1).max(80),
  cuisine: z.number().int().min(0).max(5),
  sourceUrl: z
    .string()
    .max(2048)
    .refine((v) => !v || isRecipeUrl(v), "请使用有效的小红书 HTTPS 链接"),
  note: z.string().trim().max(2000),
  ingredients: z.string().trim().max(4000),
  steps: z.string().trim().max(6000),
  favorite: z.boolean(),
  photoId: z.string().uuid().nullable(),
});
export const placeInput = z.object({
  id: ident,
  name: z.string().trim().min(1).max(120),
  lat: z.number().finite().min(-85).max(85),
  lng: z.number().finite().min(-180).max(180),
  countryCode: z.string().regex(/^[A-Z]{2}$|^$/),
  country: z.string().trim().max(80),
});
export const tripInput = z
  .object({
    id: ident,
    title: z.string().trim().min(1).max(60),
    status: z.enum(["planned", "visited"]),
    startDate: date,
    endDate: date,
    note: z.string().trim().max(2000),
    places: z.array(placeInput).max(30),
    photoId: z.string().uuid().nullable(),
    eventId: ident.nullable(),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "返程日不能早于出发日",
    path: ["endDate"],
  });
export const lifestyleCommandSchemas = [
  z.object({
    type: z.literal("recipe.save"),
    recipe: recipeInput,
    expectedUpdatedAt: z.string().optional(),
    addToWaitlist: z.boolean(),
  }),
  z.object({
    type: z.literal("recipe.favorite"),
    id: ident,
    value: z.boolean(),
  }),
  z.object({ type: z.literal("recipe.delete"), id: ident }),
  z.object({
    type: z.literal("meal.enqueue"),
    recipeId: ident,
    requestId: z.string().uuid(),
  }),
  z.object({ type: z.literal("meal.remove"), id: ident }),
  z.object({
    type: z.literal("meal.move"),
    id: ident,
    direction: z.enum(["up", "down"]),
  }),
  z.object({
    type: z.literal("meal.cook"),
    wishId: ident,
    requestId: z.string().uuid(),
    date,
    note: z.string().trim().max(2000),
    rating: z.number().int().min(1).max(5),
    photoId: z.string().uuid().nullable(),
  }),
  z.object({
    type: z.literal("trip.save"),
    trip: tripInput,
    expectedUpdatedAt: z.string().optional(),
  }),
  z.object({ type: z.literal("trip.complete"), id: ident }),
  z.object({ type: z.literal("trip.delete"), id: ident }),
  z.object({ type: z.literal("trip.from-event"), eventId: ident }),
] as const;
export const lifestyleCommandSchema = z.discriminatedUnion(
  "type",
  lifestyleCommandSchemas,
);
export type LifestyleCommand = z.infer<typeof lifestyleCommandSchema>;
export function emptyLifestyle(): LifestyleState {
  return {
    schemaVersion: 2,
    recipes: [],
    mealWaitlist: [],
    mealHistory: [],
    trips: [],
  };
}
export function normalizeState(state: KingdomState): KingdomState {
  const normalized = {
    ...emptyLifestyle(),
    ...state,
    couponUses: state.couponUses || [],
  };
  // Existing memories remain untouched. Only establish links, never invent coordinates.
  if (!state.schemaVersion || state.schemaVersion < 2) {
    normalized.trips = [...(state.trips || [])];
    for (const event of state.events)
      if (
        event.theme === 2 &&
        !normalized.trips.some((t) => t.eventId === event.id)
      )
        normalized.trips.push(tripFromEvent(event, dateInZone(state.timeZone)));
  }
  normalized.schemaVersion = 2;
  return normalized;
}
function dateInZone(zone: string, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function tripFromEvent(event: DiaryEvent, current: string): Trip {
  return {
    id: `trip-${event.id}`,
    title: event.title,
    status: event.date > current ? "planned" : "visited",
    startDate: event.date,
    endDate: event.date,
    note: event.note,
    places: [],
    photoId: event.photoId,
    eventId: event.id,
    author: event.author,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
}
export function syncEventToTrip(
  state: KingdomState,
  event: DiaryEvent,
  now: string,
) {
  const trip = state.trips.find((t) => t.eventId === event.id);
  if (event.theme !== 2) {
    if (trip) trip.eventId = null;
    return;
  }
  if (trip) {
    const duration = Math.max(
      0,
      Math.round(
        (Date.parse(trip.endDate) - Date.parse(trip.startDate)) / 86400000,
      ),
    );
    const endDate = new Date(
      Date.parse(event.date + "T12:00:00Z") + duration * 86400000,
    )
      .toISOString()
      .slice(0, 10);
    if (endDate > "2200-12-31")
      throw new DomainError("调整后的返程日超出可记录范围，请先缩短旅行日期");
    const status =
      trip.status === "visited" &&
      endDate > dateInZone(state.timeZone, new Date(now))
        ? "planned"
        : trip.status;
    Object.assign(trip, {
      title: event.title,
      startDate: event.date,
      endDate,
      note: event.note,
      photoId: event.photoId,
      status,
      updatedAt: now,
    });
  } else
    state.trips.push(
      tripFromEvent(event, dateInZone(state.timeZone, new Date(now))),
    );
}
function syncTripToEvent(state: KingdomState, trip: Trip, now: string) {
  const previous = state.events.find((e) => e.id === trip.eventId);
  const event: DiaryEvent = {
    id: previous?.id || `event-${trip.id}`,
    theme: 2,
    title: trip.title,
    date: trip.startDate,
    mood: previous?.mood ?? (trip.status === "planned" ? 5 : 0),
    note: trip.note,
    photoId: trip.photoId,
    countdown: trip.status === "planned",
    annual: false,
    author: previous?.author ?? trip.author,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
  trip.eventId = event.id;
  state.events = [event, ...state.events.filter((e) => e.id !== event.id)];
  if (!event.countdown && state.pinnedEventId === event.id)
    state.pinnedEventId = null;
}
export function applyLifestyle(
  state: KingdomState,
  command: LifestyleCommand,
  actor: Role,
  now: string,
): KingdomState {
  const s = structuredClone(normalizeState(state));
  const current = dateInZone(s.timeZone, new Date(now));
  const getRecipe = (id: string) => {
    const r = s.recipes.find((r) => r.id === id);
    if (!r) throw new DomainError("这道菜已经不在菜谱里啦", 404);
    return r;
  };
  const enqueue = (recipeId: string, id: string) => {
    getRecipe(recipeId);
    if (!s.mealWaitlist.some((w) => w.recipeId === recipeId))
      s.mealWaitlist.push({ id, recipeId, author: actor, createdAt: now });
  };
  const getTrip = (id: string) => {
    const t = s.trips.find((t) => t.id === id);
    if (!t) throw new DomainError("这段旅行记录不存在", 404);
    return t;
  };
  switch (command.type) {
    case "recipe.save": {
      const previous = s.recipes.find((r) => r.id === command.recipe.id);
      if (previous && previous.updatedAt !== command.expectedUpdatedAt)
        throw new DomainError("对方刚刚修改了菜谱，请重新打开后编辑", 409);
      const recipe = {
        ...command.recipe,
        author: previous?.author ?? actor,
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
      };
      s.recipes = [recipe, ...s.recipes.filter((r) => r.id !== recipe.id)];
      if (command.addToWaitlist) enqueue(recipe.id, `wish-${recipe.id}`);
      break;
    }
    case "recipe.favorite": {
      const recipe = getRecipe(command.id);
      recipe.favorite = command.value;
      recipe.updatedAt = now;
      break;
    }
    case "recipe.delete":
      s.recipes = s.recipes.filter((r) => r.id !== command.id);
      s.mealWaitlist = s.mealWaitlist.filter((w) => w.recipeId !== command.id);
      break;
    case "meal.enqueue":
      enqueue(command.recipeId, command.requestId);
      break;
    case "meal.remove":
      s.mealWaitlist = s.mealWaitlist.filter((w) => w.id !== command.id);
      break;
    case "meal.move": {
      const i = s.mealWaitlist.findIndex((w) => w.id === command.id);
      if (i < 0) throw new DomainError("这道菜已经从想吃清单移走了", 409);
      const j = i + (command.direction === "up" ? -1 : 1);
      if (j >= 0 && j < s.mealWaitlist.length)
        [s.mealWaitlist[i], s.mealWaitlist[j]] = [
          s.mealWaitlist[j],
          s.mealWaitlist[i],
        ];
      break;
    }
    case "meal.cook": {
      if (s.mealHistory.some((m) => m.id === command.requestId)) return state;
      if (command.date > current)
        throw new DomainError("还没到那天呢，做过的菜要记在今天或过去");
      const wish = s.mealWaitlist.find((w) => w.id === command.wishId);
      if (!wish)
        throw new DomainError("这道菜已经做过或移走啦，请刷新清单", 409);
      const recipe = getRecipe(wish.recipeId);
      s.mealHistory.unshift({
        id: command.requestId,
        recipeId: recipe.id,
        title: recipe.title,
        cuisine: recipe.cuisine,
        date: command.date,
        note: command.note,
        rating: command.rating,
        photoId: command.photoId,
        author: actor,
        createdAt: now,
      });
      s.mealWaitlist = s.mealWaitlist.filter((w) => w.id !== wish.id);
      break;
    }
    case "trip.save": {
      const previous = s.trips.find((t) => t.id === command.trip.id);
      if (previous && previous.updatedAt !== command.expectedUpdatedAt)
        throw new DomainError("对方刚刚更新了行程，请重新打开后编辑", 409);
      if (command.trip.status === "visited" && command.trip.endDate > current)
        throw new DomainError("未来的行程先放进旅行计划吧");
      if (
        command.trip.eventId &&
        s.trips.some(
          (t) => t.eventId === command.trip.eventId && t.id !== command.trip.id,
        )
      )
        throw new DomainError("这件大事件已经关联另一段旅行", 409);
      if (
        command.trip.eventId &&
        !s.events.some((e) => e.id === command.trip.eventId && e.theme === 2)
      )
        throw new DomainError(
          "关联的旅行大事件已删除或改变主题，请重新打开",
          409,
        );
      const trip: Trip = {
        ...command.trip,
        author: previous?.author ?? actor,
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
      };
      s.trips = [trip, ...s.trips.filter((t) => t.id !== trip.id)];
      syncTripToEvent(s, trip, now);
      break;
    }
    case "trip.complete": {
      const trip = getTrip(command.id);
      if (trip.endDate > current)
        throw new DomainError("旅行还没结束呢，可以先调整行程日期");
      trip.status = "visited";
      trip.updatedAt = now;
      syncTripToEvent(s, trip, now);
      break;
    }
    case "trip.delete":
      s.trips = s.trips.filter((t) => t.id !== command.id);
      break;
    case "trip.from-event": {
      const event = s.events.find((e) => e.id === command.eventId);
      if (!event || event.theme !== 2)
        throw new DomainError("这不是一条旅行记录", 404);
      if (!s.trips.some((t) => t.eventId === event.id))
        s.trips.push(tripFromEvent(event, current));
      break;
    }
  }
  s.version++;
  return s;
}
export function haversineKm(
  a: Pick<Place, "lat" | "lng">,
  b: Pick<Place, "lat" | "lng">,
) {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r,
    dLng = (b.lng - a.lng) * r;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
export function travelStats(trips: Trip[], year: string = "all") {
  const visited = trips.filter(
    (t) =>
      t.status === "visited" &&
      (year === "all" || t.startDate.startsWith(year)),
  );
  const places = new Set<string>(),
    countries = new Set<string>();
  let km = 0;
  for (const trip of visited) {
    for (const p of trip.places) {
      places.add(`${p.lat.toFixed(4)},${p.lng.toFixed(4)}`);
      if (p.countryCode) countries.add(p.countryCode);
    }
    for (let i = 1; i < trip.places.length; i++)
      km += haversineKm(trip.places[i - 1], trip.places[i]);
  }
  return {
    trips: visited.length,
    places: places.size,
    countries: countries.size,
    km: Math.round(km),
    unlocated: visited.filter((t) => t.places.length === 0).length,
  };
}
