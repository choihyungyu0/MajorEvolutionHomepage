import { NextResponse } from "next/server";
import { matchOfficialProfessors } from "@/lib/professor-data.server";
import type { ProfessorMatchTopic } from "@/lib/professor-domain";

const MAX_BODY_BYTES = 12_000;

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
    scope: stringValue(raw.scope, 220),
    interests: stringArray(raw.interests, 6, 80),
    methods: stringArray(raw.methods, 5, 80),
    major: stringValue(raw.major, 80),
  };
  return topic.id && topic.title && topic.question ? topic : null;
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "요청 데이터가 너무 큽니다." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 형식을 확인해 주세요." }, { status: 400 });
  }
  const rawTopic = body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>).topic
    : null;
  const topic = normalizeTopic(rawTopic);
  if (!topic) {
    return NextResponse.json({ error: "선택한 연구주제 정보가 부족합니다." }, { status: 400 });
  }

  return NextResponse.json(matchOfficialProfessors(topic), {
    headers: { "Cache-Control": "no-store" },
  });
}
