// Compresses a camera photo on the phone before upload (≤ ~300 KB JPEG, longest side ≤ 1280 px) so DC photos stay
// light on patchy 4G and inside the per-business cap (04 §2.3).
export async function compressPhoto(file: File, maxBytes = 300 * 1024): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const q of [0.72, 0.6, 0.48, 0.36]) {
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', q));
      if (blob && blob.size <= maxBytes) return blob;
    }
    throw new Error('photo_too_large');
  } finally {
    URL.revokeObjectURL(url);
  }
}
