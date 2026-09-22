import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import { cookies } from "next/headers";
import type { Role } from "./domain";
import { DomainError } from "./domain";
import { localMode } from "./storage";

export const COOKIE = "loo_session";
const secret = () => {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32)
    return process.env.SESSION_SECRET;
  if (localMode()) return "loo-local-development-only-session-secret";
  throw new Error("SESSION_SECRET must contain at least 32 characters");
};
const signature = (value: string) =>
  createHmac("sha256", secret()).update(value).digest("base64url");
export function equal(a: string, b: string) {
  return timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
}
export function createToken(role: Role) {
  const data = `${role}.${Math.floor(Date.now() / 1000) + 30 * 86400}`;
  return `${data}.${signature(data)}`;
}
export function verifyToken(token: string): Role | null {
  const [role, exp, sig, extra] = token.split(".");
  if (
    extra ||
    !["blue", "red"].includes(role) ||
    !exp ||
    !sig ||
    !/^\d+$/.test(exp) ||
    Number(exp) <= Date.now() / 1000
  )
    return null;
  return equal(sig, signature(`${role}.${exp}`)) ? (role as Role) : null;
}
export async function currentRole() {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? verifyToken(token) : null;
}
export async function requireRole() {
  const role = await currentRole();
  if (!role) throw new DomainError("请先选择身份，进入你们的小窝", 401);
  return role;
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  // Next's dev server normalizes request.url to localhost even when opened via a LAN/127.0.0.1 address.
  const expected =
    process.env.APP_ORIGIN ||
    `${url.protocol}//${request.headers.get("host") || url.host}`;
  if (origin && origin !== expected)
    throw new DomainError("请求来源不匹配", 403);
  if (!origin && request.headers.get("sec-fetch-site") === "cross-site")
    throw new DomainError("请求来源不匹配", 403);
}
export function configuredCode(role: Role) {
  if (
    !localMode() &&
    process.env.BLUE_ACCESS_CODE === process.env.RED_ACCESS_CODE
  )
    throw new Error("Blue and red access codes must differ");
  const code =
    role === "blue"
      ? process.env.BLUE_ACCESS_CODE
      : process.env.RED_ACCESS_CODE;
  if (!localMode() && (!code || code.length < 6))
    throw new Error(
      "Set separate BLUE_ACCESS_CODE / RED_ACCESS_CODE of at least 6 characters",
    );
  return code;
}
