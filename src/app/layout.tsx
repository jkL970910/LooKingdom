import type { Metadata, Viewport } from "next";
import "@fontsource/zcool-kuaile";
import "@fontsource-variable/noto-sans-sc";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import "./lifestyle.css";
import "./coupon-flow.css";
export const metadata: Metadata = {
  title: "Loo国生活 · 两个人的小小王国",
  description: "记录小日常，收藏大偏爱。属于蓝Loo和红Loo的温馨小窝。",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Loo国生活" },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fff8ed",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
