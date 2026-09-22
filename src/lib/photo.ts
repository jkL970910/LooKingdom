export async function compressPhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("请选择一张照片");
  if (file.size > 20000000) throw new Error("请选择小于 20MB 的照片");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(
      1,
      1200 / Math.max(img.naturalWidth, img.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("暂时无法处理这张照片");
    ctx.fillStyle = "#fff8ed";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const result = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    if (!result || result.size > 2000000)
      throw new Error("照片有点大，请换一张较小的图片");
    return result;
  } catch (e) {
    if (e instanceof Error && e.message.includes("照片")) throw e;
    throw new Error("这张照片无法读取，请尝试 JPG 或 PNG 格式");
  } finally {
    URL.revokeObjectURL(url);
  }
}
