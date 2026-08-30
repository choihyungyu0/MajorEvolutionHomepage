import type { ResearchTopic } from "@/data/research-mvp";
import type { RecommendResult } from "@/lib/recommend";
import type { ProfessorMatchTopic, ProfessorPaperSelection } from "@/lib/professor-domain";

type TopicState = {
  result: RecommendResult | null;
  selectedTopicId: string | null;
  professorDiscoveryTopic: ProfessorMatchTopic | null;
};

/** 선택한 공식 논문 자체를 첫 질문·메일의 중립적인 학생 맥락으로 변환합니다. */
export function createProfessorPaperQuestTopic(
  selection: ProfessorPaperSelection,
): ResearchTopic {
  const id = `paper:${selection.professorId}:${selection.paperId}`;
  return {
    id,
    pairId: id,
    variant: "안전 축소형",
    title: selection.title,
    majors: selection.professorDepartment ? [selection.professorDepartment] : [],
    interests: [],
    methods: ["문헌조사"],
    minWeeks: 4,
    goodDataAccess: ["아직 모름"],
    avoidTags: [],
    question: `「${selection.title}」를 바탕으로 교수님께 무엇을 질문할까요?`,
    reason: "학생이 대학 공식 프로필에서 직접 선택한 논문을 첫 대화 맥락으로 사용합니다.",
    userConfirmed: [selection.professorName, selection.professorDepartment, selection.title].filter(Boolean),
    aiProposed: [],
    dataOptions: [],
    methodDetail: "선택한 논문의 공식 서지정보와 직접 확인한 내용을 바탕으로 질문 준비",
    scope: "논문 한 편을 바탕으로 한 첫 질문과 이메일 준비",
    uncertainties: ["교수님의 지도·면담 가능 여부는 공식 안내와 직접 연락으로 확인해야 합니다."],
    firstAction: "선택한 논문의 제목과 출처를 확인하고 궁금한 점 한 가지를 적기",
    evidence: [{
      id: selection.paperId,
      title: selection.title,
      type: "대학 공식 프로필 논문 목록",
      verifiedAt: selection.selectedAt.slice(0, 10),
    }],
  };
}

/**
 * 만들다에서 고른 연구주제와 튜토리얼에서 정리한 고민을 하나의 대화 맥락으로 읽습니다.
 *
 * 튜토리얼 이용자는 연구주제를 만들지 않아도 교수 연결과 첫 대화 준비를 시작할 수 있습니다.
 * 이때 새 사실을 만들어내지 않고, 학생이 확인한 입력만 ResearchTopic 계약으로 옮깁니다.
 */
export function resolveJourneyTopic({
  result,
  selectedTopicId,
  professorDiscoveryTopic,
}: TopicState): ResearchTopic | null {
  // 학생이 현재 ‘찾다’에서 입력한 맥락은 과거 프로젝트 선택보다 최신 첫 대화의 기준입니다.
  if (professorDiscoveryTopic) {
    const title = professorDiscoveryTopic.title.trim()
      || professorDiscoveryTopic.question.trim();
    if (title) {
      return {
        id: professorDiscoveryTopic.id,
        pairId: `student-context:${professorDiscoveryTopic.id}`,
        variant: "안전 축소형",
        title,
        majors: professorDiscoveryTopic.major ? [professorDiscoveryTopic.major] : [],
        interests: professorDiscoveryTopic.interests,
        methods: professorDiscoveryTopic.methods,
        minWeeks: 4,
        goodDataAccess: ["아직 모름"],
        avoidTags: [],
        problem: professorDiscoveryTopic.additionalContext || undefined,
        question: professorDiscoveryTopic.question.trim() || title,
        reason: "튜토리얼에서 학생이 확인한 고민을 첫 대화 맥락으로 사용합니다.",
        userConfirmed: [
          professorDiscoveryTopic.major,
          ...professorDiscoveryTopic.interests,
          ...professorDiscoveryTopic.careerConcerns ?? [],
        ].filter(Boolean),
        aiProposed: [],
        dataOptions: [],
        methodDetail: professorDiscoveryTopic.methodDetail.trim()
          || "교수님과 대화하며 필요한 정보와 다음 행동을 확인",
        scope: professorDiscoveryTopic.scope.trim() || "첫 대화에서 확인할 범위",
        uncertainties: [
          "교수님의 지도·면담 가능 여부는 공식 안내와 직접 연락으로 확인해야 합니다.",
        ],
        firstAction: "선택한 교수님의 공식 정보를 확인하고 첫 질문을 준비하기",
        evidence: [],
      };
    }
  }

  if (result && selectedTopicId) {
    if (result.kind === "ok") {
      const selected = result.candidates.find(
        (candidate) => candidate.topic.id === selectedTopicId,
      );
      if (selected) return selected.topic;
    }
    if (
      result.kind === "insufficient"
      && result.candidate.topic.id === selectedTopicId
    ) {
      return result.candidate.topic;
    }
  }

  return null;
}
