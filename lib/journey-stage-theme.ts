export type JourneyStage = "match" | "project" | "recommend" | "meeting";

export type JourneyStageTheme = {
  label: string;
  backgroundImage: string;
  accent: string;
  accentSoft: string;
  foreground: string;
  fallbackBackground: string;
};

const JOURNEY_STAGE_THEMES: Record<JourneyStage, JourneyStageTheme> = {
  match: {
    label: "교수 매칭",
    backgroundImage: "/brand/nyp-v03/scenes/journey/nyp-professor-match-canvas-1600x1000-v01.webp",
    accent: "#2f6edb",
    accentSoft: "#eaf2ff",
    foreground: "#102449",
    fallbackBackground: "#f2f7ff",
  },
  project: {
    label: "프로젝트 설계",
    backgroundImage: "/brand/nyp-v03/scenes/journey/nyp-journey-project-light-1600x560-v01.webp",
    accent: "#6847e8",
    accentSoft: "#eee9ff",
    foreground: "#101c3d",
    fallbackBackground: "#f5f2ff",
  },
  recommend: {
    label: "맞춤 교수 추천",
    backgroundImage: "/brand/nyp-v03/scenes/journey/nyp-journey-recommend-light-1600x560-v01.webp",
    accent: "#138f82",
    accentSoft: "#e4f7f2",
    foreground: "#10283d",
    fallbackBackground: "#eefaf7",
  },
  meeting: {
    label: "만남 준비",
    backgroundImage: "/brand/nyp-v03/scenes/journey/nyp-journey-meeting-light-1600x560-v02.webp",
    accent: "#e86c4d",
    accentSoft: "#fff0e9",
    foreground: "#2a1c2a",
    fallbackBackground: "#fff6f0",
  },
};

export function getJourneyStageTheme(stage: JourneyStage): JourneyStageTheme {
  return JOURNEY_STAGE_THEMES[stage];
}
