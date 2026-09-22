import { checkOrigin, requireRole } from "@/lib/auth";
import { DomainError } from "@/lib/domain";
import { json, failure } from "@/lib/http";
import { savePhoto } from "@/lib/storage";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const role = await requireRole();
    if (Number(request.headers.get("content-length") || 0) > 2100000)
      throw new DomainError("照片太大了，请选择较小的图片", 413);
    const form = await request.formData();
    const file = form.get("photo");
    if (!(file instanceof File) || file.size > 2000000 || file.size < 12)
      throw new DomainError("请选择小于 2MB 的图片", 400);
    const bytes = Buffer.from(await file.arrayBuffer());
    const mime = bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
      ? "image/jpeg"
      : bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        ? "image/png"
        : bytes.toString("ascii", 0, 4) === "RIFF" &&
            bytes.toString("ascii", 8, 12) === "WEBP"
          ? "image/webp"
          : null;
    if (!mime) throw new DomainError("支持 JPG、PNG 和 WebP 照片");
    const id = crypto.randomUUID();
    await savePhoto(id, role, mime, bytes);
    return json({ id });
  } catch (e) {
    return failure(e);
  }
}
