"use client";
import { compressPhoto } from "@/lib/photo";
import { PlaceEditor } from "./place-editor";
import { LifestylePanels } from "./lifestyle-panels";
import { CouponFlowPanels, RequestCoupon } from "./coupon-flow";
import { TimeZoneSettings } from "./time-zone";
import type { UseKind } from "@/lib/coupon-flow";
import type { Place } from "@/lib/lifestyle";
import { useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  Heart,
  ImagePlus,
  LoaderCircle,
  LogOut,
  Plus,
  Pin,
  Trash2,
  ShieldCheck,
  X,
  Bell,
  Pencil,
  Download,
  Info,
} from "lucide-react";
import {
  activities,
  cardTemplates,
  daysUntil,
  moodEmoji,
  moods,
  otherRole,
  roleName,
  themes,
  themeEmoji,
  today,
  type Coupon,
  type DiaryEvent,
  type Role,
} from "@/lib/domain";
import { useKingdom } from "./context";
import { CardArt, Loo, Sprite } from "./art";
import { Sheet } from "./sheet";
import { Countdown } from "./home";
import { api } from "./kingdom";

export function Login({
  requiresCode,
  onLogin,
}: {
  requiresCode: boolean;
  onLogin: (role: Role, code: string) => Promise<void>;
}) {
  const [role, setRole] = useState<Role>("blue");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="welcome">
      <img src="/art/home.webp" alt="欢迎回到蓝Loo和红Loo的小窝" />
      <div className="welcome-card">
        <span className="eyebrow">WELCOME HOME</span>
        <h2>欢迎回到我们的小窝</h2>
        <p>外面的世界再大，这里只有我们两个。</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await onLogin(role, code);
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset className="identity-options">
            <legend>今天，是哪只Loo回家啦？</legend>
            {(["blue", "red"] as Role[]).map((person) => (
              <button
                key={person}
                type="button"
                className={`${person} ${role === person ? "selected" : ""}`}
                aria-pressed={role === person}
                onClick={() => setRole(person)}
              >
                <Loo role={person} activity={1} />
                <b>我是{roleName(person)}</b>
                {role === person && <Check size={16} />}
              </button>
            ))}
          </fieldset>
          {requiresCode && (
            <label className="field">
              小窝口令
              <input
                type="password"
                autoComplete="current-password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                placeholder="只有你知道的专属口令"
                maxLength={200}
              />
            </label>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className={`button primary ${role}`} disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <Heart size={18} />
            )}{" "}
            进入小窝
          </button>
          {!requiresCode && (
            <small className="local-caption">
              本地体验 · 选择身份就可以开始
            </small>
          )}
        </form>
      </div>
    </section>
  );
}
function StatusPanel() {
  const { state, role, mutate, busy, setPanel, toast } = useKingdom();
  const [activity, setActivity] = useState(state.profiles[role].activity);
  const [mood, setMood] = useState(state.profiles[role].mood);
  const [note, setNote] = useState(state.profiles[role].note);
  return (
    <Sheet
      title={`${roleName(role)}现在怎么样？`}
      onClose={() => setPanel(null)}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await mutate({ type: "profile", activity, mood, note })) {
            toast("状态已更新，对方的小窝也会收到 ♡");
            setPanel(null);
          }
        }}
      >
        <h3 className="field-title">正在做什么</h3>
        <div className="activity-grid">
          {activities.map((name, i) => (
            <button
              key={name}
              type="button"
              aria-pressed={activity === i}
              className={`activity-option ${activity === i ? `selected ${role}` : ""}`}
              onClick={() => setActivity(i)}
            >
              <Loo role={role} activity={i} />
              <b>{name}</b>
              {activity === i && <Check className="selected-check" size={18} />}
            </button>
          ))}
        </div>
        <h3 className="field-title">此刻心情</h3>
        <div className="mood-options">
          {moods.map((name, i) => (
            <button
              type="button"
              key={name}
              aria-pressed={mood === i}
              className={mood === i ? "selected" : ""}
              onClick={() => setMood(i)}
            >
              <span>{moodEmoji[i]}</span>
              <b>{name}</b>
            </button>
          ))}
        </div>
        <label className="field">
          给对方留句话
          <input
            maxLength={120}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="今天也想和你说点什么…"
          />
        </label>
        <button disabled={busy} className={`button primary ${role}`}>
          {busy ? "正在更新…" : "更新状态"}
        </button>
        <p className="form-hint">对方的小窝会同步更新</p>
      </form>
    </Sheet>
  );
}
function EventForm({ event }: { event?: DiaryEvent }) {
  const { state, role, mutate, busy, setPanel, toast } = useKingdom();
  const [travelPlaces, setTravelPlaces] = useState<Place[]>(
    state.trips.find((t) => t.eventId === event?.id)?.places || [],
  );
  const [theme, setTheme] = useState(event?.theme ?? 4);
  const [title, setTitle] = useState(event?.title ?? "");
  const [date, setDate] = useState(event?.date ?? today(state.timeZone));
  const [mood, setMood] = useState(event?.mood ?? 0);
  const [note, setNote] = useState(event?.note ?? "");
  const [countdown, setCountdown] = useState(event?.countdown ?? false);
  const [annual, setAnnual] = useState(event?.annual ?? false);
  const [photoId, setPhotoId] = useState<string | null>(event?.photoId ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (uploading) return;
    if (
      await mutate({
        type: "event.save",
        event: {
          id: event?.id,
          theme,
          title,
          date,
          mood,
          note,
          countdown,
          annual,
          photoId,
          ...(theme === 2 ? { travelPlaces } : {}),
        },
        expectedUpdatedAt: event?.updatedAt,
      })
    ) {
      setPanel(null);
      toast(event ? "这份回忆，已经更新啦" : "又为我们存下一件小美好 ♡");
    }
  };
  const draft: DiaryEvent = {
    id: "draft",
    theme,
    title: title || "下一次小美好",
    date,
    mood,
    note,
    photoId,
    countdown,
    annual,
    author: role,
    createdAt: "",
    updatedAt: "",
  };
  return (
    <Sheet
      title={event ? "编辑我们的故事" : "记一件Loo国大事"}
      onClose={() => {
        if (!uploading) setPanel(null);
      }}
      className="event-form-sheet"
    >
      <form onSubmit={save}>
        <h3 className="field-title">选一个小主题</h3>
        <div className="theme-options">
          {themes.map((name, i) => (
            <button
              type="button"
              key={name}
              className={theme === i ? "selected" : ""}
              aria-pressed={theme === i}
              onClick={() => {
                setTheme(i);
                if (!title)
                  setTitle(
                    [
                      "我们的纪念日",
                      "生日快乐呀",
                      "一起去看海",
                      "回国倒计时",
                      "今天也是大厨Loo",
                      "",
                    ][i],
                  );
              }}
            >
              <span>{themeEmoji[i]}</span>
              {name}
            </button>
          ))}
        </div>
        <label className="field">
          事件名称
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={60}
            placeholder="为这一天，起个可爱的名字"
            required
          />
        </label>
        <label className="field date-field">
          日期
          <input
            aria-label="事件日期"
            type="date"
            min="1900-01-01"
            max="2200-12-31"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              if (e.target.value > today(state.timeZone)) setCountdown(true);
            }}
            required
          />
        </label>
        <label className="toggle-row">
          <span>
            <b>设为未来倒计时</b>
            <small>在小窝里，期待一起到来的日子</small>
          </span>
          <input
            type="checkbox"
            checked={countdown}
            onChange={(e) => setCountdown(e.target.checked)}
          />
          <i />
        </label>
        {(theme === 0 || theme === 1 || annual) && (
          <label className="toggle-row">
            <span>
              <b>每年都要纪念</b>
              <small>每年自动期待下一个纪念日</small>
            </span>
            <input
              type="checkbox"
              checked={annual}
              onChange={(e) => setAnnual(e.target.checked)}
            />
            <i />
          </label>
        )}
        {theme === 2 && (
          <>
            <PlaceEditor value={travelPlaces} onChange={setTravelPlaces} />
            <p className="inline-note">
              地点和旅行计划会一起同步到「足迹」，可以在那里继续安排路线。
            </p>
          </>
        )}
        <label className="field mood-field">
          这一天的心情
          <select
            value={mood}
            onChange={(e) => setMood(Number(e.target.value))}
          >
            {moods.map((name, i) => (
              <option value={i} key={name}>
                {moodEmoji[i]} {name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          想记住的话
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="再小的事情，和你一起就很特别…"
          />
        </label>
        <div className="field">
          <span>
            照片 <small>（可选）</small>
          </span>
          <div className="photo-row">
            {photoId ? (
              <div className="photo-preview">
                <img src={`/api/photos/${photoId}`} alt="待保存的日记照片" />
                <button
                  type="button"
                  aria-label="移除照片"
                  onClick={() => setPhotoId(null)}
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={uploading}
                className="photo-upload"
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <LoaderCircle className="spin" />
                ) : (
                  <ImagePlus size={27} />
                )}
                <span>{uploading ? "照片搬运中…" : "添加照片"}</span>
              </button>
            )}
            <Sprite sheet="events" index={theme} className="form-event-art" />
          </div>
          <input
            ref={fileRef}
            className="visually-hidden"
            aria-label="上传照片"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploading(true);
              setError("");
              try {
                const blob = await compressPhoto(file);
                const form = new FormData();
                form.append("photo", blob, "memory.jpg");
                const result = await api<{ id: string }>("/api/photos", {
                  method: "POST",
                  body: form,
                });
                setPhotoId(result.id);
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setUploading(false);
                e.target.value = "";
              }
            }}
          />
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {countdown &&
          date &&
          !Number.isNaN(daysUntil(draft, today(state.timeZone))) && (
            <Countdown compact event={draft} />
          )}
        <button className="button primary coral" disabled={busy || uploading}>
          {busy ? "正在收藏…" : "存进我们的故事"}
        </button>
      </form>
    </Sheet>
  );
}
function EventDetail({ initial }: { initial: DiaryEvent }) {
  const { state, setPanel, mutate, busy, toast, openTrip } = useKingdom();
  const [deleting, setDeleting] = useState(false);
  const event = state.events.find((e) => e.id === initial.id);
  if (!event)
    return (
      <Sheet title="这条记录已被移走" onClose={() => setPanel(null)}>
        <p>对方可能已经删除了它。</p>
      </Sheet>
    );
  return (
    <Sheet title={event.title} onClose={() => setPanel(null)}>
      <div className="detail-meta">
        <span>
          {themeEmoji[event.theme]} {themes[event.theme]}
        </span>
        <time>{event.date.replaceAll("-", ".")}</time>
        <span>
          {moodEmoji[event.mood]} {moods[event.mood]}
        </span>
      </div>
      <div className="detail-art">
        {event.photoId ? (
          <img src={`/api/photos/${event.photoId}`} alt={event.title} />
        ) : (
          <Sprite sheet="events" index={event.theme} />
        )}
      </div>
      <p className="detail-note">
        {event.note || "没有很多话，但这一刻很值得。"}
      </p>
      <p className="form-hint">
        {roleName(event.author)} 记录{event.annual ? " · 每年纪念" : ""}
      </p>
      {event.countdown && (
        <button
          className="button secondary"
          disabled={busy}
          onClick={async () => {
            if (
              await mutate({
                type: "event.pin",
                id: state.pinnedEventId === event.id ? null : event.id,
              })
            )
              toast(
                state.pinnedEventId === event.id
                  ? "已取消置顶"
                  : "小窝首页会优先显示这件事",
              );
          }}
        >
          <Pin size={18} />
          {state.pinnedEventId === event.id ? "取消首页置顶" : "放到小窝首页"}
        </button>
      )}
      {event.theme === 2 && (
        <button
          className="button secondary"
          disabled={busy}
          onClick={async () => {
            const linked = state.trips.find((t) => t.eventId === event.id);
            if (linked) openTrip(linked.id);
            else {
              const next = await mutate({
                type: "trip.from-event",
                eventId: event.id,
              });
              const trip = next?.trips.find((t) => t.eventId === event.id);
              if (trip) openTrip(trip.id);
            }
          }}
        >
          在足迹地图中查看旅行计划
        </button>
      )}
      <div className="detail-actions">
        <button
          className="button primary coral"
          onClick={() => setPanel({ kind: "event", event })}
        >
          <Pencil size={17} />
          编辑记录
        </button>
        <button
          className="icon-button delete-button"
          aria-label="删除记录"
          onClick={() => setDeleting(true)}
        >
          <Trash2 size={19} />
        </button>
      </div>
      {deleting && (
        <div className="inline-confirm">
          <p>确定删除这份记录吗？两个人的小窝都会移除。</p>
          <button
            disabled={busy}
            onClick={async () => {
              if (await mutate({ type: "event.delete", id: event.id })) {
                setPanel(null);
                toast("记录已删除");
              }
            }}
          >
            确认删除
          </button>
          <button onClick={() => setDeleting(false)}>先留着</button>
        </div>
      )}
    </Sheet>
  );
}
function CardForm() {
  const { role, mutate, busy, setPanel, toast, state } = useKingdom();
  const [template, setTemplate] = useState(0);
  const [title, setTitle] = useState<string>(cardTemplates[0].title);
  const [description, setDescription] = useState<string>(
    cardTemplates[0].description,
  );
  const owner = otherRole(role);
  const [count, setCount] = useState(3);
  const [minutes, setMinutes] = useState(15);
  const [kind, setKind] = useState<UseKind>("timed");
  const [benefit, setBenefit] = useState<string>(cardTemplates[0].benefit);
  const [color, setColor] = useState<"blue" | "coral" | "lavender" | "gold">(
    "blue",
  );
  const [expires, setExpires] = useState("");
  const requestId = useRef(crypto.randomUUID());
  return (
    <Sheet title="发一张专属小特权" onClose={() => setPanel(null)}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await mutate({
              type: "coupon.create",
              requestId: requestId.current,
              coupon: {
                title,
                description,
                owner,
                count,
                minutes,
                useKind: kind,
                benefit,
                art: template,
                color,
                expires,
              },
            })
          ) {
            setPanel(null);
            toast(`给${roleName(owner)}的小特权已经放进卡包 ♡`);
          }
        }}
      >
        <h3 className="field-title">从一张可爱的卡片开始</h3>
        <div className="card-template-grid">
          {cardTemplates.map((t, i) => (
            <button
              type="button"
              key={t.title}
              className={template === i ? "selected" : ""}
              onClick={() => {
                setTemplate(i);
                setTitle(t.title);
                setDescription(t.description);
                setCount(t.count);
                setMinutes(t.minutes);
                setKind(t.minutes > 0 ? "timed" : i >= 2 ? "goods" : "instant");
                setBenefit(t.benefit);
                setColor(t.color);
              }}
            >
              <CardArt role={owner} art={i} />
              <b>{t.title}</b>
            </button>
          ))}
        </div>
        <label className="field">
          卡片名称
          <input
            required
            maxLength={40}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="field">
          写一句偏爱
          <input
            maxLength={120}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="field owner-field">
          <span>送给谁？</span>
          <p className="coupon-recipient">♡ {roleName(owner)}专用</p>
          <small>这份偏爱只送给对方，由对方申请使用、你来接受。</small>
        </div>
        <label className="field">
          兑现方式
          <select
            aria-label="兑现方式"
            value={kind}
            onChange={(e) => {
              const v = e.target.value as UseKind;
              setKind(v);
              setMinutes(v === "timed" ? 15 : 0);
            }}
          >
            <option value="timed">计时陪伴 · 接受后开始计时</option>
            <option value="instant">一次性特权 · 接受即完成</option>
            <option value="goods">实物礼物 · 记录后双方确认</option>
          </select>
        </label>
        <div className="two-fields">
          <label className="field">
            总次数
            <input
              type="number"
              required
              min={1}
              max={999}
              value={count || ""}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </label>
          <label className="field">
            每次分钟数
            <input
              type="number"
              required
              min={kind === "timed" ? 1 : 0}
              disabled={kind !== "timed"}
              max={1440}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            />
          </label>
        </div>
        <p className="form-hint inline-hint">
          {minutes > 0
            ? `总共 ${count * minutes} 分钟，按次兑换。`
            : kind === "goods"
              ? "实物记录由一方填写，另一方确认收好后扣减。"
              : "对方接受申请后扣除 1 次。"}
        </p>
        <label className="field">
          兑换内容
          <input
            maxLength={120}
            value={benefit}
            onChange={(e) => setBenefit(e.target.value)}
            placeholder="例如：一只猫咪 / 1g 小金豆"
          />
        </label>
        <label className="field">
          有效期 <small>（选填）</small>
          <input
            type="date"
            min={today(state.timeZone)}
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
          />
        </label>
        <fieldset className="field">
          <legend>卡面颜色</legend>
          <div className="color-options">
            {(
              [
                { value: "blue", name: "晴空蓝" },
                { value: "coral", name: "珊瑚红" },
                { value: "lavender", name: "软芋紫" },
                { value: "gold", name: "奶油黄" },
              ] as const
            ).map((c) => (
              <button
                key={c.value}
                type="button"
                aria-label={c.name}
                aria-pressed={color === c.value}
                className={`color-${c.value}`}
                onClick={() => setColor(c.value)}
              >
                {color === c.value && <Check size={18} />}
              </button>
            ))}
          </div>
        </fieldset>
        <button className="button primary coral" disabled={busy}>
          <Plus size={18} />
          {busy ? "正在放进卡包…" : "把偏爱放进卡包"}
        </button>
      </form>
    </Sheet>
  );
}
function Redeem({ initial }: { initial: Coupon }) {
  return <RequestCoupon initial={initial} />;
}
function Settings({
  local,
  onLogout,
}: {
  local: boolean;
  onLogout: () => Promise<void>;
}) {
  const { state, role, setPanel, mutate, busy, toast } = useKingdom();
  const [clearing, setClearing] = useState(false);
  return (
    <Sheet title="我们的小窝" onClose={() => setPanel(null)}>
      <div className="profile-summary">
        <Loo role={role} activity={1} />
        <div>
          <h3>你好呀，{roleName(role)}</h3>
          <p>这里，永远有人等你回家。</p>
          <span>
            <ShieldCheck size={14} />
            {local ? "本地体验" : "私密双人空间"}
          </span>
        </div>
      </div>
      <div className="settings-note">
        <b>
          {local ? "数据保存在这台电脑的服务端" : "两个人，一份共享的小日常"}
        </b>
        <p>
          {local
            ? "当前可在本机体验完整功能。云端部署后，两台手机即可通过同一个网址使用。"
            : "双方的状态、日记和卡片会自动同步；口令只属于你们。"}
        </p>
        <small>纪念日时区：{state.timeZone}</small>
      </div>
      <TimeZoneSettings />
      <button
        className="settings-row"
        onClick={() => setPanel({ kind: "inbox" })}
      >
        <Bell size={19} />
        收到的小心意
        <ArrowRight size={17} />
      </button>
      <button
        className="settings-row"
        onClick={() => {
          const blob = new Blob([JSON.stringify(state, null, 2)], {
            type: "application/json",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `loo-kingdom-${today(state.timeZone)}.json`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          toast("已导出文字记录；照片需单独保存");
        }}
      >
        <Download size={19} />
        导出文字记录
        <ArrowRight size={17} />
      </button>
      {state.demo && (
        <div className="demo-box">
          <b>现在看到的是示例小窝</b>
          <p>
            示例日记和卡片可以直接体验，也可以清空后开始你们自己的故事。后来添加的内容也会一起清空。
          </p>
          {!clearing ? (
            <button onClick={() => setClearing(true)}>
              清空示例，开始我们的故事
            </button>
          ) : (
            <div className="inline-confirm">
              <p>确认清空当前全部日记、卡片和兑换记录？这个操作无法撤销。</p>
              <button
                disabled={busy}
                onClick={async () => {
                  if (await mutate({ type: "demo.clear" })) {
                    toast("小窝已经收拾好，开始新的故事吧");
                    setPanel(null);
                  }
                }}
              >
                确认清空
              </button>
              <button onClick={() => setClearing(false)}>取消</button>
            </div>
          )}
        </div>
      )}
      <button className="button secondary" onClick={() => void onLogout()}>
        <LogOut size={17} />
        退出当前身份
      </button>
      <p className="form-hint">Loo国生活 · v1.0 · 只属于我们俩 ♡</p>
    </Sheet>
  );
}
function Inbox() {
  const { state, role, setPanel, mutate, busy, displayTimeZone } = useKingdom();
  const items = state.interactions.filter((i) => i.to === role);
  const unread = items.filter((i) => !i.seen);
  return (
    <Sheet title="收到的小心意" onClose={() => setPanel(null)}>
      {items.length ? (
        <>
          <p className="form-hint">小小的动作，也是想你的信号。</p>
          {unread.length > 0 && (
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                void mutate({
                  type: "interactions.read",
                  ids: unread.map((i) => i.id),
                })
              }
            >
              收下 {unread.length} 份心意 ♡
            </button>
          )}
          <div className="inbox-list">
            {items.map((i) => (
              <article
                key={i.id}
                className={`inbox-item ${i.seen ? "" : "unread"}`}
              >
                <span>
                  {i.kind === "pat" ? "👋" : i.kind === "hug" ? "💗" : "👉"}
                </span>
                <div>
                  <b>
                    {roleName(i.from)}
                    {i.kind === "pat"
                      ? "摸了摸你的头"
                      : i.kind === "hug"
                        ? "给了你一个抱抱"
                        : "戳了戳你"}
                  </b>
                  <time>
                    {new Intl.DateTimeFormat("zh-CN", {
                      timeZone: displayTimeZone,
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(i.createdAt))}
                  </time>
                </div>
                {!i.seen && <i />}
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state">
          <Heart size={36} />
          <h3>这里会收到对方的小心意</h3>
          <p>先去给对方一个抱抱吧。</p>
        </div>
      )}
    </Sheet>
  );
}
export function Panels({
  local,
  onLogout,
}: {
  local: boolean;
  onLogout: () => Promise<void>;
}) {
  const { panel, setPanel, state, role, displayTimeZone } = useKingdom();
  if (!panel) return null;
  if (panel.kind === "status") return <StatusPanel />;
  if (panel.kind === "event")
    return <EventForm key={panel.event?.id || "new"} event={panel.event} />;
  if (panel.kind === "event-detail")
    return <EventDetail initial={panel.event} />;
  if (panel.kind === "create-card") return <CardForm />;
  if (panel.kind === "redeem") return <Redeem initial={panel.coupon} />;
  if (panel.kind === "settings")
    return <Settings local={local} onLogout={onLogout} />;
  if (panel.kind === "inbox") return <Inbox />;
  if (panel.kind === "partner") {
    const partner = otherRole(role);
    const profile = state.profiles[partner];
    return (
      <Sheet
        title={`${roleName(partner)}的小状态`}
        onClose={() => setPanel(null)}
      >
        <Loo
          role={partner}
          activity={profile.activity}
          className="partner-art"
        />
        <div className="partner-detail">
          <h3>
            {activities[profile.activity]} · {moodEmoji[profile.mood]}{" "}
            {moods[profile.mood]}
          </h3>
          <p>{profile.note || "今天也很想你 ♡"}</p>
          <small>
            {new Intl.DateTimeFormat("zh-CN", {
              timeZone: displayTimeZone,
              dateStyle: "short",
              timeStyle: "short",
            }).format(new Date(profile.updatedAt))}{" "}
            更新
          </small>
        </div>
        <button className="button primary coral" onClick={() => setPanel(null)}>
          知道啦，给你比心 ♡
        </button>
      </Sheet>
    );
  }
  return (
    <>
      <LifestylePanels />
      <CouponFlowPanels />
    </>
  );
}
