import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyCommand,
  commandSchema,
  makeSeed,
  type Command,
} from "../src/lib/domain";
import { normalizeState, travelStats, type Trip } from "../src/lib/lifestyle";
import {
  fetchRecipeDraft,
  parseRecipeContent,
  extractRecipeLink,
} from "../src/lib/recipe-import";
const now = "2026-09-21T15:00:00Z";
const recipe = (id: string, title = id) => ({
  id,
  title,
  cuisine: 0,
  sourceUrl: "",
  note: "",
  ingredients: "",
  steps: "",
  favorite: true,
  photoId: null,
});
const place = (id: string, lat: number, lng: number, countryCode: string) => ({
  id,
  name: id,
  lat,
  lng,
  countryCode,
  country: countryCode,
});
const trip = (id: string, status: "planned" | "visited" = "visited") => ({
  id,
  title: id,
  status,
  startDate: "2026-08-01",
  endDate: "2026-08-03",
  note: "一起看海",
  places: [
    place("Toronto", 43.65, -79.38, "CA"),
    place("Montreal", 45.5, -73.57, "CA"),
  ],
  photoId: null,
  eventId: null,
});
const run = (s: ReturnType<typeof makeSeed>, c: Command, time = now) =>
  applyCommand(s, commandSchema.parse(c), "blue", time);
test("waitlist reorder, atomic cooking, idempotent retry and historical snapshots", () => {
  let s = makeSeed(false);
  s = run(s, {
    type: "recipe.save",
    recipe: recipe("a", "番茄牛腩"),
    addToWaitlist: true,
  });
  s = run(s, {
    type: "recipe.save",
    recipe: recipe("b", "意面"),
    addToWaitlist: true,
  });
  s = run(s, { type: "meal.move", id: "wish-b", direction: "up" });
  assert.equal(s.mealWaitlist[0].recipeId, "b");
  const cook = {
    type: "meal.cook" as const,
    wishId: "wish-b",
    requestId: crypto.randomUUID(),
    date: "2026-09-20",
    note: "光盘",
    rating: 5,
    photoId: null,
  };
  s = run(s, cook);
  assert.equal(s.mealWaitlist.length, 1);
  assert.equal(s.mealHistory[0].title, "意面");
  assert.deepEqual(run(s, cook), s);
  s = run(s, { type: "recipe.delete", id: "b" });
  assert.equal(s.mealHistory[0].title, "意面");
  assert.throws(
    () => run(s, { ...cook, requestId: crypto.randomUUID() }),
    /做过或移走/,
  );
});
test("favorites update conflicts and duplicate enqueue is harmless", () => {
  let s = run(makeSeed(false), {
    type: "recipe.save",
    recipe: recipe("a"),
    addToWaitlist: true,
  });
  s = run(s, {
    type: "meal.enqueue",
    recipeId: "a",
    requestId: crypto.randomUUID(),
  });
  assert.equal(s.mealWaitlist.length, 1);
  s = run(
    s,
    { type: "recipe.favorite", id: "a", value: false },
    "2026-09-21T15:01:00Z",
  );
  assert.throws(
    () =>
      run(s, {
        type: "recipe.save",
        recipe: recipe("a"),
        addToWaitlist: false,
        expectedUpdatedAt: now,
      }),
    /刚刚修改/,
  );
});
test("cooked meals and completed trips reject future dates", () => {
  let s = run(makeSeed(false), {
    type: "recipe.save",
    recipe: recipe("a"),
    addToWaitlist: true,
  });
  assert.throws(
    () =>
      run(s, {
        type: "meal.cook",
        wishId: "wish-a",
        requestId: crypto.randomUUID(),
        date: "2027-01-01",
        note: "",
        rating: 5,
        photoId: null,
      }),
    /还没到/,
  );
  assert.throws(
    () =>
      run(s, {
        type: "trip.save",
        trip: { ...trip("a"), endDate: "2027-01-01" },
      }),
    /未来/,
  );
  s = run(s, {
    type: "trip.save",
    trip: { ...trip("a", "planned"), endDate: "2027-01-01" },
  });
  assert.throws(() => run(s, { type: "trip.complete", id: "a" }), /还没结束/);
});
test("travel and journal sync both ways, retain route duration and unlink on deletion", () => {
  let s = run(makeSeed(false), {
    type: "trip.save",
    trip: trip("a", "planned"),
  });
  const e = s.events[0];
  assert.equal(e.theme, 2);
  assert.equal(e.countdown, true);
  s = run(
    s,
    {
      type: "event.save",
      event: { ...e, title: "新旅程", date: "2026-08-05" },
      expectedUpdatedAt: e.updatedAt,
    },
    "2026-09-21T15:01:00Z",
  );
  assert.equal(s.trips[0].title, "新旅程");
  assert.equal(s.trips[0].endDate, "2026-08-07");
  assert.equal(s.trips[0].places.length, 2);
  s = run(s, { type: "trip.complete", id: "a" });
  assert.equal(s.events[0].countdown, false);
  assert.equal(s.trips[0].status, "visited");
  s = run(s, { type: "event.delete", id: e.id });
  assert.equal(s.trips[0].eventId, null);
  assert.equal(s.trips.length, 1);
});
test("new travel events create linked plans including map coordinates", () => {
  let s = makeSeed(false);
  s = run(s, {
    type: "event.save",
    event: {
      title: "明年去日本",
      theme: 2,
      date: "2027-01-01",
      mood: 0,
      note: "京都",
      countdown: true,
      annual: false,
      photoId: null,
      travelPlaces: [place("京都", 35, 135, "JP")],
    },
  });
  assert.equal(s.trips.length, 1);
  assert.equal(s.trips[0].places[0].name, "京都");
  assert.equal(s.trips[0].status, "planned");
  assert.equal(travelStats(s.trips).places, 0);
});
test("legacy migration preserves memories and establishes missing links without invented locations", () => {
  const old = makeSeed(true);
  const legacy = structuredClone(old);
  delete (legacy as Partial<typeof legacy>).schemaVersion;
  delete (legacy as Partial<typeof legacy>).trips;
  const s = normalizeState(legacy);
  assert.deepEqual(s.events, old.events);
  assert.equal(s.trips.length, old.events.filter((e) => e.theme === 2).length);
  assert.ok(s.trips.every((t) => !t.places.length));
  assert.deepEqual(normalizeState(s), s);
});
test("recap deduplicates places/countries, filters years and never bridges separate trips", () => {
  const rows = [
    { ...trip("a"), author: "blue", createdAt: now, updatedAt: now },
    {
      ...trip("b"),
      places: [place("Toronto again", 43.65, -79.38, "CA")],
      author: "blue",
      createdAt: now,
      updatedAt: now,
    },
    {
      ...trip("c", "planned"),
      places: [place("Tokyo", 35, 139, "JP")],
      author: "blue",
      createdAt: now,
      updatedAt: now,
    },
  ] as Trip[];
  const stats = travelStats(rows);
  assert.equal(stats.places, 2);
  assert.equal(stats.countries, 1);
  assert.ok(stats.km > 500 && stats.km < 510);
  assert.equal(stats.trips, 2);
  assert.equal(travelStats(rows, "2025").km, 0);
});
test("invalid locations, dates and unsafe recipe links are rejected", () => {
  assert.equal(
    commandSchema.safeParse({
      type: "trip.save",
      trip: { ...trip("a"), startDate: "2026-02-30" },
    }).success,
    false,
  );
  assert.equal(
    commandSchema.safeParse({
      type: "trip.save",
      trip: { ...trip("a"), places: [place("bad", 90, 200, "CA")] },
    }).success,
    false,
  );
  assert.equal(
    commandSchema.safeParse({
      type: "recipe.save",
      recipe: { ...recipe("a"), sourceUrl: "https://localhost/private" },
      addToWaitlist: false,
    }).success,
    false,
  );
  assert.equal(
    extractRecipeLink("好吃 http://xhslink.com/o/abc 复制打开"),
    "https://xhslink.com/o/abc",
  );
});
test("public recipe metadata and JSON-LD produce editable actual ingredients and steps", () => {
  const draft = parseRecipeContent(
    '<script type="application/ld+json">' +
      JSON.stringify({
        "@type": "Recipe",
        name: "麻婆豆腐",
        description: "川菜",
        recipeIngredient: ["豆腐 1 块"],
        recipeInstructions: [{ text: "炒香豆瓣酱" }, "放入豆腐"],
      }) +
      "</script>",
    "",
    "https://www.xiaohongshu.com/explore/abc",
  );
  assert.equal(draft.title, "麻婆豆腐");
  assert.equal(draft.cuisine, 1);
  assert.equal(draft.ingredients, "豆腐 1 块");
  assert.equal(draft.steps, "炒香豆瓣酱\n放入豆腐");
});
test("login restrictions retain source and allow pasted dish classification without fabricated instructions", async () => {
  const fetcher = (async () =>
    new Response("Forbidden", { status: 403 })) as typeof fetch;
  const draft = await fetchRecipeDraft("https://xhslink.com/o/a", fetcher);
  assert.equal(draft.status, "needs-input");
  assert.equal(draft.title, "");
  const pasted = await fetchRecipeDraft(
    "奶油蘑菇意面 http://xhslink.com/o/a",
    fetcher,
  );
  assert.equal(pasted.title, "奶油蘑菇意面");
  assert.equal(pasted.cuisine, 3);
  assert.equal(pasted.steps, "");
});
test("short-link redirects only follow approved HTTPS hosts", async () => {
  const calls: string[] = [];
  const fetcher = (async (input: Parameters<typeof fetch>[0]) => {
    calls.push(String(input));
    return new Response("", {
      status: 302,
      headers: { location: "http://127.0.0.1/private" },
    });
  }) as typeof fetch;
  const draft = await fetchRecipeDraft("https://xhslink.com/o/a", fetcher);
  assert.equal(calls.length, 1);
  assert.equal(draft.status, "needs-input");
});

test("platform home page is not misclassified as a dish", () => {
  const draft = parseRecipeContent(
    '<title>小红书 - 你的生活兴趣社区</title><meta name="description" content="小红书是你的生活兴趣社区">',
    "https://www.xiaohongshu.com/",
    "https://www.xiaohongshu.com/",
  );
  assert.equal(draft.status, "needs-input");
  assert.equal(draft.title, "");
  assert.equal(draft.note, "");
});
