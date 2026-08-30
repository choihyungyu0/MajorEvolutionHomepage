/**
 * 사이트 정본(canonical) URL을 해석한다.
 *
 * 배포 환경에 NEXT_PUBLIC_SITE_URL이 설정되지 않아 sitemap.xml의 모든 <loc>과
 * og:image가 http://localhost:3000 으로 나가고 있었다. 검색엔진 색인과
 * 링크 공유 미리보기가 함께 깨진다.
 *
 * 환경변수 설정을 잊더라도 Vercel이 자동 주입하는 도메인으로 복구되도록
 * 폴백 사슬을 둔다. 우선순위는 다음과 같다.
 *
 *   1. NEXT_PUBLIC_SITE_URL          커스텀 도메인. 명시 설정이 항상 최우선
 *   2. VERCEL_PROJECT_PRODUCTION_URL 프로덕션 도메인. 프리뷰 배포에서도 정본을 가리킨다
 *   3. VERCEL_URL                    배포별 URL. 위 둘이 모두 없을 때의 최후 수단
 *   4. http://localhost:3000         로컬 개발
 *
 * 주의: 2번과 3번은 NEXT_PUBLIC_ 접두사가 없어 서버에서만 읽힌다.
 * metadata와 sitemap은 서버에서 평가되므로 문제없지만, 클라이언트 컴포넌트에서
 * 이 함수를 호출하면 localhost로 폴백된다. 클라이언트에서 정본 URL이 필요하면
 * NEXT_PUBLIC_SITE_URL을 반드시 설정해야 한다.
 */

function normalize(value: string | undefined): string {
  if (!value) return "";
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  // Vercel이 주입하는 값은 프로토콜 없는 호스트명이다.
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export const FALLBACK_SITE_URL = "http://localhost:3000";

export function getSiteUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
  ];

  for (const candidate of candidates) {
    const resolved = normalize(candidate);
    if (resolved) return resolved;
  }

  return FALLBACK_SITE_URL;
}
