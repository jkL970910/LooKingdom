import { requireRole, checkOrigin } from "@/lib/auth";
import { json, failure } from "@/lib/http";
import { DomainError } from "@/lib/domain";
import { z } from "zod";
import { cachedGeocode } from "@/lib/storage";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    await requireRole();
    const body = await request.text();
    if (body.length > 1000) throw new DomainError("地点名称太长啦", 413);
    const { query } = z
      .object({ query: z.string().trim().min(2, "至少输入两个字").max(120) })
      .parse(JSON.parse(body));
    const data = await cachedGeocode(query, async () => {
      const base =
        process.env.GEOCODING_BASE_URL ||
        "https://nominatim.openstreetmap.org/search";
      const url = new URL(base);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("q", query);
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("limit", "6");
      url.searchParams.set("accept-language", "zh-CN,en");
      const response = await fetch(url, {
        headers: {
          "User-Agent": `LooKingdom/0.2 (${process.env.APP_ORIGIN || "private couple travel diary"})`,
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok)
        throw new DomainError(
          "地点搜索暂时忙碌，可以在地图上选点或手动填写经纬度",
          502,
        );
      const rows = await response.json();
      if (!Array.isArray(rows))
        throw new DomainError("地图暂时没有返回地点", 502);
      const places = rows
        .map((r) => ({
          id: `osm-${r.osm_type}-${r.osm_id}`,
          name: String(r.name || r.display_name.split(",")[0]).slice(0, 120),
          displayName: String(r.display_name),
          lat: Number(r.lat),
          lng: Number(r.lon),
          countryCode: String(r.address?.country_code || "").toUpperCase(),
          country: String(r.address?.country || ""),
        }))
        .filter(
          (p) =>
            Number.isFinite(p.lat) &&
            Number.isFinite(p.lng) &&
            Math.abs(p.lat) <= 85 &&
            Math.abs(p.lng) <= 180,
        );
      return { places };
    });
    return json(data);
  } catch (e) {
    return failure(e);
  }
}
