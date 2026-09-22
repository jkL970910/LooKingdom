"use client";
import { useState } from "react";
import { ChevronRight, Plus, CalendarHeart, Pin } from "lucide-react";
import { daysUntil, moodEmoji, nextOccurrence, today } from "@/lib/domain";
import { useKingdom } from "./context";
import { Sprite } from "./art";
import { prioritizedPlans } from "@/lib/event-priority";
export function Journal() {
  const { state, setPanel } = useKingdom();
  const [futureTab, setFutureTab] = useState(false);
  const current = today(state.timeZone);
  const { upcoming, pinned } = prioritizedPlans(
    state.events,
    state.pinnedEventId,
    current,
  );
  const history = state.events
    .filter((e) => e.date <= current)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );
  const shown = futureTab
    ? upcoming
    : pinned
      ? [pinned, ...history.filter((e) => e.id !== pinned.id)]
      : history;
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
      <div className="event-list">
        {shown.map((event) => (
          <button
            className="event-card event-small"
            key={event.id}
            onClick={() => setPanel({ kind: "event-detail", event })}
          >
            {event.photoId ? (
              <img
                className="event-mini-art"
                src={`/api/photos/${event.photoId}`}
                alt=""
                loading="lazy"
              />
            ) : (
              <Sprite
                sheet="events"
                index={event.theme}
                className="event-mini-art"
              />
            )}
            <div>
              <h3>{event.title}</h3>
              {pinned?.id === event.id && (
                <span className="pinned-plan-label">
                  <Pin size={12} />
                  {state.pinnedEventId === event.id ? "已置顶" : "最近计划"}
                </span>
              )}
              <p>
                {moodEmoji[event.mood]}{" "}
                {event.note.split("\n")[0] || "和你在一起的日子"}
              </p>
            </div>
            <span className="event-list-date">
              <time>
                {(futureTab || pinned?.id === event.id
                  ? nextOccurrence(event, current)
                  : event.date
                ).replaceAll("-", ".")}
              </time>
              {(futureTab || pinned?.id === event.id) && (
                <small>
                  {daysUntil(event, current) === 0
                    ? "就是今天"
                    : `还有 ${daysUntil(event, current)} 天`}
                </small>
              )}
            </span>
            <ChevronRight size={16} />
          </button>
        ))}
      </div>
      {shown.length === 0 && (
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
