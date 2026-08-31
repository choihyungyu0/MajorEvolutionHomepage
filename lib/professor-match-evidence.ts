import type { ProfessorMatchTopic } from "@/lib/professor-domain";

export type ProfessorRoleEvidenceText = {
  topic: string;
  method: string;
  context: string;
};

/**
 * 주제·방법의 직접 입력과 대화 목적의 보조 입력을 역할별로 분리합니다.
 * 전공은 학업 소속 자리에서만 사용하고, TOPIC·METHOD의 내용 적합도에는 섞지 않습니다.
 * 만날 상황은 교수의 가능 여부 근거가 아니므로 여기에도 넣지 않습니다.
 */
export function buildProfessorRoleEvidenceText(
  topic: ProfessorMatchTopic,
): ProfessorRoleEvidenceText {
  const explicitResearchQuestion = topic.id.startsWith("discovery:")
    ? ""
    : topic.question;
  return {
    topic: [
      topic.title,
      explicitResearchQuestion,
      ...topic.interests,
    ].filter(Boolean).join(" "),
    method: [topic.methodDetail, ...topic.methods].filter(Boolean).join(" "),
    context: [
      ...(topic.careerInterests ?? []),
      topic.preferredSupport,
      topic.experience,
    ].filter(Boolean).join(" "),
  };
}

/**
 * 교수의 공식 연구분야·논문과 직접 대조할 입력만 반환합니다.
 * 진로 고민·학년·만남 방식·자유 맥락은 면담 질문 개인화에만 사용합니다.
 */
export function buildProfessorEvidenceText(topic: ProfessorMatchTopic): string {
  /*
   * 찾다 폼에서 자동 생성한 질문에는
   * “전공 관점에서 어떻게 탐색할 수 있을까” 같은 안내 문장이 들어갑니다.
   * 이를 공식 연구분야와 대조하면 ‘에서’, ‘관점에서’ 같은 조사성 표현이
   * 일치 근거로 오인될 수 있으므로, discovery 주제에서는 질문을 제외합니다.
   * 만들다에서 학생이 확정한 연구질문은 기존처럼 근거 검색에 사용합니다.
   */
  const explicitResearchQuestion = topic.id.startsWith("discovery:")
    ? ""
    : topic.question;
  return [
    topic.title,
    explicitResearchQuestion,
    topic.methodDetail,
    topic.major,
    topic.secondaryMajor,
    ...topic.interests,
    ...(topic.careerInterests ?? []),
    ...topic.methods,
  ].filter(Boolean).join(" ");
}
