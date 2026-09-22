"use client";
import { useState, type FormEvent } from "react";
import { Heart, ExternalLink, ImagePlus, X } from "lucide-react";
import { useKingdom } from "./context";
import { Sheet } from "./sheet";
import { api } from "./kingdom";
import { FoodArt } from "./lifestyle-pages";
import { PlaceEditor } from "./place-editor";
import { TripMap } from "./trip-map";
import { cuisines, type Recipe, type Trip, type Place } from "@/lib/lifestyle";
import { today } from "@/lib/domain";
import { compressPhoto } from "@/lib/photo";
import type { RecipeDraft } from "@/lib/recipe-import";

export function PhotoPicker({
  value,
  onChange,
  onBusy,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  onBusy: (value: boolean) => void;
}) {
  const [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="field">
      <span>留张照片（可选）</span>
      {value ? (
        <div className="life-photo-preview">
          <img src={`/api/photos/${value}`} alt="待保存的照片" />
          <button
            type="button"
            className="mini-action"
            aria-label="移除照片"
            onClick={() => onChange(null)}
          >
            <X size={17} />
          </button>
        </div>
      ) : (
        <label className="life-photo-upload">
          <ImagePlus size={22} />
          {loading ? "照片搬运中…" : "选一张照片，把这刻留下"}
          <input
            aria-label="上传照片"
            type="file"
            accept="image/*"
            disabled={loading}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setLoading(true);
              onBusy(true);
              setError("");
              try {
                const form = new FormData();
                form.append("photo", await compressPhoto(file), "memory.jpg");
                onChange(
                  (
                    await api<{ id: string }>("/api/photos", {
                      method: "POST",
                      body: form,
                    })
                  ).id,
                );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setLoading(false);
                onBusy(false);
              }
            }}
          />
        </label>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
function RecipeForm({ initial: supplied }: { initial?: Recipe }) {
  const [initial] = useState(supplied);
  const { setPanel, mutate, busy, toast } = useKingdom();
  const [id] = useState(() => initial?.id || crypto.randomUUID());
  const [title, setTitle] = useState(initial?.title || ""),
    [cuisine, setCuisine] = useState(initial?.cuisine ?? 0),
    [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl || ""),
    [note, setNote] = useState(initial?.note || ""),
    [ingredients, setIngredients] = useState(initial?.ingredients || ""),
    [steps, setSteps] = useState(initial?.steps || ""),
    [favorite, setFavorite] = useState(initial?.favorite ?? true),
    [enqueue, setEnqueue] = useState(!initial),
    [photoId, setPhotoId] = useState<string | null>(initial?.photoId || null),
    [uploading, setUploading] = useState(false),
    [paste, setPaste] = useState(""),
    [importing, setImporting] = useState(false),
    [notice, setNotice] = useState("");
  const locked = busy || uploading || importing;
  async function save(e: FormEvent) {
    e.preventDefault();
    if (locked) return;
    if (
      await mutate({
        type: "recipe.save",
        recipe: {
          id,
          title,
          cuisine,
          sourceUrl,
          note,
          ingredients,
          steps,
          favorite,
          photoId,
        },
        expectedUpdatedAt: initial?.updatedAt,
        addToWaitlist: enqueue,
      })
    ) {
      setPanel(null);
      toast(enqueue ? "美味排好队，等大厨Loo开工 ♡" : "这道心头好，收进菜谱啦");
    }
  }
  return (
    <Sheet
      title={initial ? "给菜谱加点爱" : "收一道想和你吃的菜"}
      onClose={() => {
        if (!locked) setPanel(null);
      }}
    >
      <form onSubmit={save}>
        <div className="import-box">
          <label className="field">
            小红书链接 / 分享文案
            <textarea
              aria-label="小红书分享内容"
              rows={3}
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              maxLength={12000}
              placeholder="把小红书的分享链接粘在这里，也可以连文案一起粘贴…"
            />
          </label>
          <button
            type="button"
            className="button secondary"
            disabled={locked || !paste.trim()}
            onClick={async () => {
              setImporting(true);
              setNotice("");
              try {
                const draft = await api<RecipeDraft>("/api/recipes/import", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ text: paste }),
                });
                setSourceUrl(draft.sourceUrl);
                if (draft.title) setTitle(draft.title);
                setCuisine(draft.cuisine);
                if (draft.note) setNote(draft.note);
                if (draft.ingredients) setIngredients(draft.ingredients);
                if (draft.steps) setSteps(draft.steps);
                setNotice(draft.notice);
              } catch (e) {
                setNotice((e as Error).message);
              } finally {
                setImporting(false);
              }
            }}
          >
            {importing ? "Loo正在翻菜谱…" : "识别这道美味"}
          </button>
          <p className="micro-copy">
            读取公开内容后填写草稿，请核对菜名和菜系。遇到登录限制时，可补充分享文案或手动记录。
          </p>
          {notice && (
            <p className="inline-note" role="status">
              {notice}
            </p>
          )}
        </div>
        <label className="field">
          菜名
          <input
            required
            maxLength={80}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="比如：番茄牛腩，拌饭一级棒"
          />
        </label>
        <label className="field">
          菜系
          <select
            aria-label="菜系"
            value={cuisine}
            onChange={(e) => setCuisine(+e.target.value)}
          >
            {cuisines.map((c, i) => (
              <option value={i} key={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          原文链接（可选）
          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            maxLength={2048}
            placeholder="https://www.xiaohongshu.com/…"
          />
        </label>
        <label className="field">
          备菜小清单
          <textarea
            rows={3}
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            maxLength={4000}
            placeholder="食材和用量，一行一样"
          />
        </label>
        <label className="field">
          怎么做才好吃
          <textarea
            rows={4}
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            maxLength={6000}
            placeholder="写下步骤，下次大厨就不会手忙脚乱啦"
          />
        </label>
        <label className="field">
          小小备注
          <textarea
            rows={2}
            maxLength={2000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="少辣、多一点爱，香菜看心情…"
          />
        </label>
        <PhotoPicker
          value={photoId}
          onChange={setPhotoId}
          onBusy={setUploading}
        />
        <label className="simple-check">
          <input
            type="checkbox"
            checked={favorite}
            onChange={(e) => setFavorite(e.target.checked)}
          />
          收藏到我们的私房菜谱
        </label>
        <label className="simple-check">
          <input
            type="checkbox"
            checked={enqueue}
            onChange={(e) => setEnqueue(e.target.checked)}
          />
          加入想吃清单
        </label>
        <button className="button primary coral" disabled={locked}>
          {busy ? "正在收好…" : "收进Loo国菜谱"}
        </button>
      </form>
    </Sheet>
  );
}
function RecipeDetail({ id }: { id: string }) {
  const { state, setPanel, mutate, busy, toast } = useKingdom();
  const [deleting, setDeleting] = useState(false);
  const r = state.recipes.find((r) => r.id === id);
  if (!r)
    return (
      <Sheet title="这道菜已经移走啦" onClose={() => setPanel(null)}>
        <p>开饭回忆仍然会为你保留。</p>
      </Sheet>
    );
  const queued = state.mealWaitlist.some((w) => w.recipeId === id);
  return (
    <Sheet title={r.title} onClose={() => setPanel(null)}>
      <div className="recipe-detail-art">
        <FoodArt cuisine={r.cuisine} photoId={r.photoId} />
      </div>
      <div className="section-caption">
        <span>{cuisines[r.cuisine]}</span>
        <button
          className="text-action"
          disabled={busy}
          onClick={() =>
            void mutate({ type: "recipe.favorite", id, value: !r.favorite })
          }
        >
          <Heart size={18} fill={r.favorite ? "currentColor" : "none"} />
          {r.favorite ? "已收藏" : "收藏这道菜"}
        </button>
      </div>
      {r.note && <p className="detail-note">{r.note}</p>}
      <section className="recipe-instructions">
        <h3>备菜小清单</h3>
        <p>{r.ingredients || "还没写食材，编辑时补上就好。"}</p>
        <h3>大厨开工步骤</h3>
        <p>{r.steps || "步骤还空着，先去原文看看吧。"}</p>
      </section>
      {r.sourceUrl && (
        <a
          className="button secondary source-link"
          href={r.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink size={17} />
          去小红书看原菜谱
        </a>
      )}
      <button
        className="button primary coral"
        disabled={busy || queued}
        onClick={async () => {
          if (
            await mutate({
              type: "meal.enqueue",
              recipeId: id,
              requestId: crypto.randomUUID(),
            })
          )
            toast("已经在想吃清单排好队啦");
        }}
      >
        {queued ? "已经在想吃清单里啦" : "这道我想吃 ＋"}
      </button>
      <button
        className="button secondary"
        onClick={() => setPanel({ kind: "recipe-form", id })}
      >
        编辑这道菜
      </button>
      <DeletePrompt
        asking={deleting}
        setAsking={setDeleting}
        busy={busy}
        text="移除菜谱和对应的想吃项目？已经做过的开饭回忆会保留。"
        label="移除菜谱"
        onDelete={async () => {
          if (await mutate({ type: "recipe.delete", id })) {
            setPanel(null);
            toast("菜谱已移走，回忆还留着");
          }
        }}
      />
    </Sheet>
  );
}
function CookForm({ id }: { id: string }) {
  const { state, setPanel, mutate, busy, toast } = useKingdom();
  const [requestId] = useState(() => crypto.randomUUID()),
    [date, setDate] = useState(today(state.timeZone)),
    [note, setNote] = useState(""),
    [rating, setRating] = useState(5),
    [photoId, setPhotoId] = useState<string | null>(null),
    [uploading, setUploading] = useState(false);
  const wish = state.mealWaitlist.find((w) => w.id === id),
    recipe = state.recipes.find((r) => r.id === wish?.recipeId);
  return (
    <Sheet
      title="大厨Loo，开饭啦！"
      onClose={() => {
        if (!uploading && !busy) setPanel(null);
      }}
    >
      {recipe ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (uploading || busy) return;
            if (
              await mutate({
                type: "meal.cook",
                wishId: id,
                requestId,
                date,
                note,
                rating,
                photoId,
              })
            ) {
              setPanel(null);
              toast("吃饱饱，这顿已经存进开饭回忆 ♡");
            }
          }}
        >
          <h3 className="cook-dish">{recipe.title}</h3>
          <label className="field">
            开饭日期
            <input
              type="date"
              required
              min="1900-01-01"
              max={today(state.timeZone)}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="field">
            给大厨几颗小星星
            <select value={rating} onChange={(e) => setRating(+e.target.value)}>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {"★".repeat(n)} · {n} 星
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            这顿的小回忆
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              placeholder="好吃到光盘，下次还要点这道！"
            />
          </label>
          <PhotoPicker
            value={photoId}
            onChange={setPhotoId}
            onBusy={setUploading}
          />
          <p className="form-hint">
            记录后会从想吃清单移到开饭回忆，菜谱仍然保留。
          </p>
          <button className="button primary coral" disabled={busy || uploading}>
            做过啦，存下这顿美味
          </button>
        </form>
      ) : (
        <p>这道菜已经做过或移出清单啦。</p>
      )}
    </Sheet>
  );
}
function TripForm({ initial: supplied }: { initial?: Trip }) {
  const [initial] = useState(supplied);
  const { state, setPanel, mutate, busy, openTrip, toast } = useKingdom();
  const [id] = useState(() => initial?.id || crypto.randomUUID());
  const [title, setTitle] = useState(initial?.title || ""),
    [status, setStatus] = useState<"planned" | "visited">(
      initial?.status || "planned",
    ),
    [startDate, setStartDate] = useState(
      initial?.startDate || today(state.timeZone),
    ),
    [endDate, setEndDate] = useState(initial?.endDate || today(state.timeZone)),
    [note, setNote] = useState(initial?.note || ""),
    [places, setPlaces] = useState<Place[]>(initial?.places || []),
    [photoId, setPhotoId] = useState<string | null>(initial?.photoId || null),
    [uploading, setUploading] = useState(false);
  return (
    <Sheet
      title={initial ? "给旅程添一笔" : "牵着手，记一段旅程"}
      onClose={() => {
        if (!busy && !uploading) setPanel(null);
      }}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || uploading) return;
          if (
            await mutate({
              type: "trip.save",
              trip: {
                id,
                title,
                status,
                startDate,
                endDate,
                note,
                places,
                photoId,
                eventId: initial?.eventId || null,
              },
              expectedUpdatedAt: initial?.updatedAt,
            })
          ) {
            openTrip(id);
            toast("地图和大事件，都收好这段旅程啦 ♡");
          }
        }}
      >
        <label className="field">
          旅程名字
          <input
            required
            maxLength={60}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="比如：和你去京都吹晚风"
          />
        </label>
        <label className="field">
          这段旅行
          <select
            aria-label="这段旅行"
            value={status}
            onChange={(e) => setStatus(e.target.value as "planned" | "visited")}
          >
            <option value="planned">下一站计划 · 先攒期待</option>
            <option value="visited">已经一起去过 · 收好回忆</option>
          </select>
        </label>
        <div className="form-columns">
          <label className="field">
            出发日
            <input
              type="date"
              required
              min="1900-01-01"
              max={status === "visited" ? today(state.timeZone) : "2200-12-31"}
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (e.target.value > endDate) setEndDate(e.target.value);
              }}
            />
          </label>
          <label className="field">
            返程日
            <input
              type="date"
              required
              min={startDate}
              max={status === "visited" ? today(state.timeZone) : "2200-12-31"}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
        </div>
        <PlaceEditor value={places} onChange={setPlaces} />
        <label className="field">
          行程安排 / 旅行小故事
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={5}
            maxLength={2000}
            placeholder="Day 1：慢慢逛，认真吃。\n想去的地方、交通安排、住哪里，都写在这里。"
          />
        </label>
        <PhotoPicker
          value={photoId}
          onChange={setPhotoId}
          onBusy={setUploading}
        />
        <p className="inline-note">
          名称、出发日、故事和照片会同步到大事件。未来计划也会成为小窝里的旅行倒计时。
        </p>
        <button className="button primary coral" disabled={busy || uploading}>
          {busy ? "正在收藏…" : "把旅程放进我们的小世界"}
        </button>
      </form>
    </Sheet>
  );
}
function TripDetail({ id }: { id: string }) {
  const { state, setPanel, mutate, busy, openTrip, toast } = useKingdom();
  const [deleting, setDeleting] = useState(false);
  const t = state.trips.find((t) => t.id === id);
  if (!t)
    return (
      <Sheet title="这段旅程已被移走" onClose={() => setPanel(null)}>
        <p>回到地图看看其他的小故事吧。</p>
      </Sheet>
    );
  return (
    <Sheet title={t.title} onClose={() => setPanel(null)}>
      <div className="detail-meta">
        <span>{t.status === "planned" ? "♡ 下一站计划" : "✓ 一起去过"}</span>
        <time>
          {t.startDate} — {t.endDate}
        </time>
      </div>
      {t.photoId && (
        <img
          className="trip-cover"
          src={`/api/photos/${t.photoId}`}
          alt={t.title}
        />
      )}
      <TripMap trips={[t]} selectedId={t.id} />
      <ol className="itinerary">
        {t.places.map((p, i) => (
          <li key={p.id}>
            <span className="stop-number">{i + 1}</span>
            <div>
              <b>{p.name}</b>
              <small>{p.country || "国家待补充"}</small>
            </div>
          </li>
        ))}
      </ol>
      {!t.places.length && (
        <p className="inline-note">
          这段旅程还没有坐标，编辑时可以搜索地点、地图选点或填写经纬度。
        </p>
      )}
      <p className="detail-note">{t.note || "故事还在路上，先把期待留下。"}</p>
      <button
        className="button primary coral"
        onClick={() => setPanel({ kind: "trip-form", id })}
      >
        编辑行程和地点
      </button>
      {t.status === "planned" && (
        <>
          <button
            className="button secondary"
            disabled={busy || t.endDate > today(state.timeZone)}
            onClick={async () => {
              if (await mutate({ type: "trip.complete", id })) {
                openTrip(id);
                toast("这段期待，变成我们的共同足迹啦");
              }
            }}
          >
            旅行完成，收进共同足迹
          </button>
          {t.endDate > today(state.timeZone) && (
            <p className="form-hint">返程日到来后就可以标记完成啦。</p>
          )}
        </>
      )}
      {t.eventId && state.events.some((e) => e.id === t.eventId) && (
        <button
          className="button secondary"
          onClick={() =>
            setPanel({
              kind: "event-detail",
              event: state.events.find((e) => e.id === t.eventId)!,
            })
          }
        >
          看看相连的大事件
        </button>
      )}
      <DeletePrompt
        asking={deleting}
        setAsking={setDeleting}
        busy={busy}
        label="移除这段游记"
        text="移除这段游记和地图足迹？相连的大事件会保留，可以从大事件重新建立行程。"
        onDelete={async () => {
          if (await mutate({ type: "trip.delete", id })) {
            setPanel(null);
            toast("游记已移走，相连的大事件仍然保留");
          }
        }}
      />
    </Sheet>
  );
}
function DeletePrompt({
  asking,
  setAsking,
  busy,
  text,
  label,
  onDelete,
}: {
  asking: boolean;
  setAsking: (v: boolean) => void;
  busy: boolean;
  text: string;
  label: string;
  onDelete: () => Promise<void>;
}) {
  return asking ? (
    <div className="delete-confirm">
      <p>{text}</p>
      <div className="form-columns">
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => setAsking(false)}
        >
          再留一留
        </button>
        <button
          className="button primary coral"
          disabled={busy}
          onClick={() => void onDelete()}
        >
          确认移除
        </button>
      </div>
    </div>
  ) : (
    <button className="text-action danger-link" onClick={() => setAsking(true)}>
      {label}
    </button>
  );
}
export function LifestylePanels() {
  const { panel, state } = useKingdom();
  if (!panel) return null;
  switch (panel.kind) {
    case "recipe-form":
      return (
        <RecipeForm
          key={panel.id || "new"}
          initial={state.recipes.find((r) => r.id === panel.id)}
        />
      );
    case "recipe-detail":
      return <RecipeDetail id={panel.id} />;
    case "cook":
      return <CookForm key={panel.id} id={panel.id} />;
    case "trip-form":
      return (
        <TripForm
          key={panel.id || "new"}
          initial={state.trips.find((t) => t.id === panel.id)}
        />
      );
    case "trip-detail":
      return <TripDetail id={panel.id} />;
    default:
      return null;
  }
}
