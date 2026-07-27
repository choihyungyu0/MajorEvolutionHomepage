import type { Conditions } from "@/lib/recommend";

export type IdeaMode = "free" | "trend" | "fusion";

export type IdeaModeOption = {
  id: IdeaMode;
  label: string;
  shortLabel: string;
  description: string;
  evidenceNote: string;
};

export const IDEA_MODES: IdeaModeOption[] = [
  {
    id: "free",
    label: "자유 브레인스토밍",
    shortLabel: "자유 탐색",
    description: "학과 안에서 문제부터 함께 찾기",
    evidenceNote: "사용자가 확인한 경험과 조건을 중심으로 탐색",
  },
  {
    id: "trend",
    label: "학과 × AI 트렌드",
    shortLabel: "AI 트렌드",
    description: "공식 연구·논문 근거로 기회 비교",
    evidenceNote: "공식 교수 프로필·공식 논문 목록만 근거로 사용",
  },
  {
    id: "fusion",
    label: "전공 융합",
    shortLabel: "전공 융합",
    description: "내 전공과 다른 전공을 연결해 탐색",
    evidenceNote: "두 전공의 공식 연구 키워드를 분리해 비교",
  },
];

export type CoDesignQuestion = {
  id: string;
  prompt: string;
  helper: string;
  options: string[];
  contextLabel: string;
  allowCustom?: boolean;
};

const COMMON_QUESTIONS: CoDesignQuestion[] = [
  {
    id: "target",
    prompt: "이번 아이디어로 가장 바꾸고 싶은 대상이나 상황은 무엇인가요?",
    helper: "대상을 좁히면 연구질문과 필요한 데이터가 선명해져요.",
    options: ["학생의 학습 경험", "지역 문제", "산업·조직의 업무", "아직 열어두기"],
    contextLabel: "바꾸고 싶은 대상",
    allowCustom: true,
  },
  {
    id: "problem",
    prompt: "그 대상이 지금 겪는 문제를 한 가지로 좁힌다면 무엇인가요?",
    helper: "해결책보다 먼저 관찰할 수 있는 문제를 정해 봐요.",
    options: ["정보를 찾기 어렵다", "판단 기준이 모호하다", "시간·비용이 많이 든다", "아직 잘 모르겠다"],
    contextLabel: "핵심 문제",
    allowCustom: true,
  },
  {
    id: "evidence",
    prompt: "문제를 확인할 때 실제로 접근 가능한 자료는 무엇인가요?",
    helper: "접근 권한이 없는 자료는 후보가 아니라 확인 질문으로 남겨요.",
    options: ["공개 데이터", "설문·인터뷰", "수업·프로젝트 기록", "교수·연구실 확인 필요"],
    contextLabel: "확인 가능한 자료",
    allowCustom: true,
  },
  {
    id: "method",
    prompt: "지금 수준에서 먼저 시도해 볼 방법은 무엇인가요?",
    helper: "가장 단순한 기준 방법부터 시작해도 괜찮아요.",
    options: ["문헌조사", "데이터 분석", "설문·인터뷰", "AI 모델 실험", "함께 정하고 싶다"],
    contextLabel: "우선 방법",
    allowCustom: true,
  },
  {
    id: "scope",
    prompt: "완료 시점에 반드시 남기고 싶은 결과물은 무엇인가요?",
    helper: "결과물을 정하면 두 후보의 범위와 첫 행동을 비교할 수 있어요.",
    options: ["연구계획서", "분석 리포트", "작동하는 프로토타입", "교수 면담용 브리프"],
    contextLabel: "목표 결과물",
    allowCustom: true,
  },
];

const MODE_FIRST_QUESTION: Record<IdeaMode, CoDesignQuestion> = {
  free: COMMON_QUESTIONS[0],
  trend: {
    id: "trend-focus",
    prompt: "학과의 최근 AI 융합 흐름에서 먼저 비교해 보고 싶은 변화는 무엇인가요?",
    helper: "공식 프로필에 근거가 없는 흐름은 ‘확인 필요’로 남겨요.",
    options: ["연구 방법의 변화", "새로운 데이터 활용", "현장 문제 해결", "아직 열어두기"],
    contextLabel: "트렌드 탐색 초점",
    allowCustom: true,
  },
  fusion: {
    id: "fusion-major",
    prompt: "내 전공과 연결해 보고 싶은 다른 전공은 무엇인가요?",
    helper: "전공 이름보다 빌려오고 싶은 관점·방법을 함께 생각해 봐요.",
    options: ["컴퓨터·AI", "디자인·미디어", "경제·경영", "보건·생명", "아직 열어두기"],
    contextLabel: "융합할 전공",
    allowCustom: true,
  },
};

export function questionsForMode(mode: IdeaMode): CoDesignQuestion[] {
  return [MODE_FIRST_QUESTION[mode], ...COMMON_QUESTIONS.slice(1)];
}

export type ConfirmedAnswer = {
  questionId: string;
  label: string;
  value: string;
  status: "사용자 확인";
};

export function conditionContext(conditions: Conditions): { label: string; value: string }[] {
  return [
    { label: "전공", value: conditions.major ?? "확인 필요" },
    { label: "관심", value: conditions.interests.join(" · ") || "확인 필요" },
    { label: "기간", value: conditions.period ?? "확인 필요" },
  ];
}

export function modeById(mode: IdeaMode | null): IdeaModeOption | undefined {
  return IDEA_MODES.find((item) => item.id === mode);
}
