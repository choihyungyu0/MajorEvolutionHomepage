/**
 * "너의 교수님은?" 브랜드 자산 V3 경로 레지스트리.
 *
 * 원본은 `너의교수님은_웹프론트_최적화자산_v03` 패키지이며,
 * 웹에서 쓰는 부분만 골라 `public/brand/nyp-v03/`으로 옮겨 두었습니다.
 * 새 자산이 필요하면 원본 패키지에서 꺼내 같은 규칙으로 추가합니다.
 */

const ROOT = "/brand/nyp-v03";

export const brandLogo = {
  mark: `${ROOT}/logo/nyp-logo-mark-color-v01.svg`,
  markMonoNavy: `${ROOT}/logo/nyp-logo-mark-mono-navy-v01.svg`,
  markMonoWhite: `${ROOT}/logo/nyp-logo-mark-mono-white-v01.svg`,
  wordmark: `${ROOT}/logo/nyp-wordmark-horizontal-color-v01.svg`,
  wordmarkStacked: `${ROOT}/logo/nyp-wordmark-stacked-color-v01.svg`,
  wordmarkMonoWhite: `${ROOT}/logo/nyp-wordmark-horizontal-mono-white-v01.svg`,
  lockup: `${ROOT}/logo/nyp-logo-lockup-horizontal-color-v01.svg`,
  lockupStacked: `${ROOT}/logo/nyp-logo-lockup-stacked-color-v01.svg`,
  appIcon: `${ROOT}/logo/nyp-app-icon-color-v01.svg`,
  appIcon512: `${ROOT}/logo/nyp-app-icon-color-v01-512.png`,
} as const;

/** 2026-08 리뉴얼: 학생과 교수의 첫 대화를 두 인물의 연결선으로 표현한 공용 로고. */
export const brandLogoV2 = {
  /** ImageGen으로 제작하고 웹용으로 여백/용량만 정리한 공식 심벌. */
  mark: "/brand/nyp-v04/logo/nyp-logo-symbol-generated-v01.png",
  /** 생성형 심벌의 형태를 단색 환경에 맞게 재구성한 벡터 대체안. */
  markMonoWhite: "/brand/nyp-v04/logo/nyp-logo-mark-mono-white-v02.svg",
} as const;

/**
 * 튜토리얼 전용 장면.
 * V2는 로봇과 발광 경로를 걷어내고 학생의 실제 고민 맥락만 남긴 차분한 보조 이미지입니다.
 */
export const tutorialScene = {
  firstPath: "/brand/nyp-v04/scenes/tutorial/nyp-scene-tutorial-student-campus-16x9-v02.png",
} as const;

/** 핵심 3기능 아이콘. 화면에서는 항상 텍스트 라벨과 함께 씁니다. */
export const coreIcon = {
  find: `${ROOT}/icons/core3/nyp-icon-core3-find-v01.svg`,
  make: `${ROOT}/icons/core3/nyp-icon-core3-make-v01.svg`,
  connect: `${ROOT}/icons/core3/nyp-icon-core3-connect-v01.svg`,
} as const;

/** 교수님 퀘스트 다섯 도구 아이콘. */
export const questIcon = {
  paperBite: `${ROOT}/icons/quest5/nyp-icon-quest5-paper_bite-v01.svg`,
  firstLine: `${ROOT}/icons/quest5/nyp-icon-quest5-first_line-v01.svg`,
  silenceRescue: `${ROOT}/icons/quest5/nyp-icon-quest5-silence_rescue-v01.svg`,
  emailGuard: `${ROOT}/icons/quest5/nyp-icon-quest5-email_guard-v01.svg`,
  nextSeed: `${ROOT}/icons/quest5/nyp-icon-quest5-next_seed-v01.svg`,
} as const;

type SceneSet = { w1024: string; w1440: string; w1920?: string; og?: string };

const scene = (dir: string, base: string, extras: Partial<SceneSet> = {}): SceneSet => ({
  w1024: `${ROOT}/scenes/${dir}/${base}-web-1024-1024x576-v01.webp`,
  w1440: `${ROOT}/scenes/${dir}/${base}-web-1440-1440x810-v01.webp`,
  ...extras,
});

/** 히어로·기능 소개용 대표 장면. 화면 폭에 맞춰 srcSet으로 제공합니다. */
export const brandScene = {
  home: scene("all", "nyp-scene-all-campus-journey", {
    w1920: `${ROOT}/scenes/all/nyp-scene-all-campus-journey-web-1920-1920x1080-v01.webp`,
    og: `${ROOT}/scenes/all/nyp-scene-all-campus-journey-og-web-1200x630-v01.webp`,
  }),
  find: scene("find", "nyp-scene-find-professor"),
  make: scene("make", "nyp-scene-make-major-lab"),
  connect: scene("connect", "nyp-scene-connect-professor"),
  paperBite: scene("q-paper", "nyp-scene-q-paper-bite"),
  firstLine: scene("q-opener", "nyp-scene-q-first-line"),
  silenceRescue: scene("q-silence", "nyp-scene-q-silence-rescue"),
  emailGuard: scene("q-email", "nyp-scene-q-email-ready"),
  nextSeed: scene("q-seed", "nyp-scene-q-next-seed"),
} as const;

/**
 * AI 도우미 캐릭터. 카드에는 512, 큰 화면에는 1024를 씁니다.
 * 실제 교수나 학생 사진이 아니라 가상 일러스트입니다.
 */
export const guideCharacter = {
  findRadar: `${ROOT}/characters/guide01/nyp-char-find-guide01-find-radar-alpha-512-v01.webp`,
  findRadar1024: `${ROOT}/characters/guide01/nyp-char-find-guide01-find-radar-alpha-1024-v01.webp`,
  makeLab: `${ROOT}/characters/guide01/nyp-char-make-guide01-make-lab-alpha-512-v01.webp`,
  makeLab1024: `${ROOT}/characters/guide01/nyp-char-make-guide01-make-lab-alpha-1024-v01.webp`,
  connectOpener: `${ROOT}/characters/guide01/nyp-char-connect-guide01-connect-opener-alpha-512-v01.webp`,
  connectOpener1024: `${ROOT}/characters/guide01/nyp-char-connect-guide01-connect-opener-alpha-1024-v01.webp`,
  processing: `${ROOT}/characters/guide01/nyp-char-all-guide01-processing-alpha-512-v01.webp`,
  processing1024: `${ROOT}/characters/guide01/nyp-char-all-guide01-processing-alpha-1024-v01.webp`,
  thinking: `${ROOT}/characters/guide01/nyp-char-all-guide01-thinking-alpha-512-v01.webp`,
  confused: `${ROOT}/characters/guide01/nyp-char-all-guide01-confused-alpha-512-v01.webp`,
  warning: `${ROOT}/characters/guide01/nyp-char-all-guide01-status-warning-alpha-512-v01.webp`,
  welcomeDoor: `${ROOT}/characters/guide01/nyp-char-connect-guide01-welcome-door-alpha-512-v01.webp`,
  questFlag: `${ROOT}/characters/guide01/nyp-char-connect-guide01-quest-flag-alpha-512-v01.webp`,
  paperBite: `${ROOT}/characters/guide01/nyp-char-q-paper-guide01-q-paper-alpha-512-v01.webp`,
  emailGuard: `${ROOT}/characters/guide01/nyp-char-q-email-guide01-q-email-alpha-512-v01.webp`,
  nextSeed: `${ROOT}/characters/guide01/nyp-char-q-seed-guide01-q-seed-alpha-512-v01.webp`,
} as const;

/**
 * 교수 추천 카드의 대체 이미지.
 *
 * 실제 교수 사진이 아니며, 공식 사진의 이용 허가가 확인되지 않았거나 사진이
 * 없는 경우에만 씁니다. 서로 다른 추천 역할을 구분할 수 있도록 세 가지 포즈를
 * 제공하지만 모두 동일한 가상 브랜드 캐릭터입니다.
 */
export const professorCharacter = {
  topic: `${ROOT}/characters/professor01/nyp-char-find-professor01-lecture-alpha-512-v01.webp`,
  method: `${ROOT}/characters/professor01/nyp-char-connect-professor01-answer-alpha-512-v01.webp`,
  perspective: `${ROOT}/characters/professor01/nyp-char-connect-professor01-listen-alpha-512-v01.webp`,
  profile: `${ROOT}/characters/professor01/nyp-char-connect-professor01-welcome-alpha-512-v01.webp`,
} as const;

/** 배경 장식. 전부 alpha PNG이며 alt=""와 aria-hidden으로 씁니다. */
export const brandDecoration = {
  radarRings: `${ROOT}/decorations/nyp-deco-all-radar-rings-alpha-1024-v01.png`,
  seedGrowth: `${ROOT}/decorations/nyp-deco-all-seed-growth-alpha-1024-v01.png`,
  paperFlow: `${ROOT}/decorations/nyp-deco-all-paper-flow-alpha-1024-v01.png`,
  questConfetti: `${ROOT}/decorations/nyp-deco-all-quest-confetti-alpha-1024-v01.png`,
  orbitMint: `${ROOT}/decorations/nyp-deco-all-orbit-mint-alpha-1024-v01.png`,
  orbitCobalt: `${ROOT}/decorations/nyp-deco-all-orbit-cobalt-alpha-1024-v01.png`,
  sparklesViolet: `${ROOT}/decorations/nyp-deco-all-sparkles-violet-alpha-1024-v01.png`,
  sparklesMint: `${ROOT}/decorations/nyp-deco-all-sparkles-mint-alpha-1024-v01.png`,
  waveViolet: `${ROOT}/decorations/nyp-deco-all-wave-violet-alpha-1024-v01.png`,
  waveCobalt: `${ROOT}/decorations/nyp-deco-all-wave-cobalt-alpha-1024-v01.png`,
  dotsViolet: `${ROOT}/decorations/nyp-deco-all-dots-violet-alpha-1024-v01.png`,
  dotsMint: `${ROOT}/decorations/nyp-deco-all-dots-mint-alpha-1024-v01.png`,
} as const;

/** 대표 장면을 <picture> 없이 <img srcSet>으로 쓸 때의 값. */
export function sceneSrcSet(set: SceneSet): string {
  const entries = [`${set.w1024} 1024w`, `${set.w1440} 1440w`];
  if (set.w1920) entries.push(`${set.w1920} 1920w`);
  return entries.join(", ");
}
