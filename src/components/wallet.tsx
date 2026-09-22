"use client";
import { useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
  Sparkles,
  Ticket,
  History,
  Heart,
} from "lucide-react";
import { type Coupon, type Role, roleName, today } from "@/lib/domain";
import { useKingdom } from "./context";
import { CardArt } from "./art";
import { CouponActivity, CouponUseHistory } from "./coupon-flow";
import { activeUseFor } from "@/lib/coupon-flow";
export function Wallet() {
  const { state, role, setPanel } = useKingdom();
  const [owner, setOwner] = useState<Role>(role);
  const [tab, setTab] = useState<"available" | "used" | "history">("available");
  const [index, setIndex] = useState(0);
  const touch = useRef<number | null>(null);
  const current = today(state.timeZone);
  const usable = (c: Coupon) =>
    c.remaining > 0 && (!c.expires || c.expires >= current);
  const cards = state.coupons.filter(
    (c) => c.owner === owner && (tab === "available" ? usable(c) : !usable(c)),
  );
  const selected = Math.min(index, Math.max(0, cards.length - 1));
  const card = cards[selected];
  const active = card ? activeUseFor(state, card.id) : undefined;
  const move = (amount: number) =>
    setIndex((selected + amount + cards.length) % cards.length);
  const history = state.redemptions.filter((r) => r.owner === owner);
  return (
    <>
      <CouponActivity />
      <div className="segmented owner-tabs">
        {(["blue", "red"] as Role[]).map((person) => (
          <button
            key={person}
            className={
              owner === person
                ? `active ${person === "red" ? "coral" : "blue"}`
                : ""
            }
            onClick={() => {
              setOwner(person);
              setIndex(0);
            }}
          >
            {roleName(person)}专用
          </button>
        ))}
      </div>
      <div className="wallet-tabs">
        {(
          [
            { id: "available", text: "可使用" },
            { id: "used", text: "已用完 / 过期" },
            { id: "history", text: "兑换记录" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "active" : ""}
            onClick={() => {
              setTab(t.id);
              setIndex(0);
            }}
          >
            {t.text}
          </button>
        ))}
      </div>
      {tab === "history" ? (
        <CouponUseHistory owner={owner} />
      ) : card ? (
        <>
          <div
            className="ticket-deck"
            onTouchStart={(e) => {
              touch.current = e.touches[0].clientX;
            }}
            onTouchEnd={(e) => {
              if (touch.current !== null) {
                const delta = e.changedTouches[0].clientX - touch.current;
                if (Math.abs(delta) > 45) move(delta < 0 ? 1 : -1);
              }
              touch.current = null;
            }}
          >
            <div className="ticket-back back-two" />
            <div className="ticket-back back-one" />
            <article
              className={`coupon-card color-${card.color} owner-${owner}`}
              key={card.id}
              aria-label={`${card.title}，剩余${card.remaining}次`}
            >
              <div className="coupon-top">
                <div className="coupon-owner">
                  <Heart size={17} fill="currentColor" /> {roleName(owner)}专用
                </div>
                <Sparkles size={25} className="ticket-sparkle" />
                <h2>{card.title}</h2>
                <p>{card.description}</p>
                <CardArt role={owner} art={card.art} className="coupon-art" />
                <span className="ticket-handwriting">
                  乖乖
                  <br />
                  有我在 ♡
                </span>
              </div>
              <div className="coupon-bottom">
                <div className="coupon-stats">
                  <span>
                    剩余 <strong>{card.remaining}</strong> 次
                  </span>
                  <div>
                    {card.minutes > 0 ? (
                      <>
                        <b>共 {card.remaining * card.minutes} 分钟</b>
                        <small>每次 {card.minutes} 分钟</small>
                      </>
                    ) : (
                      <>
                        <b>{card.benefit || "一份专属偏爱"}</b>
                        <small>
                          {card.expires
                            ? `${card.expires} 前有效`
                            : "偏爱不设期限"}
                        </small>
                      </>
                    )}
                  </div>
                </div>
                {usable(card) ? (
                  <button
                    className={`button primary ${owner}`}
                    disabled={!active && owner !== role}
                    onClick={() =>
                      setPanel(
                        active
                          ? { kind: "coupon-use", id: active.id }
                          : { kind: "redeem", coupon: card },
                      )
                    }
                  >
                    {active
                      ? "查看进行中的申请"
                      : owner === role
                        ? `使用一次${card.minutes > 0 ? ` · ${card.minutes} 分钟` : ""}`
                        : `等${roleName(owner)}来使用`}
                  </button>
                ) : (
                  <div className="used-stamp">
                    {card.remaining === 0 ? "偏爱已兑现 ♡" : "这张卡已过期"}
                  </div>
                )}
                {active && (
                  <p className="reserved-note">
                    其中 1 次已预留，完成后才扣减；本卡暂不重复申请。
                  </p>
                )}
              </div>
            </article>
          </div>
          <div className="deck-controls">
            <button
              aria-label="上一张卡"
              disabled={cards.length <= 1}
              onClick={() => move(-1)}
            >
              <ChevronLeft size={18} />
            </button>
            <div className="deck-dots">
              {cards.length <= 10 ? (
                cards.map((c, i) => (
                  <button
                    key={c.id}
                    aria-label={`查看${c.title}`}
                    aria-current={i === selected ? "true" : undefined}
                    className={i === selected ? "active" : ""}
                    onClick={() => setIndex(i)}
                  />
                ))
              ) : (
                <span>
                  {selected + 1} / {cards.length}
                </span>
              )}
            </div>
            <button
              aria-label="下一张卡"
              disabled={cards.length <= 1}
              onClick={() => move(1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="mini-tickets">
            {cards
              .filter((c) => c.id !== card.id)
              .map((c) => (
                <button
                  key={c.id}
                  className={`mini-ticket color-${c.color}`}
                  onClick={() =>
                    setIndex(cards.findIndex((item) => item.id === c.id))
                  }
                >
                  <CardArt role={owner} art={c.art} />
                  <span>
                    <b>{c.title}</b>
                    <small>
                      {c.remaining} 次
                      {c.minutes ? ` · ${c.remaining * c.minutes} 分钟` : ""}
                    </small>
                  </span>
                </button>
              ))}
          </div>
        </>
      ) : (
        <div className="empty-state wallet-empty">
          <Ticket size={36} />
          <h3>
            {tab === "used" ? "每一份偏爱，都还在" : "给对方发一张小特权"}
          </h3>
          <p>
            {tab === "used"
              ? "用完或过期的卡片会收在这里。"
              : "揉揉头、免喷一次，或者你们的小约定。"}
          </p>
        </div>
      )}
      <button
        className="button secondary create-coupon"
        onClick={() => setPanel({ kind: "create-card" })}
      >
        <Plus size={20} /> 自定义卡片
      </button>
      <p className="wallet-caption">
        <Clock3 size={13} /> 先申请，再一起兑现；完成后才扣减权益
      </p>
    </>
  );
}
