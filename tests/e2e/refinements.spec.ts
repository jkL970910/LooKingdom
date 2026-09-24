import { test, expect } from "@playwright/test";

// Separate this local-only fixture from the baseline suite login-rate bucket.
test.use({ extraHTTPHeaders: { "x-real-ip": "198.51.100.22" } });

test("gifts go only to the partner and actual held cards determine every stack layer", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入小窝" }).click();
  await expect(
    page.getByRole("button", { name: "小窝", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "卡包", exact: true }).click();
  await page.getByRole("button", { name: "给你发张新卡" }).click();
  const form = page.getByRole("dialog");
  await expect(form.locator(".coupon-recipient")).toHaveText("♡ 红Loo专用");
  await expect(
    form.getByRole("button", { name: "蓝Loo专用", exact: true }),
  ).toHaveCount(0);
  await form
    .getByRole("button", { name: "Loo心愿兑现券", exact: true })
    .click();
  await expect(form.getByLabel("兑现方式")).toHaveValue("goods");
  await expect(form.locator(".card-template-grid .selected .sprite")).toHaveCSS(
    "background-image",
    /wish-cards/,
  );
  await form.getByRole("button", { name: "关闭", exact: true }).click();
  const initial = await (await page.request.get("/api/state")).json();
  const original = initial.coupons.find(
    (c: { owner: string; remaining: number }) =>
      c.owner === "blue" && c.remaining > 0,
  );
  const denied = await page.request.post("/api/state", {
    data: {
      type: "coupon.create",
      requestId: crypto.randomUUID(),
      coupon: { ...original, owner: "blue" },
    },
  });
  expect(denied.status()).toBe(403);
  const ids = initial.coupons
    .filter(
      (c: { owner: string; remaining: number; expires: string }) =>
        c.owner === "blue" && c.remaining > 0 && !c.expires,
    )
    .map((c: { id: string }) => c.id);
  await expect(page.locator(".ticket-back")).toHaveCount(2);
  await expect(page.locator(".back-one")).toHaveAttribute(
    "data-card-id",
    ids[1],
  );
  await page.getByRole("button", { name: "下一张卡", exact: true }).click();
  await expect(page.locator(".back-one")).toHaveAttribute(
    "data-card-id",
    ids[2],
  );
  const after = structuredClone(initial);
  after.coupons = [original];
  await page.route("**/api/state", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ json: after })
      : route.continue(),
  );
  await page.reload();
  await page.getByRole("button", { name: "卡包", exact: true }).click();
  await expect(page.locator(".coupon-card")).toBeVisible();
  await expect(page.locator(".ticket-back")).toHaveCount(0);
  await page.screenshot({
    path: "design/qa/wallet-single-card.png",
    animations: "disabled",
  });
});

test("every diary row is compact and eating, lounging and overtime artwork survive reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入小窝" }).click();
  await expect(
    page.getByRole("button", { name: "小窝", exact: true }),
  ).toBeVisible();
  for (const [activity, sheet] of [["干饭中", "eating"], ["躺尸中", "lounging"], ["加班中", "overtime"]]) {
    await page.getByRole("button", { name: "更新我的状态" }).click();
    await page.getByRole("button", { name: activity, exact: true }).click();
    await page.getByRole("button", { name: "更新状态", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.reload();
    const profile = page.getByRole("button", { name: "查看蓝Loo状态" });
    await expect(profile).toContainText(activity);
    await expect(profile.locator(".sprite")).toHaveCSS("background-image", new RegExp(sheet));
  }
  await page.screenshot({ path: "design/qa/overtime.png", animations: "disabled" });
  await page.getByRole("button", { name: "大事件", exact: true }).click();
  for (const name of ["我们的故事", "未来计划"]) {
    await page.getByRole("button", { name, exact: true }).click();
    const rows = page.locator(".event-list .event-card");
    expect(await rows.count()).toBeGreaterThan(0);
    await expect(page.locator(".event-list .event-cover")).toHaveCount(0);
    for (const row of await rows.all())
      await expect(row).toHaveClass(/event-small/);
    await rows.first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "关闭", exact: true }).click();
  }
  await page.screenshot({
    path: "design/qa/journal-compact.png",
    animations: "disabled",
    fullPage: true,
  });
});

test("one overview marker per journey opens all cities and the route in its detail", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入小窝" }).click();
  await expect(
    page.getByRole("button", { name: "小窝", exact: true }),
  ).toBeVisible();
  const state = await (await page.request.get("/api/state")).json();
  const place = (id: string, lat: number, lng: number) => ({
    id,
    name: id,
    lat,
    lng,
    country: "法国",
    countryCode: "FR",
  });
  const base = {
    startDate: "2025-10-11",
    endDate: "2025-10-20",
    status: "visited",
    note: "一起慢慢走",
    photoId: null,
    eventId: null,
    author: "blue",
    createdAt: "2025-10-20T12:00:00Z",
    updatedAt: "2025-10-20T12:00:00Z",
  };
  state.trips = [
    {
      ...base,
      id: "europe",
      title: "欧洲四城",
      places: [
        place("巴黎", 48.85, 2.35),
        place("里昂", 45.76, 4.83),
        place("尼斯", 43.7, 7.27),
        place("马赛", 43.3, 5.37),
      ],
    },
    {
      ...base,
      id: "second",
      title: "另一段回忆",
      places: [place("伦敦", 51.5, -0.12)],
    },
  ];
  await page.route("**/api/state", (route) => route.fulfill({ json: state }));
  await page.reload();
  await page.getByRole("button", { name: "足迹", exact: true }).click();
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(2);
  await expect(page.locator(".leaflet-overlay-pane path")).toHaveCount(0);
  await page.locator('.leaflet-marker-icon[title="欧洲四城 · 4 站"]').click();
  const detail = page.getByRole("dialog");
  await expect(detail.locator(".leaflet-marker-icon")).toHaveCount(4);
  await expect(detail.locator(".leaflet-overlay-pane path")).toHaveCount(1);
  await expect(detail.locator(".itinerary li")).toHaveCount(4);
  await expect(detail).toHaveCSS("opacity", "1");
  await page.screenshot({
    path: "design/qa/journey-route-detail.png",
    animations: "disabled",
  });
});
