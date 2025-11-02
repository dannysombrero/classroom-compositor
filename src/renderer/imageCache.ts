const imageCache = new Map<string, HTMLImageElement>();

export function getImageElement(dataUri: string): HTMLImageElement {
  let image = imageCache.get(dataUri);
  if (!image) {
    image = new Image();
    image.src = dataUri;
    imageCache.set(dataUri, image);
  }
  return image;
}
