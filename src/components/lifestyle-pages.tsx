"use client";
import { useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  Heart,
  Plus,
  Check,
  MapPin,
  ChevronRight,
  X,
} from "lucide-react";
import { useKingdom } from "./context";
import { Sprite } from "./art";
import { cuisineEmoji, cuisines, travelStats } from "@/lib/lifestyle";
import { TripMap } from "./trip-map";
export function FoodArt({
  cuisine,
  photoId,
}: {
  cuisine: number;
  photoId?: string | null;
}) {
  return photoId ? (
    <img
      className="food-photo"
      src={`/api/photos/${photoId}`}
      alt="我们的美味记录"
    />
  ) : (
    <span className="food-art" aria-hidden="true">
      {cuisineEmoji[cuisine]}
    </span>
  );
}
export function Recipes() {
  const { state, setPanel, mutate, busy } = useKingdom();
  const [tab, setTab] = useState("wait"),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("all");
  const [onlyFavorites, setOnlyFavorites] = useState(true);
  const recipes = state.recipes.filter(
    (r) =>
      (!onlyFavorites || r.favorite) &&
      r.title.includes(query) &&
      (category === "all" || r.cuisine === +category),
  );
  return (
    <div className="lifestyle-page">
      <section className="life-hero kitchen-hero">
        <div>
          <span className="eyebrow">LOO’S LITTLE KITCHEN</span>
          <h2>今天想吃什么呀？</h2>
          <p>你负责点菜，我负责偏爱 ♡</p>
          <small>已一起开饭 {state.mealHistory.length} 次</small>
        </div>
        <Sprite sheet="events" index={4} />
      </section>
      <button
        className="button primary coral"
        onClick={() => setPanel({ kind: "recipe-form" })}
      >
        <Plus size={18} />
        收一道新菜 · 粘贴小红书链接
      </button>
      <div className="life-tabs" role="tablist" aria-label="菜谱分类">
        {[
          ["wait", "想吃清单"],
          ["saved", "收藏菜谱"],
          ["history", "开饭回忆"],
        ].map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
            <small>
              {id === "wait"
                ? state.mealWaitlist.length
                : id === "history"
                  ? state.mealHistory.length
                  : state.recipes.filter((r) => r.favorite).length}
            </small>
          </button>
        ))}
      </div>
      {tab === "wait" && (
        <>
          <div className="section-caption">
            <h2>下一顿的小期待</h2>
            <span>按想吃程度排排队</span>
          </div>
          {!state.mealWaitlist.length && (
            <Empty
              art={4}
              title="肚子已经准备好了"
              text="收一道喜欢的菜，加入想吃清单吧。"
            />
          )}
          {state.mealWaitlist.map((w, i) => {
            const r = state.recipes.find((r) => r.id === w.recipeId);
            if (!r) return null;
            return (
              <article className="meal-card" key={w.id}>
                <div className="meal-card-top">
                  <span className="queue-number">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <button
                    className="recipe-summary"
                    onClick={() =>
                      setPanel({ kind: "recipe-detail", id: r.id })
                    }
                  >
                    <FoodArt cuisine={r.cuisine} photoId={r.photoId} />
                    <span>
                      <b>{r.title}</b>
                      <small>{cuisines[r.cuisine]} · 等待大厨宠幸</small>
                    </span>
                  </button>
                  <button
                    className="mini-action"
                    disabled={busy}
                    aria-label={`移出清单${r.title}`}
                    onClick={() =>
                      void mutate({ type: "meal.remove", id: w.id })
                    }
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="meal-actions">
                  <div>
                    <button
                      className="mini-action"
                      disabled={busy || !i}
                      aria-label={`上移${r.title}`}
                      onClick={() =>
                        void mutate({
                          type: "meal.move",
                          id: w.id,
                          direction: "up",
                        })
                      }
                    >
                      <ArrowUp size={17} />
                    </button>
                    <button
                      className="mini-action"
                      disabled={busy || i === state.mealWaitlist.length - 1}
                      aria-label={`下移${r.title}`}
                      onClick={() =>
                        void mutate({
                          type: "meal.move",
                          id: w.id,
                          direction: "down",
                        })
                      }
                    >
                      <ArrowDown size={17} />
                    </button>
                  </div>
                  <button
                    className="pill-action"
                    onClick={() => setPanel({ kind: "cook", id: w.id })}
                  >
                    <Check size={16} />
                    这道做过啦
                  </button>
                </div>
              </article>
            );
          })}
        </>
      )}
      {tab === "saved" && (
        <>
          <div className="search-row">
            <input
              aria-label="搜索菜谱"
              placeholder="找找那道心头好…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              aria-label="筛选菜系"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">全部菜系</option>
              {cuisines.map((c, i) => (
                <option key={c} value={i}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <label className="simple-check">
            <input
              type="checkbox"
              checked={onlyFavorites}
              onChange={(e) => setOnlyFavorites(e.target.checked)}
            />
            只看已收藏
          </label>
          {!recipes.length && (
            <Empty
              art={4}
              title="美味收藏夹，等你投喂"
              text="也可以取消「只看已收藏」，查看全部菜谱。"
            />
          )}
          <div className="recipe-grid">
            {recipes.map((r) => (
              <article key={r.id} className="saved-recipe">
                <button
                  className="saved-recipe-main"
                  onClick={() => setPanel({ kind: "recipe-detail", id: r.id })}
                >
                  <FoodArt cuisine={r.cuisine} photoId={r.photoId} />
                  <b>{r.title}</b>
                  <small>{cuisines[r.cuisine]}</small>
                </button>
                <button
                  className="favorite-button"
                  aria-label={`${r.favorite ? "取消收藏" : "收藏"}${r.title}`}
                  aria-pressed={r.favorite}
                  disabled={busy}
                  onClick={() =>
                    void mutate({
                      type: "recipe.favorite",
                      id: r.id,
                      value: !r.favorite,
                    })
                  }
                >
                  <Heart
                    size={18}
                    fill={r.favorite ? "currentColor" : "none"}
                  />
                </button>
              </article>
            ))}
          </div>
        </>
      )}
      {tab === "history" && (
        <>
          <div className="section-caption">
            <h2>把好吃的日子存起来</h2>
            <span>大厨Loo营业记录</span>
          </div>
          {!state.mealHistory.length && (
            <Empty
              art={4}
              title="第一顿，值得期待"
              text="从想吃清单标记做过，就会在这里留下回忆。"
            />
          )}
          {[...state.mealHistory]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((m) => (
              <article className="history-card" key={m.id}>
                <FoodArt cuisine={m.cuisine} photoId={m.photoId} />
                <div>
                  <time>{m.date.replaceAll("-", ".")}</time>
                  <h3>{m.title}</h3>
                  <span className="stars" aria-label={`${m.rating}星`}>
                    {"★".repeat(m.rating)}
                    {"☆".repeat(5 - m.rating)}
                  </span>
                  <p>{m.note || "两个人一起吃，什么都香。"}</p>
                  {state.recipes.some((r) => r.id === m.recipeId) && (
                    <button
                      className="text-action"
                      disabled={busy}
                      onClick={() =>
                        void mutate({
                          type: "meal.enqueue",
                          recipeId: m.recipeId,
                          requestId: crypto.randomUUID(),
                        })
                      }
                    >
                      还想再吃一次 ＋
                    </button>
                  )}
                </div>
              </article>
            ))}
        </>
      )}
    </div>
  );
}
function Empty({
  art,
  title,
  text,
}: {
  art: number;
  title: string;
  text: string;
}) {
  return (
    <div className="life-empty">
      <Sprite sheet="events" index={art} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export function Trips({ focusId }: { focusId: string | null }) {
  const { state, setPanel } = useKingdom();
  const initial = state.trips.find((t) => t.id === focusId);
  const [tab, setTab] = useState(initial?.status || "visited"),
    [year, setYear] = useState("all"),
    [selected, setSelected] = useState<string | null>(focusId);
  const stats = travelStats(state.trips, year);
  const years = [
    ...new Set(
      state.trips
        .filter((t) => t.status === "visited")
        .map((t) => t.startDate.slice(0, 4)),
    ),
  ]
    .sort()
    .reverse();
  const shown = state.trips
    .filter(
      (t) =>
        t.status === tab &&
        (tab === "planned" || year === "all" || t.startDate.startsWith(year)),
    )
    .sort((a, b) =>
      tab === "planned"
        ? a.startDate.localeCompare(b.startDate)
        : b.startDate.localeCompare(a.startDate),
    );
  const active = shown.find((t) => t.id === selected);
  return (
    <div className="lifestyle-page">
      <section className="life-hero travel-hero">
        <div>
          <span className="eyebrow">OUR LITTLE BIG WORLD</span>
          <h2>和你，慢慢看世界</h2>
          <p>下一站，也要牵着你的手。</p>
          <small>
            {year === "all" ? "到目前为止" : `${year} 年`}，一起收藏了{" "}
            {stats.trips} 段旅程
          </small>
        </div>
        <Sprite sheet="events" index={2} />
      </section>
      <div className="section-caption">
        <h2>我们的足迹小结</h2>
        <select
          aria-label="回顾年份"
          value={year}
          onChange={(e) => {
            setYear(e.target.value);
            setSelected(null);
          }}
        >
          <option value="all">全部时光</option>
          {years.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
      </div>
      <div className="travel-stats">
        <div>
          <b>{stats.places}</b>
          <span>个共同地点</span>
        </div>
        <div>
          <b>{stats.km.toLocaleString()}</b>
          <span>公里 · 估算</span>
        </div>
        <div>
          <b>{stats.countries}</b>
          <span>个到访国家</span>
        </div>
      </div>
      <p className="micro-copy">
        仅统计已完成旅行；公里数按每段行程中相邻地点的直线距离估算，不代表实际飞行或驾车里程。
        {stats.unlocated > 0 && ` 还有 ${stats.unlocated} 段回忆等你补上地点。`}
      </p>
      <div className="life-tabs two-tabs" role="tablist" aria-label="旅行分类">
        <button
          role="tab"
          aria-selected={tab === "visited"}
          onClick={() => {
            setTab("visited");
            setSelected(null);
          }}
        >
          一起去过
        </button>
        <button
          role="tab"
          aria-selected={tab === "planned"}
          onClick={() => {
            setTab("planned");
            setSelected(null);
          }}
        >
          下一站计划
        </button>
      </div>
      <div className="map-heading">
        <span>
          <MapPin size={16} />
          {active ? active.title : "我们的小小世界地图"}
        </span>
        {active && <button onClick={() => setSelected(null)}>查看全部</button>}
      </div>
      <TripMap
        trips={shown}
        mode="overview"
        selectedId={selected}
        onSelect={(id) => {
          setSelected(id);
          setPanel({ kind: "trip-detail", id });
        }}
      />
      <p className="micro-copy">
        一段旅程，一颗小爱心（以首站定位）。点击标记或下方旅程，展开完整路线。蓝色是足迹，粉色是期待。
      </p>
      {active && (
        <button
          className="selected-trip"
          onClick={() => setPanel({ kind: "trip-detail", id: active.id })}
        >
          <span>
            <b>{active.title}</b>
            <small>
              {active.startDate} ·{" "}
              {active.places.length
                ? active.places.map((p) => p.name).join(" → ")
                : "目的地等你补充"}
            </small>
          </span>
          <ChevronRight size={18} />
        </button>
      )}
      <button
        className="button primary coral"
        onClick={() => setPanel({ kind: "trip-form" })}
      >
        <Plus size={18} />
        收藏一段旅程
      </button>
      {!shown.length && (
        <Empty
          art={2}
          title={
            tab === "planned"
              ? "下一站，想和你去哪里？"
              : "世界很大，我们慢慢走"
          }
          text={
            tab === "planned"
              ? "大事件里的旅行计划，也会来到这里。"
              : "记下城市和小故事，让回忆在地图上发芽。"
          }
        />
      )}
      {shown.map((t) => (
        <article
          key={t.id}
          className={`trip-card ${selected === t.id ? "active" : ""}`}
        >
          <button
            className="trip-card-main"
            onClick={() => setPanel({ kind: "trip-detail", id: t.id })}
          >
            {t.photoId ? (
              <img src={`/api/photos/${t.photoId}`} alt={t.title} />
            ) : (
              <Sprite sheet="events" index={2} />
            )}
            <span>
              <small>
                {t.startDate.replaceAll("-", ".")} —{" "}
                {t.endDate.slice(5).replace("-", ".")}
              </small>
              <b>{t.title}</b>
              <p>
                {t.places.map((p) => p.name).join(" → ") ||
                  "这段故事还没有地图坐标"}
              </p>
            </span>
            <ChevronRight size={17} />
          </button>
          <div className="trip-card-footer">
            <small>{t.eventId ? "♡ 已与大事件相连" : "♡ 我们的共同回忆"}</small>
            <button
              className="text-action"
              onClick={() => {
                setSelected(t.id);
                document
                  .querySelector(".map-heading")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              地图定位 <MapPin size={14} />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
