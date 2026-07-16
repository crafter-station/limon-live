import "server-only";
import { Buffer } from "node:buffer";
import { put } from "@vercel/blob";
import type { RestaurantMediaRetainer } from "@/domain/generation/types";
import type { NormalizedRestaurant } from "@/domain/restaurant";

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_TIMEOUT_MS = 8_000;
export const PHOTO_MAX_REDIRECTS = 3;
export const PHOTO_CONCURRENCY = 2;

const CONTENT_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

type BlobWriter = (
  pathname: string,
  body: Buffer,
  options: {
    access: "public";
    addRandomSuffix: false;
    contentType: string;
    token: string;
  },
) => Promise<{ url: string }>;

function approvedPhotoUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new Error("Unapproved photo URL.");
  }
  if (!/^lh[3-6]\.googleusercontent\.com$/i.test(url.hostname)) {
    throw new Error("Unapproved photo host.");
  }
  return url;
}

async function downloadPhoto(sourceUrl: string, fetcher: typeof fetch) {
  let url = approvedPhotoUrl(sourceUrl);
  for (let redirects = 0; ; redirects += 1) {
    const response = await fetcher(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(PHOTO_TIMEOUT_MS),
    });
    if (response.status >= 300 && response.status < 400) {
      if (redirects >= PHOTO_MAX_REDIRECTS) throw new Error("Too many redirects.");
      const location = response.headers.get("location");
      if (!location) throw new Error("Redirect has no location.");
      url = approvedPhotoUrl(new URL(location, url).href);
      continue;
    }
    if (!response.ok || !response.body) throw new Error("Photo download failed.");
    const contentType = response.headers
      .get("content-type")
      ?.split(";", 1)[0]
      .toLowerCase();
    const extension = contentType ? CONTENT_TYPES.get(contentType) : undefined;
    if (!contentType || !extension) throw new Error("Unsupported photo type.");
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > PHOTO_MAX_BYTES) {
      throw new Error("Photo is too large.");
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > PHOTO_MAX_BYTES) {
        await reader.cancel();
        throw new Error("Photo stream is too large.");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { bytes, contentType, extension };
  }
}

export class PlacePhotoRetainer implements RestaurantMediaRetainer {
  constructor(
    private readonly token: string,
    private readonly fetcher: typeof fetch = fetch,
    private readonly writeBlob: BlobWriter = put,
  ) {}

  async retain(generationId: string, data: NormalizedRestaurant) {
    const retained: Array<NormalizedRestaurant["photos"][number] | null> =
      new Array(data.photos.length);
    let cursor = 0;
    const worker = async () => {
      for (;;) {
        const index = cursor++;
        const photo = data.photos[index];
        if (!photo) return;
        try {
          const download = await downloadPhoto(photo.url, this.fetcher);
          const blob = await this.writeBlob(
            `restaurant-generations/${generationId}/photos/${index}.${download.extension}`,
            Buffer.from(download.bytes),
            {
              access: "public",
              addRandomSuffix: false,
              contentType: download.contentType,
              token: this.token,
            },
          );
          retained[index] = { ...photo, url: blob.url };
        } catch {
          retained[index] = null;
        }
      }
    };
    await Promise.all(
      Array.from(
        { length: Math.min(PHOTO_CONCURRENCY, data.photos.length) },
        worker,
      ),
    );
    return { ...data, photos: retained.filter((photo) => photo !== null) };
  }
}
