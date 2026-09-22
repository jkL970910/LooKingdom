"use client";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { api } from "./kingdom";
import { useKingdom } from "./context";
type Config = { configured: boolean; publicKey: string; devices: string[] };
function supported() {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}
export async function disableDevicePush() {
  if (!supported()) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await api("/api/push", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  await subscription.unsubscribe();
}
export function PushSettings() {
  const { role } = useKingdom();
  const [config, setConfig] = useState<Config | null>(null),
    [available, setAvailable] = useState(false),
    [enabled, setEnabled] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    let live = true;
    setAvailable(supported());
    void (async () => {
      try {
        const c = await api<Config>("/api/push");
        if (!live) return;
        setConfig(c);
        if (!supported()) return;
        const r = await navigator.serviceWorker.getRegistration("/");
        const sub = await r?.pushManager.getSubscription();
        if (sub) {
          const hash = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(sub.endpoint),
          );
          const id = Array.from(new Uint8Array(hash))
            .map((v) => v.toString(16).padStart(2, "0"))
            .join("");
          if (live)
            setEnabled(
              c.devices.includes(id) && Notification.permission === "granted",
            );
        }
      } catch {
        if (live) setMessage("提醒设置暂时没连上，重新打开试试吧。");
      }
    })();
    return () => {
      live = false;
    };
  }, [role]);
  async function enable() {
    setBusy(true);
    setMessage("");
    let fresh: PushSubscription | null = null;
    try {
      if (!config?.configured) throw Error("手机提醒还在准备中");
      const permission = await Notification.requestPermission();
      if (permission !== "granted")
        throw Error(
          permission === "denied"
            ? "通知权限已关闭，请到浏览器或手机设置中允许通知后重试。"
            : "这次没有开启，下次想收到小心意再来吧。",
        );
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(Error("通知服务启动超时，请重试")), 10000),
        ),
      ]);
      let sub = await registration.pushManager.getSubscription();
      if (!sub) {
        const text = config.publicKey.replace(/-/g, "+").replace(/_/g, "/");
        const bytes = Uint8Array.from(
          atob(text + "=".repeat((4 - (text.length % 4)) % 4)),
          (c) => c.charCodeAt(0),
        );
        sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: bytes,
        });
        fresh = sub;
      }
      await api("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setEnabled(true);
      setMessage("开启啦！对方的互动和小状态会来敲敲你的手机 ♡");
    } catch (e) {
      if (fresh) await fresh.unsubscribe().catch(() => {});
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="settings-note push-settings" aria-label="手机通知设置">
      <b>
        <Bell size={16} /> 让小心意来敲门
      </b>
      <p>
        对方的摸摸头、抱抱、戳一戳和状态心情更新，会变成手机提醒。仅这台设备生效。
      </p>
      <small>
        iPhone / iPad（iOS 16.4+）：先用 Safari 分享 →
        添加到主屏幕，再从主屏幕打开小窝并开启通知。手机静音、专注模式或网络可能影响提醒。
      </small>
      {!available ? (
        <p>
          当前浏览器暂不支持手机推送。iPhone 请先从主屏幕打开；Android
          可使用支持推送的 Chrome。
        </p>
      ) : (
        <button
          className="button secondary"
          disabled={busy || !config || (!enabled && !config.configured)}
          onClick={
            enabled
              ? async () => {
                  setBusy(true);
                  try {
                    await disableDevicePush();
                    setEnabled(false);
                    setMessage("这台设备的提醒已关闭。");
                  } catch (e) {
                    setMessage((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }
              : enable
          }
        >
          {busy
            ? "正在设置…"
            : enabled
              ? "关闭这台设备的提醒"
              : config && !config.configured
                ? "手机提醒准备中"
                : "开启手机小心意"}
        </button>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
