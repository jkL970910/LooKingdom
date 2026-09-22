import { checkOrigin, requireRole } from "@/lib/auth";
import { commandSchema, applyCommand, DomainError } from "@/lib/domain";
import { getPhoto, readState, updateState } from "@/lib/storage";
import { json, failure } from "@/lib/http";
import { settleCouponUses } from "@/lib/coupon-flow";
export const runtime = "nodejs";
export async function GET() {
  try {
    await requireRole();
    let state = await readState();
    if (settleCouponUses(state) !== state)
      state = await updateState(settleCouponUses);
    return json({ ...state, serverNow: new Date().toISOString() });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const actor = await requireRole();
    const text = await request.text();
    if (text.length > 20000) throw new DomainError("内容太长啦", 413);
    const command = commandSchema.parse(JSON.parse(text));
    if (
      command.type === "event.save" &&
      command.event.photoId &&
      !(await getPhoto(command.event.photoId))
    )
      throw new DomainError("照片上传尚未完成，请重新选择");
    const photoId =
      command.type === "recipe.save"
        ? command.recipe.photoId
        : command.type === "trip.save"
          ? command.trip.photoId
          : command.type === "coupon.product"
            ? command.product.photoId
            : command.type === "meal.cook"
              ? command.photoId
              : null;
    if (photoId && !(await getPhoto(photoId)))
      throw new DomainError("照片上传尚未完成，请重新选择");
    const state = await updateState((state) =>
      applyCommand(state, command, actor),
    );
    return json({ ...state, serverNow: new Date().toISOString() });
  } catch (e) {
    return failure(e);
  }
}
