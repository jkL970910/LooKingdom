import { test, expect } from "@playwright/test";
test("recipe import review, queue ordering, cooking and saved history work on mobile", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "进入小窝" }).click();
  await page.getByRole("button", { name: "菜谱", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Loo国菜谱" })).toBeVisible();
  await page.route("**/api/recipes/import", (route) =>
    route.fulfill({
      json: {
        sourceUrl: "https://www.xiaohongshu.com/explore/test",
        title: "番茄牛腩",
        cuisine: 0,
        note: "少一点盐",
        ingredients: "牛腩 500g",
        steps: "炖煮",
        status: "recognized",
        notice: "已根据公开内容或分享文案初步识别，菜名和菜系都可以改。",
      },
    }),
  );
  await page.getByRole("button", { name: /收一道新菜/ }).click();
  await page
    .getByLabel("小红书分享内容")
    .fill("番茄牛腩 https://www.xiaohongshu.com/explore/test");
  await page.getByRole("button", { name: "识别这道美味" }).click();
  await expect(page.getByLabel("菜名", { exact: true })).toHaveValue(
    "番茄牛腩",
  );
  await page.getByLabel("菜名", { exact: true }).fill("双Loo番茄牛腩");
  await page.getByRole("button", { name: "收进Loo国菜谱" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: /收一道新菜/ }).click();
  await page.getByLabel("菜名", { exact: true }).fill("双Loo奶油意面");
  await page.getByLabel("菜系", { exact: true }).selectOption("3");
  await page.getByRole("button", { name: "收进Loo国菜谱" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "上移双Loo奶油意面", exact: true })
    .click();
  await expect(page.locator(".meal-card").first()).toContainText(
    "双Loo奶油意面",
  );
  await page.screenshot({
    path: "design/qa/recipes-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .locator(".meal-card")
    .first()
    .getByRole("button", { name: "这道做过啦" })
    .click();
  await page.getByLabel("这顿的小回忆").fill("光盘行动，大厨满分");
  await page.getByRole("button", { name: "做过啦，存下这顿美味" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("tab", { name: /开饭回忆/ }).click();
  await expect(
    page.locator(".history-card").filter({ hasText: "双Loo奶油意面" }),
  ).toContainText("光盘行动");
  await page.getByRole("tab", { name: /收藏菜谱/ }).click();
  await expect(
    page.locator(".saved-recipe").filter({ hasText: "双Loo奶油意面" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "菜谱", exact: true }).click();
  await page.getByRole("tab", { name: /开饭回忆/ }).click();
  await expect(
    page.locator(".history-card").filter({ hasText: "双Loo奶油意面" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("travel map locations, recap and future journal links work bidirectionally", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "进入小窝" }).click();
  await page.route("**/api/places/search", (route) =>
    route.fulfill({
      json: {
        places: [
          {
            id: "osm-test-kyoto",
            name: "京都",
            displayName: "京都,日本",
            lat: 35.0116,
            lng: 135.7681,
            countryCode: "JP",
            country: "日本",
          },
        ],
      },
    }),
  );
  await page.getByRole("button", { name: "足迹", exact: true }).click();
  await page.getByRole("button", { name: "收藏一段旅程" }).click();
  await page.getByLabel("旅程名字").fill("双Loo京都回忆");
  await page.getByLabel("这段旅行", { exact: true }).selectOption("visited");
  await page.getByLabel("出发日").fill("2026-01-01");
  await page.getByLabel("返程日").fill("2026-01-03");
  await page.getByLabel("搜索旅行地点").fill("京都");
  await page.getByRole("button", { name: "搜索", exact: true }).click();
  await page.locator(".place-results button").first().click();
  await page.getByLabel("行程安排 / 旅行小故事").fill("一起散步吃团子");
  await page.getByRole("button", { name: "把旅程放进我们的小世界" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".travel-stats")).toContainText("1个到访国家");
  await expect(page.locator(".selected-trip")).toContainText("双Loo京都回忆");
  await expect(page.locator(".leaflet-marker-icon").first()).toBeVisible();
  await page.screenshot({
    path: "design/qa/trips-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "大事件", exact: true }).click();
  await page.getByRole("button", { name: "记一件大事", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: /旅行/ }).click();
  await page.getByLabel("事件名称").fill("双Loo未来海边计划");
  await page.getByLabel("事件日期").fill("2027-07-01");
  await page.getByLabel("搜索旅行地点").fill("京都");
  await page.getByRole("button", { name: "搜索", exact: true }).click();
  await page.locator(".place-results button").first().click();
  await page.getByRole("button", { name: "存进我们的故事" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "未来计划", exact: true }).click();
  await page
    .getByRole("button")
    .filter({
      has: page.getByRole("heading", {
        name: "双Loo未来海边计划",
        exact: true,
      }),
    })
    .click();
  await page.getByRole("button", { name: "在足迹地图中查看旅行计划" }).click();
  await expect(page.getByRole("tab", { name: "下一站计划" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator(".selected-trip")).toContainText(
    "双Loo未来海边计划",
  );
  await page.locator(".selected-trip").click();
  await expect(page.getByRole("dialog")).toContainText("京都");
  await page.getByRole("button", { name: "编辑行程和地点" }).click();
  await page.getByLabel("旅程名字").fill("双Loo未来京都计划");
  await page.getByRole("button", { name: "把旅程放进我们的小世界" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "大事件", exact: true }).click();
  await page.getByRole("button", { name: "未来计划", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "双Loo未来京都计划", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("all five navigation destinations fit a 320px phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  await page.getByRole("button", { name: "进入小窝" }).click();
  for (const name of ["小窝", "大事件", "菜谱", "足迹", "卡包"]) {
    await page.getByRole("button", { name, exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      name,
    ).toBeTruthy();
  }
  await page.getByRole("button", { name: "菜谱", exact: true }).click();
  await page.getByRole("button", { name: /收一道新菜/ }).click();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBeTruthy();
});

test("manual coordinates and completed plans become map history", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入小窝" }).click();
  await page.getByRole("button", { name: "足迹", exact: true }).click();
  await page.getByRole("button", { name: "收藏一段旅程" }).click();
  await page.getByLabel("旅程名字").fill("手动标注的多伦多散步");
  await page.getByLabel("出发日").fill("2026-01-01");
  await page.getByLabel("返程日").fill("2026-01-02");
  await page.getByRole("button", { name: /也可以在地图选点/ }).click();
  await page.getByLabel("地点名称", { exact: true }).fill("多伦多湖边");
  await page.getByLabel("纬度", { exact: true }).fill("43.65");
  await page.getByLabel("经度", { exact: true }).fill("-79.38");
  await page.getByLabel("国家代码（可选）").fill("CA");
  await page.getByRole("button", { name: "添加这个地点" }).click();
  await expect(page.locator(".stop-list")).toContainText("多伦多湖边");
  await page.getByRole("button", { name: "把旅程放进我们的小世界" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.locator(".selected-trip").click();
  await page.getByRole("button", { name: "旅行完成，收进共同足迹" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "一起去过" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator(".selected-trip")).toContainText(
    "手动标注的多伦多散步",
  );
  await expect(page.locator(".travel-stats > div").last().locator('b')).toHaveText(/^[1-9]\d*$/);
});
