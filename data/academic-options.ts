// 특정 학생의 전공에 치우치지 않는 대학생 공통 탐색 선택지.
// 학교·학과 이름은 추천 목록에 없어도 직접 입력할 수 있다.

export const UNIVERSITY_SUGGESTIONS = [
  "단국대학교",
  "강원대학교",
  "건국대학교",
  "경북대학교",
  "경희대학교",
  "고려대학교",
  "동국대학교",
  "부산대학교",
  "서강대학교",
  "서울대학교",
  "서울시립대학교",
  "성균관대학교",
  "숙명여자대학교",
  "연세대학교",
  "이화여자대학교",
  "전남대학교",
  "전북대학교",
  "중앙대학교",
  "충남대학교",
  "충북대학교",
  "한국외국어대학교",
  "한양대학교",
] as const;

export const MAJOR_AREAS = [
  "인문·언어",
  "사회·정책",
  "경영·경제",
  "자연과학",
  "공학·IT",
  "교육",
  "보건·의료",
  "예술·체육",
  "농림·식품",
  "융합·자유전공",
] as const;

export type MajorArea = (typeof MAJOR_AREAS)[number];

export const MAJOR_SUGGESTIONS: Record<MajorArea, readonly string[]> = {
  "인문·언어": [
    "국어국문학과",
    "영어영문학과",
    "사학과",
    "철학과",
    "문예창작과",
    "외국어학과",
  ],
  "사회·정책": [
    "정치외교학과",
    "행정학과",
    "사회학과",
    "미디어커뮤니케이션학과",
    "심리학과",
    "법학과",
  ],
  "경영·경제": [
    "경영학과",
    "경제학과",
    "무역학과",
    "회계학과",
    "금융학과",
    "식품자원경제학과",
  ],
  자연과학: [
    "수학과",
    "통계학과",
    "물리학과",
    "화학과",
    "생명과학과",
    "지구환경과학과",
  ],
  "공학·IT": [
    "컴퓨터공학과",
    "소프트웨어학과",
    "전자전기공학과",
    "기계공학과",
    "화학공학과",
    "산업공학과",
    "건축공학과",
  ],
  교육: [
    "교육학과",
    "국어교육과",
    "영어교육과",
    "수학교육과",
    "특수교육과",
    "유아교육과",
  ],
  "보건·의료": [
    "의학과",
    "간호학과",
    "약학과",
    "치의학과",
    "보건행정학과",
    "물리치료학과",
  ],
  "예술·체육": [
    "디자인학과",
    "음악학과",
    "미술학과",
    "영화학과",
    "체육학과",
    "공연예술학과",
  ],
  "농림·식품": [
    "식품공학과",
    "식품영양학과",
    "환경원예학과",
    "동물자원학과",
    "산림학과",
    "농업경제학과",
    "식품자원경제학과",
  ],
  "융합·자유전공": [
    "자유전공학부",
    "인공지능융합학과",
    "데이터사이언스학과",
    "반도체융합학과",
    "문화기술학과",
  ],
};

export const ALL_MAJOR_SUGGESTIONS = Array.from(
  new Set(MAJOR_AREAS.flatMap((area) => MAJOR_SUGGESTIONS[area])),
);

export const UNIVERSAL_INTEREST_TAGS = [
  "데이터 분석",
  "AI·머신러닝",
  "경영·창업",
  "경제·금융",
  "가격·시장",
  "사회·문화",
  "정책 효과",
  "교육·학습",
  "심리·행동",
  "소비자 행동",
  "건강·의료",
  "생명·바이오",
  "ESG·지속가능성",
  "도시·지역",
  "예술·디자인",
  "미디어·콘텐츠",
  "언어·커뮤니케이션",
  "식품·농업",
  "식품 소비",
  "텍스트 분석",
] as const;

export const LEGACY_MAJORS = [
  "수학",
  "식품자원경제학",
  "통계학",
  "컴퓨터공학",
  "경제학",
] as const;

const AREA_KEYWORDS: Record<MajorArea, readonly string[]> = {
  "인문·언어": ["국어", "영어", "언어", "문학", "문예", "사학", "역사", "철학"],
  "사회·정책": ["정치", "외교", "행정", "사회", "미디어", "커뮤니케이션", "심리", "법학", "정책"],
  "경영·경제": ["경영", "경제", "무역", "회계", "금융"],
  자연과학: ["수학", "통계", "물리", "화학", "생명과학", "지구과학", "천문"],
  "공학·IT": ["공학", "컴퓨터", "소프트웨어", "전자", "전기", "기계", "건축", "IT", "정보"],
  교육: ["교육", "교직", "사범"],
  "보건·의료": ["의학", "간호", "약학", "치의", "보건", "치료", "임상"],
  "예술·체육": ["예술", "디자인", "음악", "미술", "영화", "공연", "체육", "스포츠"],
  "농림·식품": ["농업", "농림", "산림", "원예", "식품", "동물자원"],
  "융합·자유전공": ["융합", "자유전공", "데이터사이언스", "인공지능", "반도체", "문화기술"],
};

const LEGACY_MAJOR_AREAS: Record<(typeof LEGACY_MAJORS)[number], MajorArea> = {
  수학: "자연과학",
  식품자원경제학: "농림·식품",
  통계학: "자연과학",
  컴퓨터공학: "공학·IT",
  경제학: "경영·경제",
};

export function normalizeAcademicInput(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function isMajorArea(value: unknown): value is MajorArea {
  return typeof value === "string" && MAJOR_AREAS.includes(value as MajorArea);
}

export function inferMajorArea(major: string): MajorArea | null {
  const normalized = normalizeAcademicInput(major, 80);
  if (!normalized) return null;

  for (const legacyMajor of LEGACY_MAJORS) {
    if (
      normalized === legacyMajor
      || normalized === `${legacyMajor}과`
      || normalized === `${legacyMajor}전공`
    ) {
      return LEGACY_MAJOR_AREAS[legacyMajor];
    }
  }

  for (const area of MAJOR_AREAS) {
    if (MAJOR_SUGGESTIONS[area].some((item) =>
      item.includes(normalized) || normalized.includes(item))) {
      return area;
    }
  }

  for (const area of MAJOR_AREAS) {
    if (AREA_KEYWORDS[area].some((keyword) => normalized.includes(keyword))) {
      return area;
    }
  }

  return null;
}

type AcademicProfileDefaultsInput = {
  school: string;
  major: string;
  interests: readonly string[];
};

type AcademicConditionDefaultsInput = {
  school: string;
  majorArea: MajorArea | null;
  major: string | null;
  interests: readonly string[];
};

type AcademicConditionDefaultsResult = {
  school: string;
  majorArea: MajorArea | null;
  major: string | null;
  interests: string[];
};

/**
 * 프로젝트 조건이 비어 있을 때만 저장된 프로필을 기본값으로 사용합니다.
 * 사용자가 프로젝트에서 직접 고른 값은 프로필보다 항상 우선합니다.
 */
export function mergeAcademicProfileDefaults(
  conditions: AcademicConditionDefaultsInput,
  profile: AcademicProfileDefaultsInput,
): AcademicConditionDefaultsResult {
  const school = normalizeAcademicInput(conditions.school, 80)
    || normalizeAcademicInput(profile.school, 80);
  const storedMajor = normalizeAcademicInput(conditions.major, 80);
  const profileMajor = normalizeAcademicInput(profile.major, 80);
  const major = storedMajor || profileMajor;
  const interests = conditions.interests.length
    ? conditions.interests
    : profile.interests;
  const normalizedInterests = Array.from(new Set(
    interests
      .map((interest) => normalizeAcademicInput(interest, 60))
      .filter(Boolean),
  )).slice(0, 3);

  return {
    school,
    majorArea: storedMajor
      ? conditions.majorArea || inferMajorArea(storedMajor)
      : inferMajorArea(profileMajor) || conditions.majorArea,
    major: major || null,
    interests: normalizedInterests,
  };
}
