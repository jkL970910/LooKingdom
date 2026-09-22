"use client";
import { useEffect, useState } from "react";
import { Clock3, Check } from "lucide-react";
import {
  resolveTimeZone,
  timeZoneNames,
  type TimeZonePreference,
} from "@/lib/time-zone";
import { useKingdom } from "./context";
export function useTimeZone() {
  const [choice, setChoice] = useState<TimeZonePreference>("toronto"),
    [local, setLocal] = useState("America/Toronto");
  useEffect(() => {
    setLocal(Intl.DateTimeFormat().resolvedOptions().timeZone);
    try {
      const saved = localStorage.getItem("loo-display-time-zone");
      if (saved && ["toronto", "beijing", "local"].includes(saved))
        setChoice(saved as TimeZonePreference);
    } catch {}
  }, []);
  return {
    timeZonePreference: choice,
    displayTimeZone: resolveTimeZone(choice, local),
    localTimeZone: local,
    setTimeZonePreference: (v: TimeZonePreference) => {
      setChoice(v);
      try {
        localStorage.setItem("loo-display-time-zone", v);
      } catch {}
    },
  };
}
export function useClock(interval = 1000) {
  const { serverOffset } = useKingdom();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(timer);
  }, [interval]);
  return new Date(now + serverOffset);
}
export function TimeZoneSettings() {
  const { timeZonePreference, setTimeZonePreference, localTimeZone } =
    useKingdom();
  const now = useClock(1000);
  return (
    <section className="zone-settings">
      <h3>隔着时差，也惦记你</h3>
      <div className="zone-options">
        {(["toronto", "beijing", "local"] as const).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={timeZonePreference === key}
            onClick={() => setTimeZonePreference(key)}
          >
            <span>
              {timeZoneNames[key]}
              {key === timeZonePreference && <Check size={14} />}
            </span>
            <b>
              {new Intl.DateTimeFormat("zh-CN", {
                timeZone: resolveTimeZone(key, localTimeZone),
                hour: "2-digit",
                minute: "2-digit",
                hourCycle: "h23",
              }).format(now)}
            </b>
            <small>
              {new Intl.DateTimeFormat("zh-CN", {
                timeZone: resolveTimeZone(key, localTimeZone),
                month: "2-digit",
                day: "2-digit",
              }).format(now)}
            </small>
          </button>
        ))}
      </div>
      <p className="micro-copy">
        默认多伦多。所选时区用于显示互动、使用和兑换记录的时间，仅保存在这台设备。手机本地：
        {localTimeZone}。纪念日、倒计时和卡券有效期统一按多伦多日期计算。
      </p>
    </section>
  );
}
export function HomeClock() {
  const { displayTimeZone, timeZonePreference, setPanel } = useKingdom();
  const now = useClock(30000);
  return (
    <button
      className="home-clock"
      onClick={() => setPanel({ kind: "settings" })}
    >
      <Clock3 size={14} />
      {timeZoneNames[timeZonePreference]} ·{" "}
      {new Intl.DateTimeFormat("zh-CN", {
        timeZone: displayTimeZone,
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(now)}
      <span>换个时区 ♡</span>
    </button>
  );
}
