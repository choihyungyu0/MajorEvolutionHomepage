/**
 * Q-02 첫마디 랜덤박스 문장 생성.
 *
 * 규칙:
 * - 상황(수업 후·이메일·연구실)마다 말을 여는 방식이 다릅니다.
 * - 목적이 같으면 묻는 내용은 같고 표현만 달라집니다.
 * - AI 호출 없이 만들기 때문에 오프라인에서도 동작합니다.
 */

import type { EmailDraftPurpose } from "@/lib/email-draft-purpose";

export type FirstLineSituation = "after-class" | "email" | "office-hour";
export type FirstLinePurpose = EmailDraftPurpose;
export type FirstLineTone = "calm" | "bright" | "polite";

export const SITUATIONS: Array<{ id: FirstLineSituation; label: string; hint: string }> = [
  { id: "after-class", label: "수업 후", hint: "짧게, 한 가지만 여쭙는 상황" },
  { id: "email", label: "이메일", hint: "맥락을 먼저 밝히고 요청하는 상황" },
  { id: "office-hour", label: "연구실", hint: "시간을 정해 연구실로 찾아뵙는 상황" },
];

export const PURPOSES: Array<{ id: FirstLinePurpose; label: string }> = [
  { id: "career", label: "진로·수업 고민 상담" },
  { id: "research-interest", label: "논문·연구과제 관심" },
  { id: "project-review", label: "내 프로젝트 아이디어 점검" },
  { id: "mentoring", label: "멘토링·면담 요청" },
];

export const TONES: Array<{ id: FirstLineTone; label: string; hint: string }> = [
  { id: "calm", label: "차분하게", hint: "부담 없이 핵심부터 묻는 말투" },
  { id: "bright", label: "밝게", hint: "관심과 호기심이 자연스럽게 드러나는 말투" },
  { id: "polite", label: "공손하게", hint: "요청과 배려를 더 분명히 하는 말투" },
];

/**
 * 받침 유무에 따라 조사를 고릅니다.
 *
 * 연결 근거는 학생이 직접 입력하므로 끝 글자를 알 수 없습니다.
 * 「제목」이나 (설명)처럼 따옴표·괄호로 끝나는 경우가 많아 마지막 한글 음절까지 거슬러 봅니다.
 */
export function particle(word: string, withBatchim: string, withoutBatchim: string): string {
  const syllables = word.match(/[가-힣]/g);
  if (!syllables || syllables.length === 0) return withoutBatchim;
  const last = syllables[syllables.length - 1].charCodeAt(0) - 0xac00;
  return last % 28 === 0 ? withoutBatchim : withBatchim;
}

/** 상황과 말투별 여는 말. 다시 섞을 때 같은 말투 안에서 표현만 바뀝니다. */
const OPENERS: Record<FirstLineTone, Record<FirstLineSituation, string[]>> = {
  calm: {
    "after-class": [
      "교수님, 수업 후 잠깐 한 가지 여쭤봐도 될까요?",
      "교수님, 수업 내용과 관련해 짧게 질문드리고 싶습니다.",
      "교수님, 잠시 괜찮으시다면 한 가지만 여쭙고 싶습니다.",
    ],
    email: [
      "안녕하세요 교수님, 제 고민을 정리해 조언을 여쭙고자 메일 드립니다.",
      "교수님께 제 준비 방향을 차분히 여쭙고 싶어 연락드립니다.",
      "안녕하세요 교수님, 현재 고민 중인 내용을 두고 질문드리고 싶습니다.",
    ],
    "office-hour": [
      "교수님, 연구실에 찾아뵙고 한 가지 질문드려도 될까요?",
      "교수님, 연구실에서 잠시 조언을 여쭙고 싶습니다.",
      "교수님, 연구실에 찾아뵐 수 있다면 짧게 질문드리고 싶습니다.",
    ],
  },
  bright: {
    "after-class": [
      "교수님, 오늘 수업을 흥미롭게 들었는데 한 가지 여쭤봐도 될까요?",
      "교수님, 수업을 듣고 더 궁금해진 점이 있어 질문드리고 싶습니다.",
      "교수님, 오늘 배운 내용이 인상 깊어서 한 가지 더 여쭙고 싶습니다.",
    ],
    email: [
      "안녕하세요 교수님, 관심 분야를 알아보다 궁금한 점이 생겨 메일 드립니다.",
      "교수님의 연구를 흥미롭게 살펴보다 질문이 생겨 연락드립니다.",
      "안녕하세요 교수님, 제 관심을 더 구체화하고 싶어 밝은 마음으로 질문드립니다.",
    ],
    "office-hour": [
      "교수님, 연구실에서 제 관심 주제에 관해 이야기 나눌 수 있을까요?",
      "교수님, 더 배우고 싶은 점이 있어 연구실로 찾아뵙고 싶습니다.",
      "교수님, 연구실에서 궁금한 점을 여쭐 기회를 부탁드려도 될까요?",
    ],
  },
  polite: {
    "after-class": [
      "교수님, 괜찮으시다면 수업 후 잠시 질문드려도 될까요?",
      "교수님, 실례가 되지 않는다면 한 가지 여쭙고 싶습니다.",
      "교수님, 시간 괜찮으실 때 짧게 질문드려도 될지 여쭙습니다.",
    ],
    email: [
      "안녕하세요 교수님, 바쁘신 중에 죄송하지만 조언을 여쭙고자 메일 드립니다.",
      "교수님께 정중히 조언을 부탁드리고 싶어 연락드립니다.",
      "안녕하세요 교수님, 가능하시다면 제 질문에 조언을 부탁드리고자 합니다.",
    ],
    "office-hour": [
      "교수님, 가능하시다면 연구실에 찾아뵈어도 될지 여쭙습니다.",
      "교수님, 편하신 시간에 연구실로 찾아뵙고 조언을 구해도 될까요?",
      "교수님, 괜찮으시다면 연구실에서 20분 정도 시간을 부탁드려도 될까요?",
    ],
  },
};

/** 목적별 묻는 말 3가지. 묻는 내용은 같고 표현만 달라집니다. */
const ASKS: Record<FirstLinePurpose, Array<(evidence: string) => string>> = {
  career: [
    (e) => `${e}${particle(e, "을", "를")} 고민하고 있는데, 학부생이 먼저 해볼 수업이나 경험이 무엇인지 여쭙고 싶습니다.`,
    (e) => `${e}와 관련된 진로를 알아볼 때 지금 가장 먼저 확인해 볼 선택지가 무엇인지 궁금합니다.`,
    (e) => `${e} 방향이 저와 맞는지 알아보기 위해 이번 학기에 해볼 작은 경험을 추천해 주실 수 있을까요?`,
  ],
  "research-interest": [
    (e) => `${e}${particle(e, "을", "를")} 살펴봤는데, 이 연구에서 가장 중요하게 본 질문이 무엇인지 여쭙고 싶습니다.`,
    (e) => `${e}${particle(e, "과", "와")} 관련된 연구를 더 이해하려면 어떤 개념이나 공개 자료부터 보면 좋을까요?`,
    (e) => `${e} 분야에 관심 있는 학부생이 연구를 배우기 위해 먼저 준비할 것은 무엇인지 궁금합니다.`,
  ],
  "project-review": [
    (e) => `${e} 아이디어를 작은 프로젝트로 시작한다면 범위를 어디까지 줄이는 것이 좋을까요?`,
    (e) => `${e}${particle(e, "을", "를")} 실제로 검토할 때 데이터나 방법에서 먼저 확인해야 할 점이 무엇인지 여쭙고 싶습니다.`,
    (e) => `${e} 프로젝트의 질문을 더 분명하게 만들려면 어떤 부분부터 고쳐보면 좋을까요?`,
  ],
  mentoring: [
    (e) => `${e}와 관련해 제 방향을 정리하고 싶은데, 지금 가장 먼저 점검해야 할 기준이 무엇일까요?`,
    (e) => `${e}${particle(e, "을", "를")} 두고 제가 먼저 해본 뒤 다시 확인하면 좋을 행동을 조언해 주실 수 있을까요?`,
    (e) => `${e} 고민을 앞으로 스스로 풀어가기 위해 이번 달에 해볼 한 가지를 추천해 주실 수 있을까요?`,
  ],
};

export type FirstLineInput = {
  situation: FirstLineSituation;
  purpose: FirstLinePurpose;
  /** 질문을 구체화할 연결 맥락. 비어 있으면 문장을 만들지 않습니다. */
  evidence: string;
  /** 다시 섞기를 누를 때마다 증가합니다. */
  shuffle: number;
};

export type FirstLineSentence = {
  id: string;
  text: string;
  purposeLabel: string;
  toneLabel: string;
};

const PURPOSE_LABEL = new Map(PURPOSES.map((item) => [item.id, item.label]));
const TONE_LABEL = new Map(TONES.map((item) => [item.id, item.label]));

export type SingleFirstLineInput = FirstLineInput & { tone: FirstLineTone };

export function buildFirstLine(input: SingleFirstLineInput): FirstLineSentence | null {
  const evidence = input.evidence.trim();
  if (!evidence) return null;
  const openers = OPENERS[input.tone][input.situation];
  const asks = ASKS[input.purpose];
  const openerIndex = input.shuffle % openers.length;
  const toneIndex = TONES.findIndex((tone) => tone.id === input.tone);
  const askIndex = (input.shuffle * 2 + Math.max(0, toneIndex)) % asks.length;

  return {
    id: `${input.situation}-${input.purpose}-${input.tone}-${input.shuffle}`,
    text: `${openers[openerIndex]} ${asks[askIndex](evidence)}`,
    purposeLabel: PURPOSE_LABEL.get(input.purpose) ?? "",
    toneLabel: TONE_LABEL.get(input.tone) ?? "",
  };
}

export function buildFirstLines(input: FirstLineInput): FirstLineSentence[] {
  return TONES.map((tone, index) => buildFirstLine({
    ...input,
    tone: tone.id,
    shuffle: input.shuffle + index,
  })).filter((sentence): sentence is FirstLineSentence => Boolean(sentence));
}
