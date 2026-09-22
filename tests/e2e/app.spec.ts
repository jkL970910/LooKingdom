import { test, expect } from "@playwright/test";
import path from "node:path";
test("mobile home, status and all three pages match the design without overflow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "进入小窝" }).click();
  await expect(
    page.getByRole("button", { name: "更新我的状态" }),
  ).toBeVisible();
  await page.screenshot({
    path: "design/qa/home-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "更新我的状态" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "健身中", exact: true }).click();
  await page.getByRole("button", { name: /忙碌/ }).click();
  await page.getByLabel("给对方留句话").fill("今天努力健身，晚上一起吃饭！");
  await page.screenshot({
    path: "design/qa/status-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "更新状态", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "查看蓝Loo状态" }),
  ).toContainText("健身中");
  await expect(page.getByRole("status")).toHaveCount(0);
  await page.screenshot({
    path: "design/qa/home-updated-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "大事件", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Loo国大事件" }),
  ).toBeVisible();
  await page.screenshot({
    path: "design/qa/journal-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "卡包", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "揉头卡", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "design/qa/wallet-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});
test("photo diary saves, persists and can be edited", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入小窝" }).click();
  await page.getByRole("button", { name: "大事件", exact: true }).click();
  await page.getByRole("button", { name: "记一件大事", exact: true }).click();
  await page.getByLabel("事件名称").fill("照片日记验证");
  await page.getByLabel("想记住的话").fill("两个人的厨房也有小小的幸福。");
  await page
    .getByLabel("上传照片")
    .setInputFiles(path.resolve("public/art/home.webp"));
  await expect(
    page.getByRole("img", { name: "待保存的日记照片" }),
  ).toBeVisible();
  await page.screenshot({
    path: "design/qa/event-form-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "存进我们的故事" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button")
    .filter({
      has: page.getByRole("heading", { name: "照片日记验证", exact: true }),
    })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "两个人的厨房也有小小的幸福。",
  );
  await page.getByRole("button", { name: "编辑记录" }).click();
  await page.getByLabel("事件名称").fill("照片日记已编辑");
  await page.getByRole("button", { name: "存进我们的故事" }).click();
  await page.reload();
  await page.getByRole("button", { name: "大事件", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "照片日记已编辑" }),
  ).toBeVisible();
});
test("request waits for partner without deducting and custom card can be created", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入小窝" }).click();
  await page.getByRole("button", { name: "卡包", exact: true }).click();
  await page
    .getByRole("button", { name: "使用一次 · 15 分钟", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("45 分钟");
  await expect(page.getByRole("dialog")).toContainText("对方接受");
  await page.screenshot({
    path: "design/qa/redeem-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "发送使用申请" }).click();
  await expect(page.getByRole("dialog")).toContainText("等待接受");
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(
    page.getByRole("article", { name: "揉头卡，剩余3次" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "兑换记录", exact: true }).click();
  await expect(page.locator(".use-history-list")).toContainText("等待接受");
  await page.getByRole("button", { name: "给你发张新卡" }).click();
  await page.getByLabel("卡片名称").fill("一起散步券");
  await page.getByLabel("总次数").fill("4");
  await page.getByLabel("每次分钟数").fill("20");
  await page.getByRole("button", { name: "把偏爱放进卡包" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "红Loo专用", exact: true }).click();
  await page.getByRole("button", { name: "可使用", exact: true }).click();
  const cardTab = page.getByRole("button", { name: /一起散步券/ }).first();
  await cardTab.click();
  await expect(page.getByRole("heading", { name: "一起散步券" })).toBeVisible();
  await expect(page.getByText("共 80 分钟")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "等红Loo来使用" }),
  ).toBeDisabled();
});
test("two identities synchronize and coupon spending is atomic and idempotent", async ({
  playwright,
}) => {
  const blue = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3007",
  });
  const red = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3007",
  });
  const anon = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3007",
  });
  expect((await anon.get("/api/state")).status()).toBe(401);
  await blue.post("/api/session", { data: { role: "blue" } });
  await red.post("/api/session", { data: { role: "red" } });
  await red.post("/api/state", {
    data: { type: "profile", activity: 2, mood: 4, note: "双端测试" },
  });
  expect((await (await blue.get("/api/state")).json()).profiles.red.note).toBe(
    "双端测试",
  );
  const id = crypto.randomUUID();
  await red.post("/api/state", {
    data: {
      type: "coupon.create",
      requestId: id,
      coupon: {
        title: "并发验证券",
        description: "",
        owner: "blue",
        count: 1,
        minutes: 0,
        benefit: "15分钟",
        art: 1,
        color: "blue",
        expires: "",
      },
    },
  });
  expect(
    (
      await red.post("/api/state", {
        data: { type: "coupon.redeem", id, requestId: crypto.randomUUID() },
      })
    ).status(),
  ).toBe(403);
  const requestId = crypto.randomUUID();
  const results = await Promise.all([
    blue.post("/api/state", { data: { type: "coupon.redeem", id, requestId } }),
    blue.post("/api/state", { data: { type: "coupon.redeem", id, requestId } }),
  ]);
  expect(results.map((r) => r.status())).toEqual([200, 200]);
  const accepted = await Promise.all([
    red.post("/api/state", { data: { type: "coupon.accept", id: requestId } }),
    red.post("/api/state", { data: { type: "coupon.accept", id: requestId } }),
  ]);
  expect(accepted.map((r) => r.status())).toEqual([200, 200]);
  const state = await (await blue.get("/api/state")).json();
  expect(state.coupons.find((c: { id: string }) => c.id === id).remaining).toBe(
    0,
  );
  expect(
    state.redemptions.filter((r: { couponId: string }) => r.couponId === id),
  ).toHaveLength(1);
  const secondId = crypto.randomUUID();
  await red.post("/api/state", {
    data: {
      type: "coupon.create",
      requestId: secondId,
      coupon: {
        title: "独立并发券",
        description: "",
        owner: "blue",
        count: 1,
        minutes: 0,
        benefit: "一次",
        art: 1,
        color: "blue",
        expires: "",
      },
    },
  });
  const distinct = await Promise.all([
    blue.post("/api/state", {
      data: {
        type: "coupon.redeem",
        id: secondId,
        requestId: crypto.randomUUID(),
      },
    }),
    blue.post("/api/state", {
      data: {
        type: "coupon.redeem",
        id: secondId,
        requestId: crypto.randomUUID(),
      },
    }),
  ]);
  expect(distinct.map((r) => r.status()).sort()).toEqual([200, 409]);
  const photoId = state.events.find(
    (e: { photoId: string | null }) => e.photoId,
  )?.photoId;
  if (photoId)
    expect((await anon.get(`/api/photos/${photoId}`)).status()).toBe(401);
  expect(
    (
      await blue.post("/api/state", {
        data: { type: "profile", activity: 1, mood: 0, note: "bad" },
        headers: { origin: "https://other.example" },
      })
    ).status(),
  ).toBe(403);
  await blue.dispose();
  await red.dispose();
  await anon.dispose();
});
test("future diary can be pinned and is visible as a home countdown", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入小窝" }).click();
  await page.getByRole("button", { name: "大事件", exact: true }).click();
  await page.getByRole("button", { name: "记一件大事", exact: true }).click();
  await page.getByLabel("事件名称").fill("一起去看海");
  await page.getByLabel("事件日期").fill("2027-10-08");
  await page.getByLabel("想记住的话").fill("期待海风和你。");
  await page.getByRole("button", { name: "存进我们的故事" }).click();
  await page.getByRole("button", { name: "未来计划" }).click();
  await page
    .getByRole("button")
    .filter({ has: page.getByRole("heading", { name: "一起去看海" }) })
    .click();
  await page.getByRole("button", { name: "放到小窝首页" }).click();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: "小窝", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /一起去看海.*天/ }),
  ).toBeVisible();
});
test("two browser sessions receive partner interactions and offline edits are retained", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入小窝" }).click();
  const other = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const red = await other.newPage();
  await red.goto("http://127.0.0.1:3007");
  await red.getByRole("button", { name: "我是红Loo" }).click();
  await red.getByRole("button", { name: "进入小窝" }).click();
  await page.getByRole("button", { name: "抱一下", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "红Loo收到了抱抱" }),
  ).toBeVisible();
  await page.screenshot({
    path: "design/qa/hug-feedback-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await expect(red.getByRole("status")).toContainText(
    "蓝Loo给了你一个大大的抱抱",
    { timeout: 15000 },
  );
  await expect(red.getByRole("img", { name: "红Loo收到了抱抱" })).toBeVisible();
  await red
    .getByRole("button", { name: /收到的小心意/ })
    .first()
    .click();
  await expect(red.getByRole("dialog")).toContainText("蓝Loo给了你一个抱抱");
  await red.getByRole("button", { name: /收下.*份心意/ }).click();
  await expect(red.getByRole("button", { name: /收下.*份心意/ })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "更新我的状态" }).click();
  await page.getByLabel("给对方留句话").fill("断网时的留言还在这里");
  await page.context().setOffline(true);
  await page.getByRole("button", { name: "更新状态", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "还没有连上网络",
  );
  await expect(page.getByLabel("给对方留句话")).toHaveValue(
    "断网时的留言还在这里",
  );
  await page.context().setOffline(false);
  await other.close();
});
test("narrow mobile and desktop stay usable", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  await page.getByRole("button", { name: "进入小窝" }).click();
  for (const name of ["小窝", "大事件", "卡包"]) {
    await page.getByRole("button", { name, exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
  }
  await page.screenshot({
    path: "design/qa/wallet-320.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "小窝", exact: true }).click();
  await page.screenshot({
    path: "design/qa/home-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
});
