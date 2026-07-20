/**
 * Build-scoped CPS wire hydration — labelled export-boundary escape hatch.
 *
 * Formats may persist unmodelled donor/retain slices here so merge export can
 * rehydrate radio-safe output without stashing modelled wire into the library.
 * Persisted on the format build (IndexedDB) and round-trips with native YAML
 * project export/import. Not library entities; not relationship keys.
 */

/** Shared capture metadata for any format's hydration bag. */
export interface CpsWireHydrationBase {
  /** Catalog `formatId` this bag belongs to (discriminant for narrowing). */
  formatId: string;
  /** Original upload file name when known. */
  sourceFileName?: string;
  /** ISO timestamp when the bag was captured. */
  capturedAt: string;
}

/**
 * Persisted hydration bag on {@link FormatBuild.cpsWireHydration}.
 * `retain` is opaque at the model layer; each format owns its retain shape.
 */
export interface CpsWireHydration extends CpsWireHydrationBase {
  /** Format-specific retain payload (opaque here; typed in format adapters). */
  retain: unknown;
}
