import { load } from "cheerio";
import { isRecipeUrl } from "./lifestyle";
import { DomainError } from "./errors";

export type ImportFailure =
  | "restricted"
  | "not-found"
  | "timeout"
  | "network"
  | "unsupported-redirect"
  | "too-large"
  | "no-content";
export type RecipeDraft = {
  failureReason?: ImportFailure;
  sourceUrl: string;
  title: string;
  cuisine: number;
  note: string;
  ingredients: string;
  steps: string;
  status: "recognized" | "needs-input";
  notice: string;
};
export function extractRecipeLink(text: string) {
  const candidates = (
    text.match(/https?:\/\/[^\s<>"'，。；！）】)]+/g) || []
  ).map((url) => url.replace(/^http:/, "https:"));
  return candidates.find(isRecipeUrl) || "";
}
const dishNames = [
  "番茄炒蛋",
  "西红柿炒鸡蛋",
  "宫保鸡丁",
  "鱼香肉丝",
  "麻婆豆腐",
  "糖醋排骨",
  "红烧肉",
  "可乐鸡翅",
  "蒜香鸡翅",
  "番茄牛腩",
  "土豆炖牛肉",
  "水煮鱼",
  "酸菜鱼",
  "辣子鸡",
  "回锅肉",
  "小炒肉",
  "酸辣土豆丝",
  "麻辣香锅",
  "香煎三文鱼",
  "日式咖喱饭",
  "寿喜烧",
  "照烧鸡腿饭",
  "韩式拌饭",
  "韩式泡菜汤",
  "奶油蘑菇意面",
  "番茄肉酱意面",
  "提拉米苏",
  "巴斯克蛋糕",
  "芝士蛋糕",
  "戚风蛋糕",
  "蛋挞",
  "松饼",
  "牛排",
  "意大利面",
  "意面",
  "披萨",
  "寿司",
  "拉面",
  "蛋包饭",
  "咖喱饭",
  "饺子",
  "馄饨",
  "炒饭",
  "葱油拌面",
  "清蒸鲈鱼",
  "蒜蓉粉丝虾",
  "黄焖鸡",
  "地三鲜",
  "蚝油生菜",
  "排骨汤",
  "银耳羹",
  "凉拌黄瓜",
];
export function classifyCuisine(text: string) {
  const rules = [
    [
      /川菜|湘菜|四川|湖南|川湘|麻婆|麻辣|水煮鱼|酸菜鱼|辣子鸡|回锅肉|小炒肉|鱼香肉丝|宫保鸡丁/,
      1,
    ],
    [/蛋糕|蛋挞|甜品|烘焙|提拉米苏|巴斯克|曲奇|松饼|布丁|饼干/, 4],
    [/日韩|日式|韩式|寿司|寿喜|照烧|泡菜|韩餐|拉面|蛋包饭|咖喱饭|拌饭/, 2],
    [/西餐|西式|意面|意大利|牛排|披萨|焗饭|奶油蘑菇|pasta|steak|pizza/i, 3],
    [
      /家常|中餐|中式|炒蛋|炒鸡蛋|红烧|糖醋|鸡翅|牛腩|炖牛|土豆丝|饺子|馄饨|炒饭|蒸鲈鱼|蒜蓉|排骨汤|葱油|黄焖鸡|生菜|凉拌/,
      0,
    ],
  ] as const;
  return rules.find(([pattern]) => pattern.test(text))?.[1] ?? 5;
}
const clean = (text: string) =>
  text
    .replace(/\s+/g, " ")
    .replace(/\s*[-_|·]\s*小红书.*$/, "")
    .trim();
// Read serialized page data only. Never evaluate JavaScript from a note.
function readInitialNote(
  scripts: string[],
  sourceUrl: string,
): { title: string; description: string } | null {
  const noteId = new URL(sourceUrl).pathname.match(
    /\/(?:explore|discovery\/item)\/([a-zA-Z0-9]+)/,
  )?.[1];
  for (const script of scripts) {
    const match = /(?:window\.)?__INITIAL_STATE__\s*=\s*/.exec(script);
    if (!match) continue;
    const start = match.index + match[0].length;
    if (script[start] !== "{") continue;
    let depth = 0,
      quoted = false,
      escaped = false,
      end = -1;
    for (let i = start; i < script.length; i++) {
      const c = script[i];
      if (quoted) {
        if (escaped) escaped = false;
        else if (c === "\\") escaped = true;
        else if (c === '"') quoted = false;
      } else if (c === '"') quoted = true;
      else if (c === "{") depth++;
      else if (c === "}" && --depth === 0) {
        end = i + 1;
        break;
      }
    }
    if (end < 0) continue;
    try {
      // XHS serializes absent properties as undefined; preserve quoted strings verbatim.
      const json = script
        .slice(start, end)
        .replace(/"(?:\\.|[^"\\])*"|\bundefined\b/g, (token) =>
          token === "undefined" ? "null" : token,
        );
      const root = JSON.parse(json);
      const detail = root?.note?.noteDetailMap;
      if (!detail || typeof detail !== "object") continue;
      const key = noteId || root.note.firstNoteId;
      const entry = key
        ? detail[key]
        : Object.keys(detail).length === 1
          ? Object.values(detail)[0]
          : null;
      const note = entry?.note;
      if (
        note &&
        (typeof note.title === "string" || typeof note.desc === "string")
      )
        return {
          title: typeof note.title === "string" ? note.title : "",
          description: typeof note.desc === "string" ? note.desc : "",
        };
    } catch {
      /* Invalid page data is ignored; metadata and pasted text remain available. */
    }
  }
  return null;
}

export function parseRecipeContent(
  html: string,
  shareText: string,
  sourceUrl: string,
): RecipeDraft {
  const $ = load(html);
  const meta = (name: string) =>
    $(`meta[property="${name}"],meta[name="${name}"]`)
      .first()
      .attr("content") || "";
  let title = clean(meta("og:title") || $("title").text());
  let description = clean(meta("og:description") || meta("description"));
  const initialNote = readInitialNote(
    $("script")
      .toArray()
      .map((el) => $(el).text()),
    sourceUrl,
  );
  if (initialNote) {
    title = clean(initialNote.title) || title;
    description = initialNote.description.trim() || description;
  }
  let ingredients = "",
    steps = "";
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    try {
      const payload = JSON.parse($(el).text());
      const entries = Array.isArray(payload)
        ? payload
        : payload["@graph"] || [payload];
      const recipe = entries.find((e: Record<string, unknown>) =>
        [e["@type"]].flat().includes("Recipe"),
      );
      if (recipe) {
        title = clean(String(recipe.name || title));
        description = clean(String(recipe.description || description));
        if (Array.isArray(recipe.recipeIngredient))
          ingredients = recipe.recipeIngredient
            .map(String)
            .join("\n")
            .slice(0, 4000);
        if (Array.isArray(recipe.recipeInstructions))
          steps = recipe.recipeInstructions
            .map((s: string | { text?: string }) =>
              typeof s === "string" ? s : s.text || "",
            )
            .filter(Boolean)
            .join("\n")
            .slice(0, 6000);
      }
    } catch {
      /* Page scripts are data only; never evaluated. */
    }
  }
  if (
    /登录|安全验证|访问异常|验证码|小红书.*生活指南|^小红书(?:\s*[-_|·]|$)|页面不存在|404|验证中心|Access Denied/i.test(
      title,
    )
  )
    title = "";
  if (/登录|访问异常|验证码|安全验证|^小红书/.test(description))
    description = "";
  const pasted = shareText
    .replace(/https?:\/\/\S+/g, "")
    .replace(/复制.*(?:打开|查看).*$/s, "")
    .replace(/[,，]?\s*[A-Za-z0-9]{10,}\s*$/g, "")
    .replace(/\s*[-–]\s*小红书.*$/s, "")
    .trim();
  const content = [title, description, pasted].filter(Boolean).join("\n");
  const dish = dishNames.find((name) => content.includes(name));
  const recognizedTitle =
    dish ||
    title ||
    (pasted.length > 2
      ? pasted
          .split("\n")[0]
          .replace(/^\d+\s*/, "")
          .slice(0, 80)
      : "");
  const recognized = Boolean(recognizedTitle);
  return {
    sourceUrl,
    title: recognizedTitle.slice(0, 80),
    cuisine: classifyCuisine(content),
    note: description.slice(0, 2000),
    ingredients,
    steps,
    status: recognized ? "recognized" : "needs-input",
    notice: recognized
      ? "已根据公开内容或分享文案初步识别，菜名和菜系都可以改。"
      : "这条笔记暂时无法公开读取。粘贴小红书的分享文案后再识别，或直接补上菜名；原链接会保留。",
  };
}
export async function fetchRecipeDraft(
  input: string,
  fetcher: typeof fetch = fetch,
): Promise<RecipeDraft> {
  const link = extractRecipeLink(input);
  if (!link)
    throw new DomainError("请粘贴小红书笔记链接，或包含链接的分享文案");
  let url = link,
    html = "";
  let failureReason: ImportFailure | undefined;
  const deadline = AbortSignal.timeout(15000);
  try {
    for (let redirect = 0; redirect < 5; redirect++) {
      if (!isRecipeUrl(url)) {
        failureReason = "unsupported-redirect";
        break;
      }
      const response = await fetcher(url, {
        redirect: "manual",
        signal: deadline,
        headers: {
          "User-Agent": "LooKingdom/0.2 (personal recipe organizer)",
          Accept: "text/html",
          "Accept-Language": "zh-CN,zh;q=0.9",
        },
        cache: "no-store",
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          failureReason = "no-content";
          break;
        }
        url = new URL(location, url).href;
        if (redirect === 4) failureReason = "unsupported-redirect";
        continue;
      }
      if (
        !response.ok ||
        !(response.headers.get("content-type") || "").includes("text/html")
      ) {
        failureReason =
          response.status === 404 || response.status === 410
            ? "not-found"
            : [401, 403, 429, 461, 471].includes(response.status)
              ? "restricted"
              : "no-content";
        break;
      }
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let bytes = 0;
        try {
          while (true) {
            const result = await reader.read();
            if (result.done) break;
            bytes += result.value.byteLength;
            html += decoder.decode(result.value, { stream: true });
            if (bytes > 2_000_000) {
              html = "";
              failureReason = "too-large";
              break;
            }
          }
        } finally {
          await reader.cancel();
        }
      }
      break;
    }
  } catch {
    failureReason = deadline.aborted ? "timeout" : "network";
  }
  const draft = parseRecipeContent(html, input, isRecipeUrl(url) ? url : link);
  draft.sourceUrl = link;
  if (!failureReason && draft.status === "needs-input")
    failureReason =
      /登录|安全验证|访问异常|验证码|验证中心|Access Denied/i.test(html)
        ? "restricted"
        : "no-content";
  if (failureReason) {
    const reasons: Record<ImportFailure, string> = {
      restricted: "小红书暂未开放这条笔记的网页访问（可能需要登录或验证）。",
      "not-found": "这条笔记已失效或找不到了。",
      timeout: "小红书响应超时了。",
      network: "暂时连接不上小红书。",
      "unsupported-redirect": "分享链接跳转到了暂不支持的页面。",
      "too-large": "这条笔记的网页内容太大，暂时无法读取。",
      "no-content": "网页没有返回可读取的笔记内容。",
    };
    draft.failureReason = failureReason;
    draft.notice =
      reasons[failureReason] +
      (draft.status === "recognized"
        ? "已从你粘贴的分享文案整理菜名和菜系，请核对；未读取到完整做法。"
        : "试试粘贴 App「分享 → 复制链接」的完整文案，或补上菜名和做法，原链接会保留。");
  }
  return draft;
}
