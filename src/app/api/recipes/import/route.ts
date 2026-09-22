import { z } from "zod";
import { requireRole, checkOrigin } from "@/lib/auth";
import { json, failure } from "@/lib/http";
import { fetchRecipeDraft } from "@/lib/recipe-import";
import { DomainError } from "@/lib/domain";
export const runtime = "nodejs";
export const maxDuration = 45;
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    await requireRole();
    const text = await request.text();
    if (text.length > 14000) throw new DomainError("分享文案太长了", 413);
    const body = z
      .object({ text: z.string().min(1).max(12000) })
      .parse(JSON.parse(text));
    return json(await fetchRecipeDraft(body.text));
  } catch (e) {
    return failure(e);
  }
}
