"use client";
import {
  Bell,
  Hand,
  Heart,
  Pointer,
  Pencil,
  Plane,
  ChevronRight,
  Plus,
} from "lucide-react";
import {
  activities,
  moods,
  moodEmoji,
  daysUntil,
  otherRole,
  roleName,
  today,
  type DiaryEvent,
  type Role,
} from "@/lib/domain";
import { useKingdom } from "./context";
import { Loo, Sprite } from "./art";
import { prioritizedPlans } from "@/lib/event-priority";
import { activeHeadMassage } from "@/lib/home-activity";
import { HomeClock, useClock } from "./time-zone";
import { CouponActivity } from "./coupon-flow";

export function Countdown({
  event,
  compact = false,
  onClick,
}: {
  event: DiaryEvent;
  compact?: boolean;
  onClick?: () => void;
}) {
  const { state } = useKingdom();
  const days = daysUntil(event, today(state.timeZone));
  return (
    <button
      type="button"
      className={`countdown-card ${compact ? "compact" : ""}`}
      onClick={onClick}
    >
      <div className="countdown-copy">
        <span className="countdown-label">{event.title}</span>
        <div className="days">
          {days === 0 ? (
            <strong className="today-label">就是今天</strong>
          ) : (
            <>
              <strong>{Math.abs(days)}</strong>
              <span>{days > 0 ? "天" : "天前"}</span>
              <Plane size={24} />
            </>
          )}
        </div>
        <p>
          {compact
            ? days >= 0
              ? event.theme === 3
                ? "离一起回国，又近了一点点 ♡"
                : "离共同的期待，又近了一点点 ♡"
              : "一起收藏的温暖回忆"
            : event.note.split("\n")[0] || "好期待，一起到来的那一天"}
        </p>
      </div>
      <Sprite
        sheet="events"
        index={event.theme === 3 ? 2 : event.theme}
        className="countdown-art"
      />
      <span className="countdown-doodle">
        和你
        <br />
        去更远的地方
      </span>
    </button>
  );
}
function updateLabel(time: string) {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(time)) / 60000),
  );
  return minutes < 1
    ? "刚刚更新"
    : minutes < 60
      ? `${minutes} 分钟前更新`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)} 小时前更新`
        : `${Math.floor(minutes / 1440)} 天前更新`;
}
export function Home() {
  const { state, role, setPanel, mutate, busy, toast, reaction, reactTo } =
    useKingdom();
  const now = useClock();
  const massage = activeHeadMassage(state.couponUses || [], +now);
  const partner = otherRole(role);
  const current = today(state.timeZone);
  const { pinned } = prioritizedPlans(
    state.events,
    state.pinnedEventId,
    current,
  );
  const defaultScene = !massage &&
    state.profiles.blue.activity === 0 &&
    state.profiles.red.activity === 4 &&
    state.profiles.blue.mood === 1 &&
    state.profiles.red.mood === 0;
  const unread = state.interactions.filter(
    (i) => i.to === role && !i.seen,
  ).length;
  const interact = async (kind: "pat" | "hug" | "poke") => {
    if (
      await mutate({ type: "interact", kind, requestId: crypto.randomUUID() })
    ) {
      reactTo(kind, partner);
      toast(
        kind === "pat"
          ? `摸摸${roleName(partner)}的头，今天辛苦啦 ♡`
          : kind === "hug"
            ? `给${roleName(partner)}的抱抱已经送到啦 ♡`
            : `${roleName(partner)}，有人在想你哦 ♡`,
      );
    }
  };
  return (
    <>
      <HomeClock />
      <CouponActivity compact />
      <section
        className={`home-scene ${defaultScene ? "" : "custom-scene"}`}
        aria-label="两个人的当前状态"
      >
        <img
          className="scene-background"
          src={`/art/${defaultScene ? "home" : "room"}.webp`}
          alt={
            defaultScene
              ? "蓝Loo忙着工作，红Loo在小窝开心追剧"
              : "温暖的Loo国小窝"
          }
          fetchPriority="high"
        />
        {(["blue", "red"] as Role[]).map((person) => (
          <button
            key={person}
            className={`scene-person ${person}`}
            aria-label={`查看${roleName(person)}状态`}
            onClick={() =>
              setPanel({ kind: role === person ? "status" : "partner" })
            }
          >
            <span className={`speech-bubble ${person}`}>
              <b>
                {roleName(person)} ·{" "}
                {massage ? (massage.owner === person ? "享受揉头中" : "认真揉头中") : activities[state.profiles[person].activity]}
              </b>
              <span>
                {moodEmoji[state.profiles[person].mood]}{" "}
                {moods[state.profiles[person].mood]}
              </span>
            </span>
            {!defaultScene && !massage && (
              <Loo
                key={`${person}-${state.profiles[person].activity}`}
                role={person}
                activity={state.profiles[person].activity}
                className="scene-loo"
              />
            )}
          </button>
        ))}
        {massage && (
          <Sprite sheet="head-massage" index={massage.owner === "red" ? 0 : 1} cols={2} rows={1}
            className="scene-head-massage" label={roleName(massage.recipient) + "正在给" + roleName(massage.owner) + "揉头"} />
        )}
        {reaction && (
          <div
            key={reaction.id}
            className={`scene-reaction reaction-${reaction.kind} reaction-to-${reaction.to}`}
            role="img"
            aria-label={`${roleName(reaction.to)}收到了${reaction.kind === "pat" ? "摸摸头" : reaction.kind === "hug" ? "抱抱" : "戳一戳"}`}
          >
            <div className="reaction-glyph">
              {reaction.kind === "pat" ? (
                <Hand size={54} fill="#ffe3cd" />
              ) : reaction.kind === "hug" ? (
                <Heart size={66} fill="#f99494" />
              ) : (
                <Pointer size={51} fill="#ffe3cd" />
              )}
            </div>
            <span className="reaction-caption">
              {reaction.kind === "pat"
                ? "摸摸头，乖乖"
                : reaction.kind === "hug"
                  ? "抱紧我的Loo"
                  : "有人想你啦"}
            </span>
            <i className="love-particle p-one">♡</i>
            <i className="love-particle p-two">♡</i>
            <i className="love-particle p-three">♡</i>
          </div>
        )}
        <span className="scene-update">
          {updateLabel(state.profiles[role].updatedAt)}
        </span>
        <button
          className="scene-inbox"
          aria-label={`收到的小心意${unread ? `，${unread}条未读` : ""}`}
          onClick={() => setPanel({ kind: "inbox" })}
        >
          <Bell size={17} />
          {unread > 0 && <span>{unread}</span>}
        </button>
      </section>
      {pinned ? (
        <Countdown
          compact
          event={pinned}
          onClick={() => setPanel({ kind: "event-detail", event: pinned })}
        />
      ) : (
        <button
          className="empty-countdown"
          onClick={() => setPanel({ kind: "event" })}
        >
          <Plane />
          <span>
            <b>下一次心动，倒数着期待</b>
            <small>记下见面或旅行的日子</small>
          </span>
          <Plus size={20} />
        </button>
      )}
      <section className="interaction-card">
        <div className="section-title">
          <Heart fill="currentColor" size={15} />
          <h2>想对{roleName(partner)}做什么？</h2>
          <Heart fill="currentColor" size={12} />
        </div>
        <div className="interaction-buttons">
          {(
            [
              { kind: "pat", Icon: Hand, label: "摸摸头" },
              { kind: "hug", Icon: Heart, label: "抱一下" },
              { kind: "poke", Icon: Pointer, label: "戳一戳" },
            ] as const
          ).map(({ kind, Icon, label }) => (
            <button
              disabled={busy}
              key={kind}
              onClick={() => void interact(kind)}
            >
              <Icon
                size={30}
                fill={kind === "hug" ? "currentColor" : "none"}
                strokeWidth={1.6}
              />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </section>
      <button
        className={`button primary ${role}`}
        onClick={() => setPanel({ kind: "status" })}
      >
        <Pencil size={19} /> 更新我的状态
      </button>
      <button
        className="partner-note"
        onClick={() => setPanel({ kind: "partner" })}
      >
        <span className={`note-dot ${partner}`} />
        <span>
          {roleName(partner)}：
          {state.profiles[partner].note || "今天也很想你 ♡"}
        </span>
        <ChevronRight size={15} />
      </button>
    </>
  );
}
