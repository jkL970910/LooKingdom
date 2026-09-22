import { cookies } from "next/headers";
import { z } from "zod";
import { createHash } from "node:crypto";
import {
  COOKIE,
  checkOrigin,
  configuredCode,
  createToken,
  currentRole,
  equal,
} from "@/lib/auth";
import { allowLogin, localMode } from "@/lib/storage";
import { DomainError } from "@/lib/domain";
import { json, failure } from "@/lib/http";
export const runtime = "nodejs";
export async function GET() {
  try {
    return json({
      role: await currentRole(),
      local: localMode(),
      requiresCode:
        !localMode() ||
        Boolean(process.env.BLUE_ACCESS_CODE || process.env.RED_ACCESS_CODE),
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const body = z
      .object({
        role: z.enum(["blue", "red"]),
        code: z.string().max(200).optional(),
      })
      .parse(await request.json());
    const key = createHash("sha256")
      .update(
        `${request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "local"}:${body.role}`,
      )
      .digest("hex");
    if (!(await allowLogin(key)))
      throw new DomainError("尝试次数有点多，请 15 分钟后再试", 429);
    const code = configuredCode(body.role);
    if (code && !equal(body.code || "", code))
      throw new DomainError("小窝口令不对，再想想哦", 403);
    (await cookies()).set(COOKIE, createToken(body.role), {
      httpOnly: true,
      secure: !localMode(),
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 86400,
    });
    return json({ role: body.role });
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(request: Request) {
  try {
    checkOrigin(request);
    (await cookies()).delete(COOKIE);
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
