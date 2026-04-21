/* HeritageGraph minimal service worker — extend with Workbox for production caching. */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Default: network-only. Add stale-while-revalidate for registry in a Workbox build.
});
