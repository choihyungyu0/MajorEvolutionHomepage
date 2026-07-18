// 전공진화소 서비스워커 — 설치 가능 조건(fetch 핸들러) 충족 + 앱 셸 오프라인 폴백
const CACHE = "mvp-shell-v2";
const SHELL = ["/", "/research"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // 외부 요청은 통과
  if (url.pathname.startsWith("/api/")) return; // API는 항상 네트워크

  // 페이지 이동: 네트워크 우선, 실패 시 캐시/홈으로 폴백
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request).then((c) => c || caches.match("/"))),
    );
    return;
  }

  // 그 외 정적 리소스: 캐시 우선, 없으면 네트워크
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
