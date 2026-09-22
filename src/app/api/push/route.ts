import { checkOrigin, requireRole } from "@/lib/auth";
import { json, failure } from "@/lib/http";
import { DomainError } from "@/lib/domain";
import {
  pushConfigured,
  subscriptionSchema,
  saveSubscription,
  removeSubscription,
  subscriptionsFor,
  subscriptionId,
} from "@/lib/push";
export const runtime = "nodejs";
export async function GET() {
  try {
    const role = await requireRole();
    return json({
      configured: pushConfigured(),
      publicKey: process.env.VAPID_PUBLIC_KEY || "",
      devices: (await subscriptionsFor(role)).map((s) =>
        subscriptionId(s.endpoint),
      ),
    });
  } catch (e) {
    return failure(e);
  }
}
async function read(request: Request) {
  const text = await request.text();
  if (text.length > 5000) throw new DomainError("订阅内容太长", 413);
  return subscriptionSchema.parse(JSON.parse(text));
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const role = await requireRole();
    if (!pushConfigured()) throw new DomainError("手机提醒还在准备中", 503);
    await saveSubscription(role, await read(request));
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(request: Request) {
  try {
    checkOrigin(request);
    const role = await requireRole();
    const s = await read(request);
    await removeSubscription(role, s.endpoint);
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
