export type TimeZonePreference = "toronto" | "beijing" | "local";
export function resolveTimeZone(
  choice: TimeZonePreference,
  local = "America/Toronto",
) {
  if (choice === "beijing") return "Asia/Shanghai";
  if (choice === "local") {
    try {
      new Intl.DateTimeFormat("en", { timeZone: local }).format();
      return local;
    } catch {
      return "America/Toronto";
    }
  }
  return "America/Toronto";
}
export const timeZoneNames = {
  toronto: "多伦多",
  beijing: "北京",
  local: "手机本地",
} as const;
