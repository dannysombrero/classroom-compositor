const MAX_CACHE_BYTES = 50 * 1024 * 1024; // 50MB approximate cap

type ImageCacheEntry = {
  img: HTMLImageElement;
  size: number;
};

const imageCache = new Map<string, ImageCacheEntry>();
let cacheSizeBytes = 0;

function estimateDataUriSize(dataUri: string): number {
  // Roughly convert base64 string length to bytes (length * 3/4)
  const base64Length = dataUri.startsWith('data:') ? dataUri.split(',')[1]?.length ?? 0 : dataUri.length;
  return Math.ceil((base64Length * 3) / 4);
}

function evictIfNeeded(neededBytes: number) {
  if (neededBytes > MAX_CACHE_BYTES) {
    // Too large to ever cache; skip eviction to avoid clearing everything.
    return;
  }

  while (cacheSizeBytes + neededBytes > MAX_CACHE_BYTES && imageCache.size > 0) {
    const oldestKey = imageCache.keys().next().value;
    if (!oldestKey) break;
    const oldestEntry = imageCache.get(oldestKey);
    imageCache.delete(oldestKey);
    if (oldestEntry) {
      cacheSizeBytes = Math.max(0, cacheSizeBytes - oldestEntry.size);
    }
  }
}

export function getImageElement(dataUri: string): HTMLImageElement {
  const cached = imageCache.get(dataUri);
  if (cached) {
    // Refresh LRU order
    imageCache.delete(dataUri);
    imageCache.set(dataUri, cached);
    return cached.img;
  }

  const size = estimateDataUriSize(dataUri);
  evictIfNeeded(size);

  const image = new Image();
  image.decoding = 'async';
  image.src = dataUri;

  if (size <= MAX_CACHE_BYTES) {
    imageCache.set(dataUri, { img: image, size });
    cacheSizeBytes = Math.min(MAX_CACHE_BYTES, cacheSizeBytes + size);
  }

  return image;
}

export function clearImageCache(): void {
  imageCache.clear();
  cacheSizeBytes = 0;
}
