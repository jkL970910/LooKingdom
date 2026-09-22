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
      sheet={`${role}-states-alpha`}
      index={activity}
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
      sheet="cards"
      index={art + (role === "red" ? 4 : 0)}
      cols={4}
      className={className}
    />
  );
}
