/**
 * Shrink a photo in the browser before it is uploaded: longest side 1,600 px,
 * JPEG at 0.82. A phone photo of 4–8 MB comes out at a few hundred KB, so a
 * handful of site photos fits the server-action body limit (next.config.ts)
 * and a customer's page loads them quickly.
 *
 * Falls back to the original file when the browser cannot decode it.
 */
export async function shrinkImage(file: File, maxSide = 1600, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

/** Replace the `photos` entries of a form's data with shrunk copies. */
export async function withShrunkPhotos(data: FormData, field = 'photos'): Promise<FormData> {
  const files = data.getAll(field).filter((f): f is File => f instanceof File && f.size > 0);
  data.delete(field);
  for (const f of await Promise.all(files.map((f) => shrinkImage(f)))) data.append(field, f);
  return data;
}
