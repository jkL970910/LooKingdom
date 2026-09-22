"use client";
import { useState } from "react";
import { ChevronRight, Plus, CalendarHeart, Pin } from "lucide-react";
import {
  daysUntil,
  moodEmoji,
  moods,
  nextOccurrence,
  today,
  themeEmoji,
} from "@/lib/domain";
import { useKingdom } from "./context";
import { Sprite } from "./art";
import { Countdown } from "./home";
export function Journal() {
  const { state, setPanel } = useKingdom();
  const [futureTab, setFutureTab] = useState(false);
  const current = today(state.timeZone);
  const upcoming = state.events
    .filter((e) => daysUntil(e, current) > 0 || (e.annual && e.countdown))
    .sort((a, b) =>
      nextOccurrence(a, current).localeCompare(nextOccurrence(b, current)),
    );
  const history = state.events
    .filter((e) => e.date <= current)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );
  const pinned =
    upcoming.find((e) => e.id === state.pinnedEventId && e.countdown) ||
    upcoming.find((e) => e.countdown);
  return (
    <>
      <div className="journal-heading">
        <h2>
          {current.slice(0, 4)} 年 {Number(current.slice(5, 7))} 月
        </h2>
        <span>{state.events.length} 个小纪念</span>
      </div>
      <div className="segmented journal-tabs">
        <button
          className={!futureTab ? "active blue" : ""}
          onClick={() => setFutureTab(false)}
        >
          我们的故事
        </button>
        <button
          className={futureTab ? "active coral" : ""}
          onClick={() => setFutureTab(true)}
        >
          未来计划
        </button>
      </div>
      {!futureTab && pinned && (
        <Countdown
          event={pinned}
          onClick={() => setPanel({ kind: "event-detail", event: pinned })}
        />
      )}
      <div className="event-list">
        {(futureTab ? upcoming : history).map((event, index) => (
          <button
            className={`event-card ${index > 0 && !futureTab ? "event-small" : ""}`}
            key={event.id}
            onClick={() => setPanel({ kind: "event-detail", event })}
          >
            {index > 0 && !futureTab ? (
              <>
                <Sprite
                  sheet="events"
                  index={event.theme}
                  className="event-mini-art"
                />
                <div>
                  <h3>{event.title}</h3>
                  <p>{event.note.split("\n")[0] || "和你在一起的日子"}</p>
                </div>
                <time>{event.date.slice(5).replace("-", ".")}</time>
                <ChevronRight size={16} />
              </>
            ) : (
              <>
                <div className="event-meta">
                  <time>
                    {event.date.slice(5).replace("-", ".")} ·{" "}
                    {new Intl.DateTimeFormat("zh-CN", {
                      weekday: "long",
                      timeZone: "UTC",
                    }).format(new Date(event.date + "T12:00:00Z"))}
                  </time>
                  <span className="mood-tag">
                    {moodEmoji[event.mood]} {moods[event.mood]}
                  </span>
                </div>
                <h3>
                  {event.title}
                  {state.pinnedEventId === event.id && <Pin size={15} />}
                </h3>
                <p className="event-excerpt">
                  {event.note.split("\n")[0] ||
                    `${themeEmoji[event.theme]} 我们又多了一份小小的回忆`}
                </p>
                {futureTab && (
                  <span className="future-days">
                    {daysUntil(event, current) === 0
                      ? "就是今天！"
                      : `还有 ${daysUntil(event, current)} 天`}
                  </span>
                )}
                <div className="event-cover">
                  {event.photoId ? (
                    <img
                      src={`/api/photos/${event.photoId}`}
                      alt={event.title}
                      loading="lazy"
                    />
                  ) : (
                    <Sprite sheet="events" index={event.theme} />
                  )}
                  <span className="heart-sticker">♡</span>
                </div>
              </>
            )}
          </button>
        ))}
      </div>
      {(futureTab ? upcoming : history).length === 0 && (
        <div className="empty-state">
          <CalendarHeart size={34} />
          <h3>{futureTab ? "把期待写下来吧" : "故事，从今天开始"}</h3>
          <p>
            {futureTab
              ? "旅行、见面、生日，都值得倒数。"
              : "拍张照片，记住属于你们的小瞬间。"}
          </p>
        </div>
      )}
      <button
        className="button primary coral journal-add"
        onClick={() => setPanel({ kind: "event" })}
      >
        <Plus size={23} /> 记一件大事
      </button>
    </>
  );
}
