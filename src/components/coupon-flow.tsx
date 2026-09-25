"use client";
import { useState } from "react";
import { Clock3, ChevronRight, Heart, PackageCheck } from "lucide-react";
import { useKingdom } from "./context";
import { Sheet } from "./sheet";
import { CardArt } from "./art";
import { PhotoPicker } from "./lifestyle-panels";
import { useClock } from "./time-zone";
import { couponCategory } from "@/lib/coupon-groups";
import { today, roleName, type Coupon } from "@/lib/domain";
import {
  activeUseFor,
  isActiveUse,
  useKind,
  useStatusLabel,
  type CouponUse,
  type ProductRecord,
} from "@/lib/coupon-flow";

function UseTimer({ use }: { use: CouponUse }) {
  const now = useClock();
  const left = Math.max(0, Math.ceil((Date.parse(use.endsAt!) - +now) / 1000));
  const minutes = Math.floor(left / 60),
    seconds = left % 60;
  return (
    <div className="use-timer">
      <Clock3 size={22} />
      <b aria-label="剩余使用时间">
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </b>
      <span>{left ? "正在把偏爱慢慢兑现" : "时间到啦，正在同步完成记录…"}</span>
      <small>本次 {use.minutes} 分钟 · 完成后扣除 1 次</small>
    </div>
  );
}
export function CouponActivity({ compact = false }: { compact?: boolean }) {
  const { state, setPanel } = useKingdom();
  const active = (state.couponUses || []).filter(isActiveUse);
  if (!active.length) return null;
  return (
    <section className="coupon-activity">
      <div className="section-caption">
        <h2>偏爱正在路上</h2>
        <span>{active.length} 份小约定</span>
      </div>
      {(compact ? active.slice(0, 2) : active).map((u) => (
        <button
          key={u.id}
          className={`use-activity-row owner-${u.owner}`}
          onClick={() => setPanel({ kind: "coupon-use", id: u.id })}
        >
          <Heart size={18} />
          <span>
            <b>
              {roleName(u.owner)}申请使用{u.title}
            </b>
            <small>
              {useStatusLabel[u.status]}
              {u.status === "pending"
                ? ` · 等${roleName(u.recipient)}点头`
                : u.kind === "timed"
                  ? ` · ${u.minutes} 分钟`
                  : ""}
            </small>
          </span>
          <ChevronRight size={17} />
        </button>
      ))}
    </section>
  );
}
export function RequestCoupon({ initial }: { initial: Coupon }) {
  const { state, role, setPanel, mutate, busy, toast } = useKingdom();
  const [requestId] = useState(() => crypto.randomUUID());
  const [selectedId, setSelectedId] = useState(initial.id);
  const variants = state.coupons.filter(c => couponCategory(c) === couponCategory(initial) && c.remaining > 0 && (!c.expires || c.expires >= today(state.timeZone)));
  const card = variants.find(c => c.id === selectedId) ?? variants[0];
  if (!card) return null;
  const active = activeUseFor(state, card.id),
    kind = useKind(card),
    valid =
      card.owner === role &&
      card.remaining > 0 &&
      (!card.expires || card.expires >= today(state.timeZone));
  return (
    <Sheet title={`申请使用${card.title}`} onClose={() => setPanel(null)}>
      <div className={`owner-badge ${card.owner}`}>
        {roleName(card.owner)}专用
      </div>
      <CardArt role={card.owner} art={card.art} className="redeem-art" />
      <div className="use-steps">
        <b>这次的小约定</b>
        <p>
          {kind === "timed"
            ? `对方接受 → 开始 ${card.minutes} 分钟计时 → 完成后扣除 1 次、${card.minutes} 分钟`
            : kind === "goods"
              ? "对方接受 → 记录产品、价格和照片 → 另一方确认收好 → 扣除 1 次"
              : "对方接受 → 兑现这次小特权 → 扣除 1 次"}
        </p>
        <small>
          剩余 {card.remaining} 次
          {card.minutes > 0
            ? ` · 共 ${card.remaining * card.minutes} 分钟`
            : ""}
          ；申请和等待期间不扣减。
        </small>
      </div>
      {variants.length > 0 && (
        <label className="field">
          选择要使用的卡片
          <select aria-label="选择要使用的卡片" value={card.id} disabled={!!active || busy} onChange={e => setSelectedId(e.target.value)}>
            {variants.map(c => <option key={c.id} value={c.id}>
              {useKind(c) === "timed" ? c.minutes + " 分钟" : (c.benefit || c.title)} · 剩余 {c.remaining} 张{c.expires ? " · " + c.expires + " 到期" : ""}
            </option>)}
          </select>
        </label>
      )}
      {active ? (
        <button
          className="button primary coral"
          onClick={() => setPanel({ kind: "coupon-use", id: active.id })}
        >
          查看这张卡的进行中申请
        </button>
      ) : (
        <button
          className={`button primary ${card.owner}`}
          disabled={busy || !valid}
          onClick={async () => {
            if (
              await mutate({ type: "coupon.request", id: card.id, requestId })
            ) {
              setPanel({ kind: "coupon-use", id: requestId });
              toast(
                `${roleName(card.owner)}申请使用${card.title}，等对方点头 ♡`,
              );
            }
          }}
        >
          {busy ? "正在送出申请…" : "发送使用申请"}
        </button>
      )}
      <p className="form-hint">双方的小窝和卡包都会显示这份申请。</p>
    </Sheet>
  );
}
function ProductView({ product }: { product: ProductRecord }) {
  return (
    <section className="product-memory">
      <h3>
        <PackageCheck size={19} />
        这次收好的偏爱
      </h3>
      {product.photoId && (
        <img src={`/api/photos/${product.photoId}`} alt={product.name} />
      )}
      <h4>{product.name}</h4>
      <dl>
        <dt>产品参数</dt>
        <dd>{product.parameters}</dd>
        <dt>购买 / 领养日期</dt>
        <dd>{product.date}</dd>
        <dt>实际金额</dt>
        <dd>
          {product.currency} {product.price.toFixed(2)}
        </dd>
      </dl>
      {product.note && <p>{product.note}</p>}
      <small>{roleName(product.recordedBy)}记录</small>
    </section>
  );
}
function UseDetail({ id }: { id: string }) {
  const { state, role, setPanel, mutate, busy, toast, displayTimeZone } =
    useKingdom();
  const u = state.couponUses.find((u) => u.id === id);
  const [action, setAction] = useState<"cancel" | "decline" | "return" | null>(
      null,
    ),
    [reason, setReason] = useState("");
  if (!u)
    return (
      <Sheet title="这份申请已移走" onClose={() => setPanel(null)}>
        <p>回卡包看看其他小特权吧。</p>
      </Sheet>
    );
  const format = (v: string) =>
    new Intl.DateTimeFormat("zh-CN", {
      timeZone: displayTimeZone,
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(v));
  return (
    <Sheet title={u.title} onClose={() => setPanel(null)}>
      <p className="use-party">
        {roleName(u.owner)}申请使用 · {roleName(u.recipient)}来兑现
      </p>
      <span className={`use-status status-${u.status}`}>
        {useStatusLabel[u.status]}
      </span>
      {u.status === "in_progress" ? (
        <UseTimer use={u} />
      ) : (
        <CardArt role={u.owner} art={u.art} className="use-detail-art" />
      )}
      <div className="use-timeline">
        <p>申请：{format(u.createdAt)}</p>
        {u.startedAt && <p>接受：{format(u.startedAt)}</p>}
        {u.endsAt && <p>预计结束：{format(u.endsAt)}</p>}
        {u.completedAt && <p>完成：{format(u.completedAt)}</p>}
      </div>
      {u.status === "pending" && (
        <>
          <p className="inline-note">
            {role === u.recipient
              ? `${roleName(u.owner)}想用这份小特权，你准备好了吗？`
              : `已经告诉${roleName(u.recipient)}啦，等待对方接受。`}
            这次权益已预留，还没有扣除。
          </p>
          {role === u.recipient ? (
            <>
              <button
                className="button primary coral"
                disabled={busy}
                onClick={async () => {
                  if (await mutate({ type: "coupon.accept", id }))
                    toast(
                      u.kind === "timed"
                        ? "开始计时，偏爱正在发生 ♡"
                        : u.kind === "goods"
                          ? "接受啦，一起准备兑现这份礼物"
                          : "这次的小特权已经兑现 ♡",
                    );
                }}
              >
                {u.kind === "timed" ? "接受申请，开始计时" : "接受使用申请"}
              </button>
              <button
                className="text-action danger-link"
                onClick={() => setAction("decline")}
              >
                这次先不了
              </button>
            </>
          ) : (
            <button
              className="button secondary"
              onClick={() => setAction("cancel")}
            >
              撤回这次申请
            </button>
          )}
        </>
      )}
      {["awaiting_fulfillment", "awaiting_confirmation"].includes(u.status) && (
        <>
          <p className="inline-note">
            {u.status === "awaiting_fulfillment"
              ? "约定接受啦。兑现后把产品参数、照片和实际金额记下来，再由另一位Loo核对。"
              : "记录已填好，等另一位Loo确认收好。这一步完成后才扣除权益。"}
          </p>
          {u.product && <ProductView product={u.product} />}
          <button
            className="button primary coral"
            onClick={() => setPanel({ kind: "coupon-product", id })}
          >
            {u.product ? "编辑兑现记录" : "填写兑现记录"}
          </button>
          {u.status === "awaiting_confirmation" &&
            u.product &&
            role !== u.product.recordedBy && (
              <>
                <button
                  className="button primary blue"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      await mutate({
                        type: "coupon.confirm-product",
                        id,
                        expectedUpdatedAt: u.updatedAt,
                      })
                    )
                      toast("收好啦，这份偏爱已经存进回顾 ♡");
                  }}
                >
                  确认收好，完成使用
                </button>
                <button
                  className="button secondary"
                  onClick={() => setAction("return")}
                >
                  请对方补充一下记录
                </button>
              </>
            )}
        </>
      )}
      {u.status === "completed" && (
        <>
          <p className="inline-note">
            已扣除 1 次{u.minutes > 0 ? `、${u.minutes} 分钟` : ""}
            。这份偏爱留在兑换回顾里啦。
            {u.confirmedBy && ` ${roleName(u.confirmedBy)}已确认收好。`}
          </p>
          {u.product && <ProductView product={u.product} />}
        </>
      )}
      {u.reason && <p className="inline-note">小备注：{u.reason}</p>}
      {["cancelled", "declined", "expired"].includes(u.status) && (
        <p className="form-hint">本次没有扣除次数或时长，权益已释放。</p>
      )}
      {isActiveUse(u) && u.status !== "pending" && (
        <button
          className="text-action danger-link"
          onClick={() => setAction("cancel")}
        >
          取消这次使用
        </button>
      )}
      {action && (
        <div className="use-cancel-box">
          <p>
            {action === "cancel"
              ? "确认取消这次使用？计时会结束，本次不扣次数和时长，取消记录会保留。"
              : action === "decline"
                ? "这次先不了，给对方留句话吧。"
                : "告诉对方还想补充哪些细节。"}
          </p>
          <label className="field">
            给对方的小备注
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
              rows={2}
            />
          </label>
          <div className="form-columns">
            <button
              className="button secondary"
              onClick={() => setAction(null)}
            >
              再想想
            </button>
            <button
              className="button primary coral"
              disabled={busy}
              onClick={async () => {
                const result = await mutate(
                  action === "cancel"
                    ? { type: "coupon.cancel", id, reason }
                    : action === "decline"
                      ? { type: "coupon.decline", id, reason }
                      : {
                          type: "coupon.return-product",
                          id,
                          reason,
                          expectedUpdatedAt: u.updatedAt,
                        },
                );
                if (result) {
                  setAction(null);
                  toast("已经告诉对方啦");
                }
              }}
            >
              确认
              {action === "cancel"
                ? "取消"
                : action === "decline"
                  ? "婉拒"
                  : "请补充"}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
function ProductForm({ id }: { id: string }) {
  const { state, setPanel, mutate, busy, toast } = useKingdom();
  const [initial] = useState(() => state.couponUses.find((u) => u.id === id));
  const [name, setName] = useState(initial?.product?.name || ""),
    [parameters, setParameters] = useState(initial?.product?.parameters || ""),
    [price, setPrice] = useState(
      initial?.product ? String(initial.product.price) : "",
    ),
    [currency, setCurrency] = useState<ProductRecord["currency"]>(
      initial?.product?.currency || "CAD",
    ),
    [date, setDate] = useState(initial?.product?.date || today(state.timeZone)),
    [photoId, setPhotoId] = useState<string | null>(
      initial?.product?.photoId || null,
    ),
    [note, setNote] = useState(initial?.product?.note || ""),
    [uploading, setUploading] = useState(false);
  if (!initial) return null;
  return (
    <Sheet
      title="把这份礼物记下来"
      onClose={() => {
        if (!busy && !uploading) setPanel({ kind: "coupon-use", id });
      }}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (uploading || busy) return;
          if (
            await mutate({
              type: "coupon.product",
              id,
              expectedUpdatedAt: initial.updatedAt,
              product: {
                name,
                parameters,
                price: Number(price),
                currency,
                date,
                photoId,
                note,
              },
            })
          ) {
            setPanel({ kind: "coupon-use", id });
            toast("记录存好啦，等另一位Loo确认收好");
          }
        }}
      >
        <label className="field">
          产品 / 猫咪名称
          <input
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              initial.art === 2 ? "新国民叫什么名字呀" : "例如：1g 小金豆"
            }
          />
        </label>
        <label className="field">
          产品参数
          <textarea
            required
            rows={4}
            maxLength={2000}
            value={parameters}
            onChange={(e) => setParameters(e.target.value)}
            placeholder={
              initial.art === 2
                ? "品种、生日、性别、领养来源、健康情况…"
                : "品牌、型号、重量、纯度、商家、证书编号…"
            }
          />
        </label>
        <div className="form-columns">
          <label className="field">
            实际金额
            <input
              type="number"
              required
              min="0"
              max="100000000"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
          <label className="field">
            币种
            <select
              aria-label="币种"
              value={currency}
              onChange={(e) =>
                setCurrency(e.target.value as ProductRecord["currency"])
              }
            >
              {["CAD", "CNY", "USD", "JPY", "EUR"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          购买 / 领养日期
          <input
            type="date"
            required
            min="1900-01-01"
            max={today(state.timeZone)}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <PhotoPicker
          value={photoId}
          onChange={setPhotoId}
          onBusy={setUploading}
        />
        <label className="field">
          想记住的话
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={2000}
          />
        </label>
        <p className="form-hint">
          金额 0
          可用于无偿领养或赠送；不会发起真实付款。另一位Loo确认后才完成使用。
        </p>
        <button className="button primary coral" disabled={busy || uploading}>
          保存记录，请对方确认
        </button>
      </form>
    </Sheet>
  );
}
export function CouponFlowPanels() {
  const { panel } = useKingdom();
  if (panel?.kind === "coupon-use")
    return <UseDetail key={panel.id} id={panel.id} />;
  if (panel?.kind === "coupon-product")
    return <ProductForm key={panel.id} id={panel.id} />;
  return null;
}
export function CouponUseHistory({ owner }: { owner: "blue" | "red" }) {
  const { state, setPanel, displayTimeZone } = useKingdom();
  const uses = state.couponUses.filter((u) => u.owner === owner);
  const legacy = state.redemptions.filter(
    (r) => r.owner === owner && !uses.some((u) => u.id === r.requestId),
  );
  return (
    <div className="use-history-list">
      {uses.map((u) => (
        <button
          className="use-history-row"
          key={u.id}
          onClick={() => setPanel({ kind: "coupon-use", id: u.id })}
        >
          <CardArt role={owner} art={u.art} />
          <span>
            <b>{u.title}</b>
            <small>
              {new Intl.DateTimeFormat("zh-CN", {
                timeZone: displayTimeZone,
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(u.createdAt))}
            </small>
            {u.product && (
              <small>
                {u.product.name} · {u.product.currency}{" "}
                {u.product.price.toFixed(2)}
              </small>
            )}
          </span>
          <em>{useStatusLabel[u.status]}</em>
        </button>
      ))}
      {legacy.map((r) => (
        <article className="history-row" key={r.id}>
          <div>
            <b>{r.title}</b>
            <p>使用 1 次{r.minutes ? ` · ${r.minutes} 分钟` : ""}</p>
            <small>
              {new Intl.DateTimeFormat("zh-CN", {
                timeZone: displayTimeZone,
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(r.createdAt))}
            </small>
          </div>
          <span className="record-check">此前已兑换</span>
        </article>
      ))}
      {!uses.length && !legacy.length && (
        <div className="empty-state">
          <Heart size={32} />
          <h3>每一份偏爱，都值得留下</h3>
          <p>申请、计时和礼物记录都会收在这里。</p>
        </div>
      )}
    </div>
  );
}
