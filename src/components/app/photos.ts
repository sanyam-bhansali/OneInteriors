'use client';

/** A phone photo, shrunk to at most `side` px on its long edge, as a JPEG file ready to upload. */
export async function shrinkToFile(file: File, side = 1600): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  if (!blob) throw new Error('photo');
  return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
}
