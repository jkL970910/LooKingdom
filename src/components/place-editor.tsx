"use client";
import { useState } from "react";
import { ArrowUp, ArrowDown, X, Search, MapPin } from "lucide-react";
import type { Place, Trip } from "@/lib/lifestyle";
import { TripMap } from "./trip-map";
import { api } from "./kingdom";
export function PlaceEditor({
  value,
  onChange,
}: {
  value: Place[];
  onChange: (places: Place[]) => void;
}) {
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<(Place & { displayName: string })[]>([]),
    [searching, setSearching] = useState(false),
    [message, setMessage] = useState(""),
    [manual, setManual] = useState(false);
  const [name, setName] = useState(""),
    [lat, setLat] = useState(""),
    [lng, setLng] = useState(""),
    [code, setCode] = useState("");
  function add(p: Place) {
    if (value.length >= 30) {
      setMessage("一段旅行最多放 30 个地点哦");
      return;
    }
    if (value.some((x) => x.id === p.id)) {
      setMessage("这个地点已经在行程里啦");
      return;
    }
    onChange([...value, p]);
    setResults([]);
    setMessage("地点已放进行程，可以继续添加下一站");
  }
  function move(i: number, d: number) {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  }
  return (
    <section className="place-editor">
      <h3 className="field-title">把目的地钉在地图上</h3>
      <div className="search-row">
        <input
          aria-label="搜索旅行地点"
          placeholder="城市、景点或地址"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={120}
        />
        <button
          type="button"
          className="button secondary"
          disabled={searching || query.trim().length < 2}
          onClick={async () => {
            setSearching(true);
            setMessage("");
            try {
              const r = await api<{
                places: (Place & { displayName: string })[];
              }>("/api/places/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query }),
              });
              setResults(r.places);
              if (!r.places.length)
                setMessage("还没找到，试试城市加景点名，或手动标注");
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setSearching(false);
            }
          }}
        >
          <Search size={16} />
          {searching ? "找找看…" : "搜索"}
        </button>
      </div>
      {results.length > 0 && (
        <ul className="place-results">
          {results.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => add(p)}>
                <b>{p.name}</b>
                <small>{p.displayName}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="micro-copy">
        搜索由 OpenStreetMap 提供；点击搜索才会发送地点名称。
      </p>
      <ol className="stop-list">
        {value.map((p, i) => (
          <li key={p.id}>
            <span className="stop-number">{i + 1}</span>
            <div>
              <b>{p.name}</b>
              <small>
                {p.country || "国家待补充"} · {p.lat.toFixed(3)},{" "}
                {p.lng.toFixed(3)}
              </small>
            </div>
            <button
              type="button"
              className="mini-action"
              aria-label={`上移地点${p.name}`}
              disabled={!i}
              onClick={() => move(i, -1)}
            >
              <ArrowUp size={15} />
            </button>
            <button
              type="button"
              className="mini-action"
              aria-label={`下移地点${p.name}`}
              disabled={i === value.length - 1}
              onClick={() => move(i, 1)}
            >
              <ArrowDown size={15} />
            </button>
            <button
              type="button"
              className="mini-action"
              aria-label={`移除地点${p.name}`}
              onClick={() => onChange(value.filter((_, n) => n !== i))}
            >
              <X size={15} />
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="text-action"
        onClick={() => setManual(!manual)}
      >
        <MapPin size={16} />
        {manual ? "收起手动标注" : "也可以在地图选点 / 填写经纬度"}
      </button>
      {manual && (
        <div className="manual-place">
          <TripMap
            trips={[
              {
                id: "draft",
                title: "这次旅行",
                status: "planned",
                places: value,
              } as Trip,
            ]}
            onPick={(a, b) => {
              setLat(a.toFixed(6));
              setLng(b.toFixed(6));
              setMessage("选好了，给这个地点起个名字吧");
            }}
          />
          <p className="micro-copy">
            轻点地图选位置，再填写名称。国家代码留空时不计入国家统计。
          </p>
          <label className="field">
            地点名称
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
            />
          </label>
          <div className="form-columns">
            <label className="field">
              纬度
              <input
                aria-label="纬度"
                type="number"
                step="any"
                min="-85"
                max="85"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
              />
            </label>
            <label className="field">
              经度
              <input
                aria-label="经度"
                type="number"
                step="any"
                min="-180"
                max="180"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
              />
            </label>
          </div>
          <label className="field">
            国家代码（可选）
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={2}
              placeholder="例如 CN 中国 / CA 加拿大 / JP 日本"
            />
          </label>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              if (
                !name.trim() ||
                lat === "" ||
                lng === "" ||
                !Number.isFinite(+lat) ||
                !Number.isFinite(+lng) ||
                Math.abs(+lat) > 85 ||
                Math.abs(+lng) > 180 ||
                !/^([A-Z]{2})?$/.test(code)
              ) {
                setMessage("请填写名称、有效经纬度和两位国家代码");
                return;
              }
              let country = "";
              try {
                country = code
                  ? new Intl.DisplayNames(["zh-CN"], {
                      type: "region",
                      fallback: "none",
                    }).of(code) || ""
                  : "";
              } catch {}
              if (code && !country) {
                setMessage("这个国家代码没有找到，请检查一下");
                return;
              }
              add({
                id: crypto.randomUUID(),
                name: name.trim(),
                lat: +lat,
                lng: +lng,
                countryCode: code,
                country,
              });
              setName("");
            }}
          >
            添加这个地点
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="inline-note">
          {message}
        </p>
      )}
    </section>
  );
}
