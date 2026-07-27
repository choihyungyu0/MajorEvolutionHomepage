import type { ResearchTopic } from "@/data/research-mvp";
import type {
  ProfessorMatchResponse,
  ProfessorMatchTopic,
} from "@/lib/professor-domain";

type ErrorPayload = { error?: string };

export async function requestProfessorMatches(
  topic: ResearchTopic,
  major: string,
): Promise<ProfessorMatchResponse> {
  const payload: ProfessorMatchTopic = {
    id: topic.id,
    title: topic.title,
    question: topic.question,
    methodDetail: topic.methodDetail,
    scope: topic.scope,
    interests: topic.interests,
    methods: topic.methods,
    major,
  };
  const response = await fetch("/api/professors/match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic: payload }),
  });
  const data = await response.json() as ProfessorMatchResponse | ErrorPayload;
  if (!response.ok) {
    throw new Error("error" in data && data.error
      ? data.error
      : "공식 교수 데이터를 연결하지 못했습니다.");
  }
  return data as ProfessorMatchResponse;
}
