"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarCheck,
  Check,
  Download,
  EyeOff,
  FileText,
  Lightbulb,
  LoaderCircle,
  Search,
  ShieldCheck,
  User,
} from "lucide-react";
import {
  AppShell,
  Card,
  PageHeader,
  PrimaryButton,
} from "@/components/app/primitives";
import { cardsForTool, useQuestStore } from "@/store/quest-store";
import { useResearchStore } from "@/store/research-store";

/**
 * P-01 성장 포트폴리오.
 *
 * 교수님을 만난 결과가 아니라, 학생이 준비하고 바뀐 과정을 기록합니다.
 * 목업대로 타임라인 · 단계 상세 · 미리보기 3단으로 두고,
 * 학생이 저장한 결과물만 증거로 씁니다. 없는 단계는 채워 넣지 않습니다.
 */

type StepId = "topic" | "professor" | "paper" | "prepare" | "revision" | "actions";

const STEP_META: Array<{ id: StepId; label: string; hint: string; icon: typeof Search }> = [
  { id: "topic", label: "주제 탐색", hint: "탐색한 주제와 고민, 질문", icon: Search },
  { id: "professor", label: "교수 근거", hint: "관심 교수와 연결된 이유", icon: User },
  { id: "paper", label: "읽은 논문", hint: "핵심 논문과 인사이트", icon: BookOpenCheck },
  { id: "prepare", label: "면담 준비", hint: "준비한 질문과 면담 목표", icon: FileText },
  { id: "revision", label: "수정 전후", hint: "아이디어가 어떻게 발전했는지", icon: ArrowRight },
  { id: "actions", label: "7일 행동", hint: "면담 후 7일 동안의 행동", icon: CalendarCheck },
];

export function PortfolioBuilderScreen({ topicId = null }: { topicId?: string | null }) {
  const hasHydrated = useResearchStore((state) => state.hasHydrated);
  const conditions = useResearchStore((state) => state.conditions);
  const result = useResearchStore((state) => state.result);
  const selectedTopicId = useResearchStore((state) => state.selectedTopicId);
  const matches = useResearchStore((state) => state.professorMatches);
  const selectedProfessorId = useResearchStore((state) => state.selectedProfessorId);
  const knockKitDrafts = useResearchStore((state) => state.knockKitDrafts);
  const mentorLoopEntries = useResearchStore((state) => state.mentorLoopEntries);
  const discovery = useResearchStore((state) => state.professorDiscoverySummary);
  const selectedPaper = useResearchStore((state) => state.selectedProfessorPaper);
  const growthDirectionBaseline = useResearchStore((state) => state.growthDirectionBaseline);
  const growthProjectHistory = useResearchStore((state) => state.growthProjectHistory);
  const growthProfessorHistory = useResearchStore((state) => state.growthProfessorHistory);
  const questCards = useQuestStore((state) => state.cards);

  const [activeStep, setActiveStep] = useState<StepId>("topic");
  const [excluded, setExcluded] = useState<Set<StepId>>(new Set());
  const [maskPersonal, setMaskPersonal] = useState(true);
  const [onlySelected, setOnlySelected] = useState(true);

  const currentTopic = useMemo(() => {
    if (!result || !selectedTopicId) return null;
    if (result.kind === "ok") {
      return result.candidates.find((c) => c.topic.id === selectedTopicId)?.topic ?? null;
    }
    if (result.kind === "insufficient" && result.candidate.topic.id === selectedTopicId) {
      return result.candidate.topic;
    }
    return null;
  }, [result, selectedTopicId]);

  const requestedHistoricalProject = topicId
    ? growthProjectHistory.find((item) => item.topicId === topicId) ?? null
    : null;
  const topic = topicId && currentTopic?.id !== topicId ? null : currentTopic;

  const match = matches.find((item) => item.professor.id === selectedProfessorId) ?? matches[0] ?? null;
  const historicalProfessor = [...growthProfessorHistory]
    .reverse()
    .find((item) => item.selectedAt) ?? growthProfessorHistory.at(-1) ?? null;
  const historicalProject = requestedHistoricalProject ?? growthProjectHistory.at(-1) ?? null;
  const loopKey = topic && match ? `${topic.id}:${match.professor.id}` : null;
  const loop = loopKey ? mentorLoopEntries[loopKey] : null;
  const draft = loopKey ? knockKitDrafts[loopKey] : null;

  const rawProfessorName = match?.professor.name ?? historicalProfessor?.name ?? "";
  const rawProfessorTitle = match?.professor.title ?? historicalProfessor?.title ?? "교수";
  const professorName = rawProfessorName
    ? maskPersonal
      ? `${rawProfessorName.slice(0, 1)}○○ 교수님`
      : `${rawProfessorName} ${rawProfessorTitle}`
    : "";

  /** 수정 전후는 좌우로 비교해야 의미가 보이므로 줄 목록과 별개로 둡니다. */
  const revision = loop
    ? {
        before: [
          loop.before.question && `질문: ${loop.before.question}`,
          loop.before.methodDetail && `방법: ${loop.before.methodDetail}`,
          loop.before.scope && `범위: ${loop.before.scope}`,
        ].filter(Boolean) as string[],
        after: [
          loop.after.question && `질문: ${loop.after.question}`,
          loop.after.methodDetail && `방법: ${loop.after.methodDetail}`,
          loop.after.scope && `범위: ${loop.after.scope}`,
        ].filter(Boolean) as string[],
        insight: loop.feedbackSummary,
      }
    : null;

  const content = useMemo<Record<StepId, string[]>>(() => ({
    /*
     * 주제 탐색은 두 흐름에서 채워집니다.
     * 만들다를 거치면 conditions와 선택 주제가, 찾다만 이용하면
     * 그때 고른 전공·관심 분야·진로 고민이 들어옵니다.
     */
    topic: [
      conditions.major || discovery?.major || growthDirectionBaseline?.major
        ? `전공: ${conditions.major || discovery?.major || growthDirectionBaseline?.major}` : "",
      conditions.interests.length || discovery?.interests.length || growthDirectionBaseline?.interests.length
        ? `관심 분야: ${(conditions.interests.length
          ? conditions.interests
          : discovery?.interests.length
            ? discovery.interests
            : growthDirectionBaseline?.interests ?? []).join(" · ")}` : "",
      discovery?.careerConcerns.length || growthDirectionBaseline?.careerConcerns.length
        ? `진로 고민: ${(discovery?.careerConcerns.length ? discovery.careerConcerns : growthDirectionBaseline?.careerConcerns ?? []).join(" · ")}` : "",
      topic || historicalProject ? `선택한 주제: ${topic?.title ?? historicalProject?.title}` : "",
      topic || historicalProject ? `연구질문: ${topic?.question ?? historicalProject?.question}` : "",
    ].filter(Boolean),
    professor: match
      ? [
          `연결한 교수: ${professorName}`,
          `소속: ${match.professor.college} · ${match.professor.department}`,
          `연결 이유: ${match.reason}`,
          `직접 확인할 점: ${match.doesNotEstablish.join(" · ")}`,
        ]
      : historicalProfessor
        ? [
            `연결한 교수: ${professorName}`,
            `소속: ${historicalProfessor.college ? `${historicalProfessor.college} · ` : ""}${historicalProfessor.department}`,
            `연결 이유: ${historicalProfessor.reason}`,
          ]
        : [],
    paper: [
      ...(selectedPaper ? [
        `선택한 논문: ${selectedPaper.title}${selectedPaper.publishedDate ? ` (${selectedPaper.publishedDate})` : ""}`,
      ] : []),
      ...cardsForTool(questCards, "paper-bite").map((card) =>
        `${card.title}: ${card.body}${card.evidence?.page ? ` (p.${card.evidence.page})` : ""}`),
    ],
    prepare: [
      ...(draft ? draft.questions.map((question, i) => `준비한 질문 ${i + 1}: ${question}`) : []),
      ...cardsForTool(questCards, "first-line").map((card) => `첫마디(${card.title}): ${card.body}`),
      ...cardsForTool(questCards, "silence-rescue").map((card) => `대비 질문(${card.title}): ${card.body}`),
    ],
    revision: revision ? [...revision.before.map((l) => `수정 전 ${l}`), ...revision.after.map((l) => `수정 후 ${l}`)] : [],
    actions: [
      ...(loop ? loop.sevenDayActions.filter(Boolean).map((action, i) => `${i + 1}. ${action}`) : []),
      ...cardsForTool(questCards, "next-seed").map((card) => `${card.title}: ${card.body}`),
    ],
  }), [conditions, discovery, growthDirectionBaseline, historicalProject, topic, match, historicalProfessor, professorName, selectedPaper, questCards, draft, loop, revision]);

  if (!hasHydrated) {
    return (
      <div className="research-loading">
        <LoaderCircle className="spin" />
        <p>저장된 성장 기록을 불러오고 있어요.</p>
      </div>
    );
  }

  const toggleStep = (id: StepId) =>
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const recordedCount = STEP_META.filter((step) => content[step.id].length > 0).length;
  const previewSteps = STEP_META
    .filter((step) => !excluded.has(step.id))
    .filter((step) => !onlySelected || content[step.id].length > 0);
  const active = STEP_META.find((step) => step.id === activeStep) ?? STEP_META[0];
  const ActiveIcon = active.icon;
  const activeOrder = STEP_META.findIndex((step) => step.id === active.id) + 1;

  return (
    <AppShell title="포트폴리오 만들기" backHref="/portfolio" className="portfolio-screen">
      <PageHeader
        title="포트폴리오 만들기"
        description="교수님을 만난 결과가 아니라, 내가 준비하고 바뀐 과정을 기록해요."
      />

      <div className="portfolio-progress">
        <strong>{recordedCount} / 6 단계에 기록이 있어요</strong>
        <span>비어 있는 단계는 채워 넣지 않고 그대로 비워 둡니다.</span>
      </div>

      <div className="pf-layout">
        {/* 좌: 단계 타임라인 */}
        <ol className="pf-timeline">
          {STEP_META.map((step, order) => {
            const Icon = step.icon;
            const recorded = content[step.id].length > 0;
            return (
              <li key={step.id}>
                <button
                  type="button"
                  className={step.id === activeStep ? "is-active" : undefined}
                  aria-current={step.id === activeStep ? "step" : undefined}
                  onClick={() => setActiveStep(step.id)}
                >
                  <span className={recorded ? "pf-timeline__dot is-done" : "pf-timeline__dot"}>
                    {order + 1}
                  </span>
                  <span className="pf-timeline__text">
                    <Icon size={15} aria-hidden="true" />
                    <strong>{step.label}</strong>
                    <small>{step.hint}</small>
                  </span>
                  {recorded && <Check size={16} className="pf-timeline__check" aria-label="기록 있음" />}
                </button>
              </li>
            );
          })}
        </ol>

        {/* 중: 선택한 단계 상세 */}
        <section className="pf-detail">
          <header>
            <span className="pf-detail__order">{activeOrder}</span>
            <div>
              <h2><ActiveIcon size={17} aria-hidden="true" /> {active.label}</h2>
              <p>{active.hint}</p>
            </div>
          </header>

          {active.id === "revision" && revision ? (
            <>
              <div className="pf-compare">
                <article className="pf-compare__side pf-compare__side--before">
                  <h3>수정 전 (면담 전)</h3>
                  <ul>{revision.before.map((line) => <li key={line}>{line}</li>)}</ul>
                </article>
                <span className="pf-compare__arrow" aria-hidden="true"><ArrowRight size={18} /></span>
                <article className="pf-compare__side pf-compare__side--after">
                  <h3>수정 후 (면담 후)</h3>
                  <ul>{revision.after.map((line) => <li key={line}>{line}</li>)}</ul>
                </article>
              </div>
              {revision.insight && (
                <Card className="pf-insight">
                  <Lightbulb size={18} aria-hidden="true" />
                  <div>
                    <strong>어떤 점이 더 깊어지고 명확해졌나요?</strong>
                    <p>{revision.insight}</p>
                  </div>
                </Card>
              )}
            </>
          ) : content[active.id].length ? (
            <ul className="pf-detail__lines">
              {content[active.id].map((line) => <li key={line}>{line}</li>)}
            </ul>
          ) : (
            <p className="portfolio-step__empty">아직 저장한 기록이 없어요.</p>
          )}
        </section>

        {/* 우: 미리보기 구성 */}
        <aside className="pf-preview-panel">
          <h2>포트폴리오 미리보기</h2>
          <p className="pf-preview-panel__lead">선택한 항목으로 포트폴리오를 구성해요.</p>
          <ul className="pf-preview-panel__items">
            {STEP_META.map((step) => {
              const Icon = step.icon;
              const included = !excluded.has(step.id);
              return (
                <li key={step.id}>
                  <label>
                    <Icon size={15} aria-hidden="true" />
                    <span>
                      <strong>{step.label}</strong>
                      <small>{content[step.id].length ? `${content[step.id].length}개 항목` : "기록 없음"}</small>
                    </span>
                    <input
                      type="checkbox"
                      checked={included}
                      onChange={() => toggleStep(step.id)}
                      aria-label={`${step.label} 포함`}
                    />
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="pf-preview-panel__toggles">
            <label>
              <span><EyeOff size={15} aria-hidden="true" /> 개인정보 가리기</span>
              <input type="checkbox" checked={maskPersonal} onChange={() => setMaskPersonal((v) => !v)} />
            </label>
            <label>
              <span><Check size={15} aria-hidden="true" /> 기록 있는 단계만</span>
              <input type="checkbox" checked={onlySelected} onChange={() => setOnlySelected((v) => !v)} />
            </label>
          </div>

          <PrimaryButton
            className="portfolio-export"
            disabled={previewSteps.length === 0}
            onClick={() => window.print()}
          >
            <Download size={17} /> PDF로 내보내기
          </PrimaryButton>

          <Card className="pf-safety">
            <ShieldCheck size={17} aria-hidden="true" />
            <p>내 기록은 이 브라우저에만 있고, 내보내기는 내가 직접 진행합니다.</p>
          </Card>
        </aside>
      </div>

      {/* 인쇄 대상. 화면에서도 최종 결과를 그대로 확인할 수 있게 둡니다. */}
      <section className="portfolio-preview" id="portfolio-preview">
        <h2>성장 포트폴리오</h2>
        <p className="portfolio-preview__lead">
          교수님을 만난 결과가 아니라, 준비하고 바뀐 과정의 기록입니다.
        </p>
        {previewSteps.length === 0 ? (
          <p className="portfolio-step__empty">내보낼 기록이 아직 없어요.</p>
        ) : (
          previewSteps.map((step) => (
            <article key={step.id}>
              <h3>{step.label}</h3>
              {content[step.id].length ? (
                <ul>{content[step.id].map((line) => <li key={line}>{line}</li>)}</ul>
              ) : (
                <p className="portfolio-step__empty">기록 없음</p>
              )}
            </article>
          ))
        )}
      </section>

    </AppShell>
  );
}
