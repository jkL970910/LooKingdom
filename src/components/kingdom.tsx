"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookHeart,
  Heart,
  House,
  LoaderCircle,
  Ticket,
  WifiOff,
  RefreshCw,
  Bell,
  Plus,
  Crown,
  CookingPot,
  MapPinned,
} from "lucide-react";
import {
  type Command,
  type KingdomState,
  type Role,
  roleName,
} from "@/lib/domain";
import { Context, type Panel } from "./context";
import { Loo } from "./art";
import { Home } from "./home";
import { Journal } from "./journal";
import { Wallet } from "./wallet";
import { Recipes, Trips } from "./lifestyle-pages";
import { Panels, Login } from "./panels";
import { useTimeZone } from "./time-zone";
import { useStatusLabel } from "@/lib/coupon-flow";

type Page = "home" | "journal" | "wallet" | "recipes" | "trips";
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || "连接失败，请重试") as Error & {
      status: number;
    };
    error.status = response.status;
    throw error;
  }
  return data;
}
export default function Kingdom() {
  const timeZone = useTimeZone();
  const [serverOffset, setServerOffset] = useState(0);
  const [state, setState] = useState<KingdomState | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [page, setPage] = useState<Page>("home");
  const [panel, setPanel] = useState<Panel>(null);
  const [focusTripId, setFocusTripId] = useState<string | null>(null);
  const [session, setSession] = useState<{
    local: boolean;
    requiresCode: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [message, setMessage] = useState("");
  const [reaction, setReaction] = useState<{
    kind: "pat" | "hug" | "poke";
    to: Role;
    id: string;
  } | null>(null);
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactTo = useCallback((kind: "pat" | "hug" | "poke", to: Role) => {
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
    setReaction({ kind, to, id: crypto.randomUUID() });
    reactionTimer.current = setTimeout(() => setReaction(null), 3000);
  }, []);
  const lock = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notified = useRef(new Set<string>());
  const toast = useCallback((text: string) => {
    setMessage(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setMessage(""), 4200);
  }, []);
  const accept = useCallback((next: KingdomState) => {
    if (next.serverNow)
      setServerOffset(Date.parse(next.serverNow) - Date.now());
    setState((previous) =>
      !previous || next.version >= previous.version ? next : previous,
    );
  }, []);
  const refresh = useCallback(async () => {
    try {
      const next = await api<KingdomState>("/api/state");
      accept(next);
      setError("");
    } catch (e) {
      if ((e as Error & { status?: number }).status === 401) setRole(null);
      else setError((e as Error).message);
    }
  }, [accept]);
  const initialize = useCallback(async () => {
    setLoading(true);
    try {
      const info = await api<{
        role: Role | null;
        local: boolean;
        requiresCode: boolean;
      }>("/api/session");
      setSession(info);
      setRole(info.role);
      setError("");
      if (info.role) await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [refresh]);
  useEffect(() => {
    void initialize();
  }, [initialize]);
  useEffect(() => {
    const onConnection = () => {
      setOffline(!navigator.onLine);
      if (navigator.onLine && role) void refresh();
    };
    setOffline(!navigator.onLine);
    window.addEventListener("online", onConnection);
    window.addEventListener("offline", onConnection);
    return () => {
      window.removeEventListener("online", onConnection);
      window.removeEventListener("offline", onConnection);
    };
  }, [role, refresh]);
  useEffect(() => {
    if (!role) return;
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    const timer = setInterval(onVisible, 8000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [role, refresh]);
  useEffect(() => {
    if (!state || !role) return;
    const newItems = state.interactions.filter(
      (i) => i.to === role && !i.seen && !notified.current.has(i.id),
    );
    const received = newItems[0];
    if (received) {
      newItems.forEach((item) => notified.current.add(item.id));
      reactTo(received.kind, role);
      toast(
        `${roleName(received.from)}${received.kind === "pat" ? "摸了摸你的头" : received.kind === "hug" ? "给了你一个大大的抱抱" : "轻轻戳了你一下"} ♡`,
      );
    }
  }, [state, role, toast, reactTo]);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (reactionTimer.current) clearTimeout(reactionTimer.current);
    },
    [],
  );
  const noticedUses = useRef(new Set<string>());
  useEffect(() => {
    if (!state || !role) return;
    const changed = (state.couponUses || []).filter(
      (u) => !noticedUses.current.has(`${u.id}:${u.updatedAt}:${u.status}`),
    );
    for (const u of changed)
      noticedUses.current.add(`${u.id}:${u.updatedAt}:${u.status}`);
    const recent = changed.find(
      (u) =>
        Date.now() - Date.parse(u.updatedAt) < 60000 || u.status === "pending",
    );
    if (recent)
      toast(
        recent.status === "pending"
          ? `${roleName(recent.owner)}申请使用${recent.title} ♡`
          : `${recent.title} · ${useStatusLabel[recent.status]}`,
      );
  }, [state, role, toast]);
  const mutate = useCallback(
    async (command: Command) => {
      if (lock.current) return null;
      if (!navigator.onLine) {
        toast("还没有连上网络，联网后再试一次吧");
        return null;
      }
      lock.current = true;
      setBusy(true);
      try {
        const next = await api<KingdomState>("/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(command),
        });
        accept(next);
        setError("");
        return next;
      } catch (e) {
        toast((e as Error).message);
        if ((e as Error & { status?: number }).status === 401) setRole(null);
        else if ((e as Error & { status?: number }).status === 409)
          void refresh();
        return null;
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
    [accept, refresh, toast],
  );
  const login = async (selected: Role, code: string) => {
    await api("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: selected, code }),
    });
    setRole(selected);
    setPanel(null);
    setState(null);
    await refresh();
  };
  const logout = async () => {
    try {
      await api("/api/session", { method: "DELETE" });
      setState(null);
      setRole(null);
      setPanel(null);
    } catch (e) {
      toast((e as Error).message);
    }
  };
  const navigate = (next: Page) => {
    setFocusTripId(null);
    setPage(next);
    setPanel(null);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const title = {
    home: "Loo国生活",
    journal: "Loo国大事件",
    wallet: "Loo国卡包",
    recipes: "Loo国菜谱",
    trips: "Loo国旅行游记",
  }[page];
  const subtitle = {
    home: "今天也要一起好好过",
    journal: "普通日子，也值得收藏",
    wallet: "把偏爱，攒成一张张小特权",
    recipes: "一日三餐，都想和你一起",
    trips: "把一起走过的路，藏进小小地图",
  }[page];
  return (
    <>
      <aside className="desktop-note" aria-hidden="true">
        <div className="tiny-wordmark">
          <Crown size={20} /> LOO KINGDOM
        </div>
        <h2>
          两个人的
          <br />
          小小王国<span>。</span>
        </h2>
        <p>
          今天的心情，有人惦记。
          <br />
          平凡的小事，一起收藏。
        </p>
        <div className="doodle-hearts">
          ♡ <span>♡</span>
        </div>
        <small>MADE OF LITTLE MOMENTS & LOTS OF LOVE</small>
      </aside>
      <div className={`app-shell role-${role || "blue"}`}>
        {(offline || error) && (
          <div className="connection-banner" role="alert">
            <WifiOff size={16} />
            <span>{offline ? "网络断开了，连接后再保存哦" : error}</span>
            <button
              aria-label="重新连接"
              onClick={() => void (role ? refresh() : initialize())}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        )}
        <header className="app-header">
          <div>
            <div className="title-row">
              <h1>{title}</h1>
              {page === "journal" ? (
                <Crown className="title-doodle crown" />
              ) : (
                <Heart className="title-doodle" fill="currentColor" />
              )}
            </div>
            <p>{subtitle}</p>
          </div>
          {role && state && (
            <button
              className={page === "journal" ? "add-round" : "avatar-button"}
              aria-label={page === "journal" ? "新建大事件" : "小窝设置"}
              onClick={() =>
                setPanel({ kind: page === "journal" ? "event" : "settings" })
              }
            >
              {page === "journal" ? <Plus /> : <Loo role={role} activity={1} />}
            </button>
          )}
        </header>
        {loading || (role && !state) ? (
          <div className="loading-view">
            <img src="/art/home.webp" alt="蓝Loo和红Loo的温馨小窝" />
            <p>
              <LoaderCircle className="spin" size={18} /> 正在打开小窝…
            </p>
            {error && (
              <button
                className="button secondary"
                onClick={() => void initialize()}
              >
                重新试试
              </button>
            )}
          </div>
        ) : !role ? (
          <Login requiresCode={session?.requiresCode ?? true} onLogin={login} />
        ) : (
          state && (
            <Context.Provider
              value={{
                ...timeZone,
                serverOffset,
                state,
                role,
                busy,
                panel,
                feedback: message,
                reaction,
                reactTo,
                setPanel,
                mutate,
                toast,
                openTrip: (id) => {
                  navigate("trips");
                  setFocusTripId(id);
                },
              }}
            >
              <main
                key={
                  page === "trips"
                    ? `${page}-${focusTripId}-${state.trips.find((t) => t.id === focusTripId)?.status}`
                    : page
                }
                className="page-content"
              >
                {page === "home" ? (
                  <Home />
                ) : page === "journal" ? (
                  <Journal />
                ) : page === "recipes" ? (
                  <Recipes />
                ) : page === "trips" ? (
                  <Trips focusId={focusTripId} />
                ) : (
                  <Wallet />
                )}
              </main>
              <div className="quiet-footer">
                <Heart size={11} /> 这里的每件小事，都和你有关{" "}
                <Heart size={11} />
              </div>
              <nav className="bottom-nav" aria-label="主导航">
                {(
                  [
                    { id: "home", label: "小窝", Icon: House },
                    { id: "journal", label: "大事件", Icon: BookHeart },
                    { id: "recipes", label: "菜谱", Icon: CookingPot },
                    { id: "trips", label: "足迹", Icon: MapPinned },
                    { id: "wallet", label: "卡包", Icon: Ticket },
                  ] as const
                ).map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    aria-current={page === id ? "page" : undefined}
                    className={page === id ? `selected nav-${id}` : ""}
                    onClick={() => navigate(id)}
                  >
                    <Icon
                      size={26}
                      strokeWidth={1.8}
                      fill={page === id ? "currentColor" : "none"}
                    />
                    <span>{label}</span>
                    <i />
                  </button>
                ))}
              </nav>
              <Panels local={session?.local ?? false} onLogout={logout} />
            </Context.Provider>
          )
        )}
      </div>
      {state && role && (
        <button
          className="desktop-inbox"
          onClick={() => setPanel({ kind: "inbox" })}
        >
          <Bell size={17} /> 收到的小心意{" "}
          {state.interactions.filter((i) => i.to === role && !i.seen).length ||
            ""}
        </button>
      )}
      {message && !panel && (
        <div className="toast" role="status">
          <Heart size={18} fill="currentColor" />
          {message}
        </div>
      )}
    </>
  );
}
