import type { CSSProperties } from "react";
import type { Role } from "@/lib/domain";

export function Sprite({
  sheet,
  index,
  cols = 3,
  rows = 2,
  className = "",
  label = "",
}: {
  sheet: string;
  index: number;
  cols?: number;
  rows?: number;
  className?: string;
  label?: string;
}) {
  const style: CSSProperties = {
    backgroundImage: `url(/art/${sheet}.webp)`,
    backgroundSize: `${cols * 100}% ${rows * 100}%`,
    backgroundPosition: `${cols === 1 ? 0 : ((index % cols) / (cols - 1)) * 100}% ${rows === 1 ? 0 : (Math.floor(index / cols) / (rows - 1)) * 100}%`,
  };
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={!label || undefined}
      className={`sprite ${className}`}
      style={style}
    />
  );
}
export function Loo({
  role,
  activity,
  className = "",
}: {
  role: Role;
  activity: number;
  className?: string;
}) {
  return (
    <Sprite
      sheet={activity === 6 ? "eating" : `${role}-states-alpha`}
      index={activity === 6 ? (role === "red" ? 1 : 0) : activity}
      cols={activity === 6 ? 2 : 3}
      rows={activity === 6 ? 1 : 2}
      className={className}
    />
  );
}
export function CardArt({
  role,
  art,
  className = "",
}: {
  role: Role;
  art: number;
  className?: string;
}) {
  return (
    <Sprite
      sheet={art === 4 ? "wish-cards" : "cards"}
      index={
        art === 4 ? (role === "red" ? 1 : 0) : art + (role === "red" ? 4 : 0)
      }
      cols={art === 4 ? 2 : 4}
      rows={art === 4 ? 1 : 2}
      className={className}
    />
  );
}
