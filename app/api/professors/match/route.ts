import { NextResponse } from "next/server";
import {
  getOfficialProfessorRoleCandidates,
  matchOfficialProfessors,
} from "@/lib/professor-data.server";
import { AiServiceError, rerankProfessorMentors } from "@/lib/openai-server";
import { checkProfessorMatchAiRequestLimit } from "@/lib/professor-match-rate-limit";
import {
  PROFESSOR_MATCH_POLICY,
  SUPPORTED_PROFESSOR_UNIVERSITY,
  type ProfessorMatchTopic,
} from "@/lib/professor-domain";
import { getRateLimitStore } from "@/lib/rate-limit-store";

const MAX_BODY_BYTES = 12_000;

type BodyReadResult =
  | { ok: true; text: string }
  | { ok: false; status: 400 | 413; error: string };

async function readBodyWithinLimit(request: Request): Promise<BodyReadResult> {
  if (!request.body) return { ok: true, text: "" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel();
        return { ok: false, status: 413, error: "요청 데이터가 너무 큽니다." };
      }
      chunks.push(value);
    }
  } catch {
    try {
      await reader.cancel();
    } catch {
      // 이미 닫힌 스트림이면 추가 정리가 필요하지 않습니다.
    }
    return { ok: false, status: 400, error: "요청 본문을 읽지 못했습니다." };
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder().decode(bytes) };
}

function stringValue(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function stringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, maxItems)
    .map((item) => stringValue(item, maxLength))
    .filter(Boolean);
}

function normalizeTopic(value: unknown): ProfessorMatchTopic | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const topic: ProfessorMatchTopic = {
    id: stringValue(raw.id, 100),
    title: stringValue(raw.title, 160),
    question: stringValue(raw.question, 260),
    methodDetail: stringValue(raw.methodDetail, 260),
    scope: stringValue(raw.scope, 1_200),
    interests: stringArray(raw.interests, 5, 60),
    methods: stringArray(raw.methods, 5, 80),
    major: stringValue(raw.major, 80),
    university: stringValue(raw.university, 80),
    college: stringValue(raw.college, 80),
    goal: stringValue(raw.goal, 120),
    studentStage: stringValue(raw.studentStage, 120),
    secondaryMajorType: stringValue(raw.secondaryMajorType, 40),
    secondaryCollege: stringValue(raw.secondaryCollege, 80),
    secondaryMajor: stringValue(raw.secondaryMajor, 80),
    careerInterests: stringArray(raw.careerInterests, 3, 80),
    careerConcerns: stringArray(raw.careerConcerns, 2, 80),
    careerGoal: stringValue(raw.careerGoal, 160),
    meetingSituation: stringValue(raw.meetingSituation, 120),
    preferredSupport: stringValue(raw.preferredSupport, 160),
    experience: stringValue(raw.experience, 500),
    additionalContext: stringValue(raw.additionalContext, 500),
  };
  return topic.id && topic.title && topic.question ? topic : null;
}

function isDankookUniversity(value: string): boolean {
  const normalized = value.toLocaleLowerCase("ko-KR").replace(/\s+/g, "");
  return new Set([
    "단국대",
    "단국대학교",
    "dankook",
    "dankookuniversity",
  ]).has(normalized);
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "요청 데이터가 너무 큽니다." }, { status: 413 });
  }

  const bodyResult = await readBodyWithinLimit(request);
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }
  const rawBody = bodyResult.text;

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "요청 형식을 확인해 주세요." }, { status: 400 });
  }
  const raw = body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null;
  const topic = normalizeTopic(raw?.topic);
  if (!topic) {
    return NextResponse.json({ error: "선택한 연구주제 정보가 부족합니다." }, { status: 400 });
  }
  const university = stringValue(raw?.university, 80) || topic.university || "";
  if (!university) {
    return NextResponse.json(
      {
        code: "UNIVERSITY_REQUIRED",
        error: "교수님 연결에 사용할 학교를 먼저 선택해 주세요.",
      },
      { status: 400 },
    );
  }
  if (!isDankookUniversity(university)) {
    return NextResponse.json(
      {
        code: "UNIVERSITY_OUT_OF_SCOPE",
        error: `현재 교수님 연결은 ${SUPPORTED_PROFESSOR_UNIVERSITY} 공식 데이터 파일럿만 지원합니다.`,
      },
      { status: 422 },
    );
  }
  topic.university = SUPPORTED_PROFESSOR_UNIVERSITY;
  // 학생이 거절한 교수는 다시 찾을 때 후보에서 뺍니다.
  const excludeIds = stringArray(raw?.excludeIds, 20, 64);

  const isProjectMentorRequest = !topic.id.startsWith("discovery:")
    && !topic.id.startsWith("context:");
  const baseline = matchOfficialProfessors(topic, {
    excludeIds,
    journey: isProjectMentorRequest ? "project" : "student",
  });
  let response = baseline;
  if (isProjectMentorRequest) {
    const rateLimit = await checkProfessorMatchAiRequestLimit(request, {
      store: getRateLimitStore(),
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "AI 교수 멘토 연결 요청이 잠시 몰렸습니다. 잠시 후 다시 시도해 주세요." },
        {
          status: 429,
          headers: {
            "Cache-Control": "private, no-store",
            "Retry-After": String(rateLimit.retryAfterSec),
          },
        },
      );
    }

    try {
      const roleCandidates = getOfficialProfessorRoleCandidates(topic, {
        excludeIds,
        limitPerRole: 4,
      });
      const ranked = await rerankProfessorMentors(topic, roleCandidates);
      response = {
        ...baseline,
        matches: ranked.matches,
        rankingSource: "ai-reranked",
        rankingModel: ranked.model,
        note: `${baseline.note} AI는 이 공식 근거 후보 안에서 선택한 프로젝트의 주제·방법·범위에 맞는 멘토 역할을 재정렬했습니다.`,
      };
    } catch (error) {
      const serviceError = error instanceof AiServiceError
        ? error
        : new AiServiceError("upstream", "AI 멘토 재정렬을 완료하지 못했습니다.", 502);
      console.error("[professors/match/mentor-ranking]", serviceError.code);
      response = {
        ...baseline,
        note: `${baseline.note} AI 재정렬을 사용할 수 없어 공식 근거 규칙 결과로 이어갑니다.`,
      };
    }
  }

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "no-store",
      "X-Professor-Match-Policy": PROFESSOR_MATCH_POLICY,
    },
  });
}
