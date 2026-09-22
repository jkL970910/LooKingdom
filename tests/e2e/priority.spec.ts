import { test, expect } from "@playwright/test";
test.use({ extraHTTPHeaders: { "x-real-ip": "198.51.100.23" } });
test("pinned future plan stays in a large banner above compact stories; clearing the pin picks the nearest plan", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入小窝" }).click();
  await expect(
    page.getByRole("button", { name: "小窝", exact: true }),
  ).toBeVisible();
  const state = await (await page.request.get("/api/state")).json();
  const source = state.events[0];
  state.events = [
    {
      ...source,
      id: "later",
      title: "一起回国",
      theme: 3,
      date: "2090-02-01",
      annual: false,
      countdown: true,
    },
    {
      ...source,
      id: "near",
      title: "最近计划",
      date: "2090-01-01",
      annual: false,
      countdown: true,
    },
  ];
  state.pinnedEventId = "later";
  await page.route("**/api/state", (route) => route.fulfill({ json: state }));
  await page.reload();
  await expect(page.locator(".countdown-card").first()).toContainText(
    "离一起回国，又近了一点点",
  );
  await page.getByRole("button", { name: "大事件", exact: true }).click();
  await expect(page.locator(".countdown-card")).toContainText("一起回国");
  await expect(page.locator(".countdown-card")).not.toHaveClass(/compact/);
  await page.locator(".countdown-card").click();
  await expect(page.getByRole("dialog")).toContainText("一起回国");
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: "未来计划", exact: true }).click();
  await expect(page.locator(".event-card").first()).toContainText("一起回国");
  await expect(page.locator(".event-card").first()).toHaveClass(/event-small/);
  await expect(page.locator(".countdown-card")).toContainText("一起回国");
  await page.screenshot({
    path: "design/qa/journal-banner-restored.png",
    animations: "disabled",
    fullPage: true,
  });
  state.pinnedEventId = null;
  await page.reload();
  await page.getByRole("button", { name: "大事件", exact: true }).click();
  await expect(page.locator(".countdown-card")).toContainText("最近计划");
  await page.getByRole("button", { name: "卡包", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "给你发张新卡" }),
  ).toBeVisible();
});
