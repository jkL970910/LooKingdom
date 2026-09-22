import { requireRole } from "@/lib/auth";
import { getPhoto } from "@/lib/storage";
import { failure } from "@/lib/http";
import { DomainError } from "@/lib/domain";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole();
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new DomainError("照片不存在", 404);
    const photo = await getPhoto(id);
    if (!photo) throw new DomainError("照片不存在", 404);
    return new Response(new Uint8Array(photo.data), {
      headers: {
        "Content-Type": photo.mime,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
