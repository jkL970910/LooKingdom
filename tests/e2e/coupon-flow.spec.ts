import { test, expect } from "@playwright/test";
import path from "node:path";
test("two phones request, accept a timed card and cancel without charging", async ({
  browser,
}) => {
  const blue = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    red = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const b = await blue.newPage(),
      r = await red.newPage();
    await b.goto("/");
    await b.getByRole("button", { name: "进入小窝" }).click();
    await r.goto("/");
    await r.getByRole("button", { name: "我是红Loo", exact: false }).click();
    await r.getByRole("button", { name: "进入小窝" }).click();
    const state = await (await b.request.get("/api/state")).json();
    const pending = state.couponUses.find(
      (u: { couponId: string; status: string }) =>
        u.couponId === "demo-blue-0" && u.status === "pending",
    );
    if (!pending) {
      await b.request.post("/api/state", {
        data: {
          type: "coupon.request",
          id: "demo-blue-0",
          requestId: crypto.randomUUID(),
        },
      });
    }
    await b.reload();
    await r.reload();
    await expect(r.locator(".coupon-activity")).toContainText(
      "蓝Loo申请使用揉头卡",
    );
    await r.locator(".use-activity-row").filter({ hasText: "揉头卡" }).click();
    await r.getByRole("button", { name: "接受申请，开始计时" }).click();
    await expect(r.getByLabel("剩余使用时间")).toContainText(/1[45]:/);
    await b.reload();
    await b.locator(".use-activity-row").filter({ hasText: "揉头卡" }).click();
    await expect(b.getByRole("dialog")).toContainText("正在使用");
    await b.screenshot({
      path: "design/qa/coupon-timer-mobile.png",
      animations: "disabled",
    });
    await b.getByRole("button", { name: "取消这次使用", exact: true }).click();
    await b.getByRole("button", { name: "确认取消", exact: true }).click();
    await expect(b.getByRole("dialog")).toContainText("本次没有扣除");
    const after = await (await b.request.get("/api/state")).json();
    expect(
      after.coupons.find((c: { id: string }) => c.id === "demo-blue-0")
        .remaining,
    ).toBe(3);
  } finally {
    await blue.close();
    await red.close();
  }
});
test("goods parameters, photo and price are saved then confirmed by the other phone", async ({
  browser,
}) => {
  const blue = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    red = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const b = await blue.newPage(),
      r = await red.newPage();
    await b.goto("/");
    await b.getByRole("button", { name: "进入小窝" }).click();
    await r.goto("/");
    await r.getByRole("button", { name: "我是红Loo", exact: false }).click();
    await r.getByRole("button", { name: "进入小窝" }).click();
    const id = crypto.randomUUID();
    expect(
      (
        await b.request.post("/api/state", {
          data: { type: "coupon.request", id: "demo-blue-3", requestId: id },
        })
      ).ok(),
    ).toBeTruthy();
    await r.reload();
    await r
      .locator(".use-activity-row")
      .filter({ hasText: "Loo金兑换券" })
      .click();
    await r.getByRole("button", { name: "接受使用申请", exact: true }).click();
    await r.getByRole("button", { name: "填写兑现记录" }).click();
    await r.getByLabel("产品 / 猫咪名称").fill("我们的第一颗小金豆");
    await r
      .getByLabel("产品参数", { exact: true })
      .fill("品牌 Loo / 1g / 足金999");
    await r.getByLabel("实际金额").fill("899.50");
    await r.getByLabel("币种", { exact: true }).selectOption("CNY");
    await r
      .getByLabel("上传照片")
      .setInputFiles(path.resolve("public/art/home.webp"));
    await expect(r.getByRole("img", { name: "待保存的照片" })).toBeVisible();
    await r.getByRole("button", { name: "保存记录，请对方确认" }).click();
    await expect(r.getByRole("dialog")).toContainText("等待确认收好");
    await expect(
      r.getByRole("button", { name: "确认收好，完成使用" }),
    ).toHaveCount(0);
    await b.reload();
    await b
      .locator(".use-activity-row")
      .filter({ hasText: "Loo金兑换券" })
      .click();
    await expect(b.getByRole("dialog")).toContainText("CNY 899.50");
    await b.getByRole("button", { name: "确认收好，完成使用" }).click();
    await expect(b.getByRole("dialog")).toContainText("已扣除 1 次");
    await expect(
      b.getByRole("img", { name: "我们的第一颗小金豆" }),
    ).toBeVisible();
    await b.screenshot({
      path: "design/qa/coupon-product-mobile.png",
      animations: "disabled",
    });
    const after = await (await b.request.get("/api/state")).json();
    expect(
      after.coupons.find((c: { id: string }) => c.id === "demo-blue-3")
        .remaining,
    ).toBe(0);
    expect(
      after.redemptions.filter(
        (v: { requestId: string }) => v.requestId === id,
      ),
    ).toHaveLength(1);
  } finally {
    await blue.close();
    await red.close();
  }
});
test("Toronto default, Beijing and device time zones persist independently of shared dates", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入小窝" }).click();
  await expect(page.locator(".home-clock")).toContainText("多伦多");
  await page.getByRole("button", { name: "小窝设置" }).click();
  await page
    .locator(".zone-options")
    .getByRole("button", { name: /北京/ })
    .click();
  await expect(
    page.locator(".zone-options").getByRole("button", { name: /北京/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(page.locator(".home-clock")).toContainText("北京");
  await page.reload();
  await expect(page.locator(".home-clock")).toContainText("北京");
  const s = await (await page.request.get("/api/state")).json();
  expect(s.timeZone).toBe("America/Toronto");
  await page.getByRole("button", { name: "小窝设置" }).click();
  await page
    .locator(".zone-options")
    .getByRole("button", { name: /手机本地/ })
    .click();
  await page.screenshot({
    path: "design/qa/time-zones-mobile.png",
    animations: "disabled",
  });
});
