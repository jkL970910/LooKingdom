// Explicit opt-in live-service smoke check. Reads external metadata only;
// does not create recipes, trips, events or photos in the user's home.
const base = process.env.LOO_SMOKE_ORIGIN || "http://localhost:3006";
const session = await fetch(`${base}/api/session`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: base },
  body: JSON.stringify({ role: "blue", code: "" }),
});
if (!session.ok)
  throw new Error("Live smoke check requires the local development login.");
const cookie = session.headers
  .getSetCookie()
  .map((v) => v.split(";")[0])
  .join("; ");
async function post(path, data) {
  const response = await fetch(base + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: base,
      Cookie: cookie,
    },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(45000),
  });
  return { http: response.status, data: await response.json() };
}
const places = await post("/api/places/search", { query: "Toronto" });
console.log(
  JSON.stringify({
    service: "Nominatim via app API",
    http: places.http,
    places: places.data.places?.length,
    first: places.data.places?.[0]?.name,
    error: places.data.error,
  }),
);
const recipe = await post("/api/recipes/import", {
  text: "https://www.xiaohongshu.com/",
});
console.log(
  JSON.stringify({
    service: "Xiaohongshu public page via app API",
    http: recipe.http,
    status: recipe.data.status,
    title: recipe.data.title,
    notice: recipe.data.notice,
    error: recipe.data.error,
  }),
);
