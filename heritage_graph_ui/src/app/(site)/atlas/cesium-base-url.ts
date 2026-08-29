/* Sets static asset base path before Cesium workers load (see public/cesium). */
if (typeof window !== 'undefined') {
  (window as Window & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = '/cesium';
}
