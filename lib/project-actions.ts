import type { Idea, Professor, StudentProfile } from "@/data/prototype";
import type { EditablePassport } from "@/data/prototype";
import type { QuestNotes } from "@/store/prototype-store";

type ProjectExportInput = {
  profile: StudentProfile;
  idea: Idea;
  professor: Professor;
  passport: EditablePassport;
  questions: string[];
  emailDraft: string;
  questNotes: QuestNotes;
};

function safeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "전공진화-프로젝트";
}

export function downloadText(filename: string, content: string, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function buildProjectMarkdown(input: ProjectExportInput) {
  const { profile, idea, professor, passport, questions, emailDraft, questNotes } = input;
  return `# ${idea.title}\n\n- 이름: ${profile.name || "미입력"}\n- 전공: ${profile.major || "미입력"}${profile.minor ? ` / ${profile.minor}` : ""}\n- 유형·기간: ${idea.type} / ${idea.weeks}주\n- 면담 후보: ${professor.name}\n\n## 문제\n${passport.problem}\n\n## 연구 질문\n${passport.question}\n\n## 데이터 계획\n${questNotes.dataPlan}\n\n## 방법 계획\n${questNotes.methodPlan}\n\n## 예상 결과물\n${passport.output}\n\n## 위험과 확인 사항\n${passport.risks}\n\n## 교수 면담 질문\n${questions.map((question, index) => `${index + 1}. ${question}`).join("\n")}\n\n## 면담 요청 이메일\n${emailDraft}\n\n## 포트폴리오 문장\n${questNotes.portfolio}\n`;
}

export function downloadProjectMarkdown(input: ProjectExportInput) {
  downloadText(`${safeFilename(input.idea.title)}.md`, buildProjectMarkdown(input), "text/markdown;charset=utf-8");
}

function formatIcsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function downloadProjectCalendar(idea: Idea) {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + idea.weeks * 7);
  const stamp = new Date();
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Major Evolution//Project Plan//KO",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${Date.now()}@major-evolution.local`,
    `DTSTAMP:${formatIcsDate(stamp)}`,
    `DTSTART:${formatIcsDate(start)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${escapeIcs(idea.title)}`,
    `DESCRIPTION:${escapeIcs(`${idea.weeks}주 전공진화 프로젝트: ${idea.question}`)}`,
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    "DESCRIPTION:전공진화 프로젝트 시작 알림",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  downloadText(`${safeFilename(idea.title)}-일정.ics`, ics, "text/calendar;charset=utf-8");
}

export function openEmailDraft(professor: Professor, idea: Idea, emailDraft: string) {
  const subject = `[면담 요청] ${idea.title} 프로젝트 관련 문의`;
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailDraft.replace("교수님", professor.name))}`;
}

