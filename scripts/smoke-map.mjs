import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await page.goto("http://localhost:3006");
  await page.getByRole("button", { name: "进入小窝" }).click();
  await page.getByRole("button", { name: "足迹", exact: true }).click();
  await page.locator(".map-heading").scrollIntoViewIfNeeded();
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll(".leaflet-tile")).some(
        (i) =>
          i instanceof HTMLImageElement && i.complete && i.naturalWidth > 0,
      ),
    {},
    { timeout: 20000 },
  );
  await page.screenshot({
    path: "design/qa/map-live-service.png",
    animations: "disabled",
  });
  console.log(
    JSON.stringify({
      service: "OpenStreetMap live tiles",
      loaded: await page.locator(".leaflet-tile-loaded").count(),
      attribution: await page
        .locator(".leaflet-control-attribution")
        .innerText(),
    }),
  );
} finally {
  await browser.close();
}
