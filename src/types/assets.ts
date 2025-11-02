/**
 * Type definitions for assets (images and other media) used in layers.
 */

/**
 * Reference asset pointing to an external URI.
 */
export interface ReferenceAsset {
  kind: 'reference';
  /** External URI (file path, URL, etc.) */
  uri: string;
}

/**
 * Embedded asset stored as a blob in IndexedDB.
 */
export interface EmbeddedAsset {
  kind: 'embedded';
  /** Blob ID used to retrieve from storage */
  blobId: string;
  /** SHA256 hash for deduplication (optional) */
  sha256?: string;
}

/**
 * Discriminated union of asset types.
 */
export type Asset = ReferenceAsset | EmbeddedAsset;

