/**
 * Webpack alias target for `@spz-loader/core`.
 *
 * Cesium 1.140+ depends on SPZ (Gaussian splat) loading, but the published
 * Emscripten bundle embeds WASM via template literals (`\0asm…`) that break
 * under strict parsing in production chunks. Heritage Atlas does not load .spz
 * assets; this stub keeps the globe bundle parseable.
 */

export async function loadSpz(): Promise<never> {
  throw new Error('SPZ Gaussian splat loading is disabled in Heritage Atlas builds.');
}

export async function loadSpzFromUrl(): Promise<never> {
  throw new Error('SPZ Gaussian splat loading is disabled in Heritage Atlas builds.');
}
