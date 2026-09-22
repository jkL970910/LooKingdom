import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DomainError } from "./domain";
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export function failure(error: unknown) {
  if (error instanceof DomainError)
    return json({ error: error.message }, error.status);
  if (error instanceof ZodError)
    return json({ error: error.issues[0]?.message || "输入内容不正确" }, 400);
  if (error instanceof SyntaxError)
    return json({ error: "请求内容格式不正确" }, 400);
  console.error(
    "Loo request failed:",
    error instanceof Error
      ? error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g, "[database]")
      : "Unknown error",
  );
  return json({ error: "小窝暂时连接不上，请稍后重试" }, 503);
}
