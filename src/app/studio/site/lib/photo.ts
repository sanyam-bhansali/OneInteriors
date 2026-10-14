'use client';

/**
 * Photos on the phone, before they are saved for sending.
 *
 * ## What the web can prove about a photo, and what it cannot
 *
 * The brief wants site photos taken in the app, with time and place, and a
 * gallery photo labelled "from gallery". A web page cannot prove where a
 * picture came from: `capture="environment"` asks the browser to open the
 * camera, but some Android browsers still offer the file picker, and a
 * JPEG's EXIF can be edited. So we record what we can, honestly:
 *
 * - `fromGallery` is true when the photo came through the "From gallery"
 *   picker — and also when it came through the camera button but its EXIF
 *   time is more than 10 minutes old (an old picture picked from the
 *   camera button's file chooser).
 * - `takenAt` is the EXIF time when there is one, else the moment the photo
 *   reached the page — never the moment it was uploaded, so a post sent late
 *   from a phone with no signal still says when the work was photographed.
 * - Place: the phone's location when the browser gives it (never shown to
 *   the customer).
 *
 * Real enforcement (camera only, no picker) arrives with the native studio
 * app (brief, phase 6).
 */

const MAX_EDGE = 1600;
const QUALITY = 0.82;
const STALE_MS = 10 * 60_000;

function ascii(view: DataView, start: number, length: number): string {
  let s = '';
  for (let i = 0; i < length && start + i < view.byteLength; i++) {
    const c = view.getUint8(start + i);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

/** "2026:10:08 17:12:03" from EXIF, read as India time (phones on site are set to IST; EXIF carries no zone). */
function exifDate(s: string): Date | null {
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(s);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The EXIF DateTimeOriginal (or DateTime) of a JPEG, or null. Reads only the first 128 KB. */
export async function exifTakenAt(file: Blob): Promise<Date | null> {
  try {
    const buf = await file.slice(0, 128 * 1024).arrayBuffer();
    const v = new DataView(buf);
    if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return null;
    let off = 2;
    while (off + 4 < v.byteLength) {
      const marker = v.getUint16(off);
      const size = v.getUint16(off + 2);
      if (marker === 0xffe1 && ascii(v, off + 4, 4) === 'Exif') {
        const tiff = off + 10;
        const little = v.getUint16(tiff) === 0x4949;
        const u16 = (o: number) => v.getUint16(o, little);
        const u32 = (o: number) => v.getUint32(o, little);
        const readIfd = (ifd: number, want: number[]): Map<number, number> => {
          const out = new Map<number, number>();
          if (ifd + 2 > v.byteLength) return out;
          const n = u16(ifd);
          for (let i = 0; i < n; i++) {
            const e = ifd + 2 + i * 12;
            if (e + 12 > v.byteLength) break;
            const tag = u16(e);
            if (want.includes(tag)) out.set(tag, u32(e + 8));
          }
          return out;
        };
        const ifd0 = readIfd(tiff + u32(tiff + 4), [0x8769, 0x0132]);
        const exifPtr = ifd0.get(0x8769);
        if (exifPtr !== undefined) {
          const original = readIfd(tiff + exifPtr, [0x9003]).get(0x9003);
          if (original !== undefined) {
            const d = exifDate(ascii(v, tiff + original, 19));
            if (d) return d;
          }
        }
        const dt = ifd0.get(0x0132);
        return dt !== undefined ? exifDate(ascii(v, tiff + dt, 19)) : null;
      }
      if ((marker & 0xff00) !== 0xff00 || size < 2) return null;
      off += 2 + size;
    }
  } catch {
    /* no EXIF we can read */
  }
  return null;
}

/** Shrink to a 1600 px long edge as a JPEG, upright. Falls back to the original when the browser cannot. */
export async function compress(file: Blob): Promise<{ blob: Blob; type: string }> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas');
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    if (!blob) throw new Error('no blob');
    return { blob, type: 'image/jpeg' };
  } catch {
    const type = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ? file.type : 'image/jpeg';
    return { blob: file, type };
  }
}

export interface ReadyPhoto {
  blob: Blob;
  type: string;
  takenAt: string;
  fromGallery: boolean;
}

/** A picked or captured file → compressed, with its time and where it came from. */
export async function readyPhoto(file: File, viaGallery: boolean, now = Date.now()): Promise<ReadyPhoto> {
  const exif = await exifTakenAt(file);
  const takenAt = exif && exif.getTime() <= now + STALE_MS ? exif : new Date(now);
  const stale = now - takenAt.getTime() > STALE_MS;
  const { blob, type } = await compress(file);
  return { blob, type, takenAt: takenAt.toISOString(), fromGallery: viaGallery || stale };
}

/** The phone's place, once, if the browser will say. Never blocks a post. */
export function wherePhoneIs(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    const done = setTimeout(() => resolve(null), 9000);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(done);
        resolve({ lat: p.coords.latitude, lng: p.coords.longitude });
      },
      () => {
        clearTimeout(done);
        resolve(null);
      },
      { enableHighAccuracy: false, maximumAge: 5 * 60_000, timeout: 8000 },
    );
  });
}
