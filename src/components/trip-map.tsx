"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import type { Trip } from "@/lib/lifestyle";

export function TripMap({
  trips,
  selectedId,
  onSelect,
  onPick,
  mode = "route",
}: {
  trips: Trip[];
  mode?: "overview" | "route";
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onPick?: (lat: number, lng: number) => void;
}) {
  const node = useRef<HTMLDivElement>(null),
    map = useRef<LeafletMap | null>(null),
    layers = useRef<LayerGroup | null>(null);
  const callbacks = useRef({ onSelect, onPick });
  callbacks.current = { onSelect, onPick };
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    let disposed = false;
    void import("leaflet")
      .then((L) => {
        if (disposed || !node.current) return;
        const m = L.map(node.current, { scrollWheelZoom: false }).setView(
          [28, 20],
          2,
        );
        map.current = m;
        L.tileLayer(
          process.env.NEXT_PUBLIC_MAP_TILE_URL ||
            "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            maxZoom: 19,
            attribution:
              '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
          },
        )
          .on("tileerror", () => setFailed(true))
          .addTo(m);
        layers.current = L.layerGroup().addTo(m);
        m.on("click", (e) =>
          callbacks.current.onPick?.(e.latlng.lat, e.latlng.lng),
        );
        setReady(true);
      })
      .catch(() => setFailed(true));
    return () => {
      disposed = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);
  const data = JSON.stringify(
    trips.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      places: t.places,
    })),
  );
  useEffect(() => {
    if (!ready) return;
    let disposed = false;
    void import("leaflet").then((L) => {
      if (disposed || !map.current || !layers.current) return;
      layers.current.clearLayers();
      const rows = JSON.parse(data) as Trip[];
      const bounds: L.LatLngTuple[] = [];
      for (const t of rows) {
        const points = t.places.map((p) => [p.lat, p.lng] as L.LatLngTuple);
        const color = t.status === "planned" ? "#e88983" : "#438dc3";
        if (mode === "route" && points.length > 1)
          L.polyline(points, {
            color,
            weight: 3,
            opacity: 0.65,
            dashArray: t.status === "planned" ? "7 8" : undefined,
          }).addTo(layers.current);
        const markers = mode === "overview" ? t.places.slice(0, 1) : t.places;
        markers.forEach((p, i) => {
          const label = document.createElement("span");
          label.textContent =
            mode === "overview"
              ? `${t.title} · ${t.places.length} 站`
              : `${t.title} · ${i + 1}. ${p.name}`;
          L.marker([p.lat, p.lng], {
            title:
              mode === "overview"
                ? `${t.title} · ${t.places.length} 站`
                : `${t.title}：${p.name}`,
            icon: L.divIcon({
              className: "loo-map-marker",
              html: `<span style="background:${color}">${mode === "overview" ? "♡" : i + 1}</span>`,
              iconSize: [30, 36],
              iconAnchor: [15, 34],
            }),
          })
            .bindTooltip(label)
            .on("click", () => callbacks.current.onSelect?.(t.id))
            .addTo(layers.current!);
        });
        if (!selectedId || t.id === selectedId)
          bounds.push(...(mode === "overview" ? points.slice(0, 1) : points));
      }
      if (bounds.length)
        map.current.fitBounds(bounds, {
          padding: [35, 35],
          maxZoom: 11,
          animate: false,
        });
    });
    return () => {
      disposed = true;
    };
  }, [data, selectedId, ready, mode]);
  return (
    <div className="map-wrap">
      <div ref={node} className="trip-map" aria-label="一起走过的旅行地图" />
      {!ready && !failed && (
        <p className="map-message">正在展开我们的小地图…</p>
      )}
      {failed && (
        <p className="map-message" role="status">
          底图暂时没连上，地点和行程仍然保存在下方。
        </p>
      )}
    </div>
  );
}
