import { test, expect } from "@playwright/test";
import webpush from "web-push";
test.use({ extraHTTPHeaders: { "x-real-ip": "198.51.100.24" } });
test("device push is opt-in and can be disabled without notifying anyone", async ({
  page,
}) => {
  const publicKey = webpush.generateVAPIDKeys().publicKey;
  await page.addInitScript(() => {
    let subscription: unknown = null;
    const payload = {
      endpoint: "https://fcm.googleapis.com/fcm/send/browser-fixture",
      keys: { p256dh: "A".repeat(87), auth: "B".repeat(22) },
    };
    const reg = {
      pushManager: {
        getSubscription: async () => subscription,
        subscribe: async () => {
          subscription = {
            ...payload,
            toJSON: () => payload,
            unsubscribe: async () => {
              subscription = null;
              return true;
            },
          };
          return subscription;
        },
      },
    };
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistration: async () => reg,
        register: async () => reg,
        ready: Promise.resolve(reg),
      },
    });
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: function () {},
    });
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: {
        permission: "default",
        requestPermission: async () => "granted",
      },
    });
  });
  const requests: string[] = [];
  await page.route("**/api/push", (route) => {
    const method = route.request().method();
    if (method !== "GET") requests.push(method);
    return route.fulfill({
      json:
        method === "GET"
          ? { configured: true, publicKey, devices: [] }
          : { ok: true },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "进入小窝" }).click();
  await expect(
    page.getByRole("button", { name: "小窝", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "小窝设置" }).click();
  await expect(
    page.getByRole("button", { name: "开启手机小心意" }),
  ).toBeEnabled();
  expect(requests).toEqual([]);
  await page.getByRole("button", { name: "开启手机小心意" }).click();
  await expect(
    page.getByRole("button", { name: "关闭这台设备的提醒" }),
  ).toBeVisible();
  expect(requests).toEqual(["POST"]);
  await page.getByRole("button", { name: "关闭这台设备的提醒" }).click();
  await expect(
    page.getByRole("button", { name: "开启手机小心意" }),
  ).toBeVisible();
  expect(requests).toEqual(["POST", "DELETE"]);
});
