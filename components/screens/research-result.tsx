"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  Database,
  ExternalLink,
  FlaskConical,
  Info,
  LoaderCircle,
  RotateCw,
  ShieldCheck,
  Sliders,
  Sparkles,
  Timer,
} from "lucide-react";
import { AppShell, Card, PrimaryButton, SecondaryButton, Tag, cx } from "@/components/app/primitives";
import { JourneyStageHero } from "@/components/app/journey-stage-hero";
import { guideCharacter } from "@/lib/brand-assets";
import { modeById } from "@/data/co-design";
import {
  PROFESSOR_DATA_NOTE,
  PROFESSOR_DISCLAIMER,
  type CheckStatus,
} from "@/data/research-mvp";
import { isDankookUniversity } from "@/lib/professor-discovery-client";
import { requestProfessorMatches } from "@/lib/professor-client";
import { ProfessorMatchRequestAbortedError } from "@/lib/professor-match-http";
import type {
  ProfessorMatch,
  ProfessorMatchResponse,
  ProfessorMatchRole,
  ProfessorMatchStrength,
} from "@/lib/professor-domain";
import { resolveProfessorPortrait } from "@/lib/professor-photo";
import { CRITERION_LABELS, type CriterionKey, type TopicWithChecks } from "@/lib/recommend";
import {
  RESULT_PAGE_STEPS,
  projectProfessorRequestCompleted,
  resultPagePrimaryAction,
  type ResultPageView,
} from "@/lib/result-page-flow";
import { useResearchStore } from "@/store/research-store";
import styles from "./research-result-hierarchy.module.css";

const STATUS_TONE: Record<CheckStatus, string> = { "확인됨": "ok", "조건부": "cond", "확인 필요": "need" };
function StatusPill({ status }: { status: CheckStatus }) {
  const Icon = status === "확인됨" ? CircleCheck : status === "조건부" ? CircleDashed : CircleAlert;
  return (
    <span className={cx("status-pill", `status-pill--${STATUS_TONE[status]}`)}>
      <Icon size={13} /> {status}
    </span>
  );
}

const CRIT_ICON: Record<CriterionKey, typeof Database> = {
  personalLink: Info,
  dataAccess: Database,
  method: FlaskConical,
  period: Timer,
  uncertainty: ShieldCheck,
};

function ResultPageSteps({ current, hasSelection }: {
  current: "summary" | "compare";
  hasSelection: boolean;
}) {
  return (
    <nav className={styles.pageSteps} aria-label="프로젝트 결과 진행 단계">
      {RESULT_PAGE_STEPS.map((step, index) => {
        const active = step.id === current;
        const complete = current === "compare" && step.id === "summary";
        const ready = step.id === "professors" && hasSelection;
        const marker = String(index + 1);
        const content = (
          <>
            <span>{marker}</span>
            <strong>{step.label}</strong>
          </>
        );
        if (step.id === "professors") {
          return (
            <span
              key={step.id}
              className={cx(!hasSelection && styles.pageStepDisabled, ready && styles.pageStepReady)}
              aria-disabled={!hasSelection}
            >
              {content}
            </span>
          );
        }
        return (
          <Link
            key={step.id}
            href={step.href}
            className={cx(active && styles.pageStepActive, complete && styles.pageStepComplete)}
            aria-current={active ? "step" : undefined}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}

function CandidateSummaryCard({
  candidate,
  label,
  selected,
  onSelect,
}: {
  candidate: TopicWithChecks;
  label: "A" | "B";
  selected: boolean;
  onSelect: () => void;
}) {
  const topic = candidate.topic;
  const checks = Object.values(candidate.checks);
  const confirmedCount = checks.filter((check) => check.status === "확인됨").length;
  const needCount = checks.filter((check) => check.status === "확인 필요").length;
  return (
    <article className={cx(styles.summaryCandidate, selected && styles.summaryCandidateSelected)}>
      <header>
        <span className="cand-badge">{label}</span>
        <Tag tone={topic.variant === "안전 축소형" ? "mint" : "violet"}>{topic.variant}</Tag>
        {selected ? <strong className={styles.selectedBadge}>선택됨</strong> : null}
      </header>
      <h2>{topic.title}</h2>
      <p className={styles.summaryQuestion}>{topic.question}</p>
      <div className={styles.summaryFacts}>
        <div><Database size={16} /><span>데이터</span><strong>{topic.dataOptions[0]?.name ?? "확인 필요"}</strong></div>
        <div><FlaskConical size={16} /><span>방법</span><strong>{topic.methodDetail}</strong></div>
        <div><Timer size={16} /><span>범위</span><strong>{topic.scope}</strong></div>
      </div>
      <div className={styles.summaryStatus}>
        <span><CircleCheck size={14} /> 확인됨 {confirmedCount}</span>
        <span><CircleAlert size={14} /> 확인 필요 {needCount}</span>
      </div>
      <button type="button" className={cx("cand-select", selected && "is-selected")} onClick={onSelect} aria-pressed={selected}>
        {selected ? "이 후보를 선택했어요" : "이 후보 선택"}
      </button>
    </article>
  );
}

function CriterionDisclosure({
  criterion,
  candidates,
  defaultOpen = false,
}: {
  criterion: CriterionKey;
  candidates: [TopicWithChecks, TopicWithChecks];
  defaultOpen?: boolean;
}) {
  const Icon = CRIT_ICON[criterion];
  const left = candidates[0].checks[criterion];
  const right = candidates[1].checks[criterion];
  return (
    <details className={styles.criterionDisclosure} open={defaultOpen || undefined}>
      <summary>
        <span><Icon size={17} /> {CRITERION_LABELS[criterion]}</span>
        <span className={styles.criterionStatuses}>
          <span>A <StatusPill status={left.status} /></span>
          <span>B <StatusPill status={right.status} /></span>
        </span>
      </summary>
      <div className={styles.criterionSides}>
        <article>
          <strong>후보 A · {candidates[0].topic.title}</strong>
          <StatusPill status={left.status} />
          <p>{left.note}</p>
        </article>
        <article>
          <strong>후보 B · {candidates[1].topic.title}</strong>
          <StatusPill status={right.status} />
          <p>{right.note}</p>
        </article>
      </div>
    </details>
  );
}

function CandidateCard({ cand, label, selected, onSelect }: { cand: TopicWithChecks; label: "A" | "B"; selected: boolean; onSelect: () => void }) {
  const t = cand.topic;
  return (
    <article className={cx("cand-card", selected && "is-selected")}>
      <header className="cand-card__head">
        <span className="cand-badge">{label}</span>
        <Tag tone={t.variant === "안전 축소형" ? "mint" : "violet"}>{t.variant}</Tag>
      </header>
      <h2>{t.title}</h2>
      <p className="cand-q"><strong>연구질문</strong> {t.question}</p>

      <div className="cand-reason">
        <strong>내 조건과 연결</strong>
        <p>{t.reason}</p>
        {(cand.matchedInterests.length > 0 || cand.matchedMethods.length > 0) && (
          <div className="tag-row">
            {cand.matchedInterests.map((i) => <Tag key={i} tone="blue">{i}</Tag>)}
            {cand.matchedMethods.map((m) => <Tag key={m}>{m}</Tag>)}
          </div>
        )}
      </div>

      <dl className="cand-meta">
        <div>
          <dt><Database size={14} /> 데이터 후보</dt>
          <dd>
            {t.dataOptions.map((d) => (
              <span key={d.name} className="cand-data-row">{d.name} <StatusPill status={d.status} /></span>
            ))}
          </dd>
        </div>
        <div><dt><FlaskConical size={14} /> 방법</dt><dd>{t.methodDetail}</dd></div>
        <div><dt><Timer size={14} /> 예상 범위</dt><dd>{t.scope}</dd></div>
        <div><dt><ShieldCheck size={14} /> 확인할 점</dt><dd>{t.uncertainties.join(" ")}</dd></div>
      </dl>

      <div className="cand-first">
        <strong>첫 30분 행동</strong>
        <p>{t.firstAction}</p>
      </div>

      <div className="cand-src">
        <ShieldCheck size={13} /> 근거 {t.evidence.length}개 · {t.evidence.map((e) => e.type).join(", ")} · 최근 확인 {t.evidence[0]?.verifiedAt}
      </div>

      <button type="button" className={cx("cand-select", selected && "is-selected")} onClick={onSelect} aria-pressed={selected}>
        {selected ? "선택됨" : "이 주제로 선택"}
      </button>
    </article>
  );
}

/**
 * 전공 진화 실험실 — 한 질문씩 공동설계 + 아이디어 1·2 비교.
 *
 * 와이어프레임대로 왼쪽에 공동설계 진행 상태를 두고, 오른쪽 두 아이디어를
 * 같은 다섯 항목(방법·데이터·범위·불확실성·첫 행동)으로 나란히 비교합니다.
 * 어느 쪽이 더 낫다는 점수는 표시하지 않습니다.
 */
const DESIGN_STEPS = [
  { id: "problem", label: "문제" },
  { id: "target", label: "대상" },
  { id: "method", label: "방법" },
  { id: "evidence", label: "데이터" },
  { id: "scope", label: "범위" },
] as const;

function IdeaLab({
  candidates,
  answers,
  selectedTopicId,
  onSelect,
}: {
  candidates: TopicWithChecks[];
  answers: { questionId: string; label: string; value: string }[];
  selectedTopicId: string | null;
  onSelect: (id: string) => void;
}) {
  const answerFor = (id: string) => answers.find((a) => a.questionId === id) ?? null;

  return (
    <div className="lab-layout">
      <Card className="lab-panel">
        <h2>한 질문씩 공동설계</h2>
        <ol>
          {DESIGN_STEPS.map((step) => {
            const answer = answerFor(step.id);
            return (
              <li key={step.id} className={answer ? "is-done" : undefined}>
                <span className="lab-panel__dot" aria-hidden="true" />
                <div>
                  <strong>{step.label}</strong>
                  <p>{answer ? answer.value : "아직 확인 전"}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      <div className="lab-ideas">
        {candidates.map((candidate, index) => {
          const t = candidate.topic;
          const selected = selectedTopicId === t.id;
          const rows: Array<[string, ReactNode]> = [
            ["방법", t.methodDetail],
            ["데이터", t.dataOptions.map((d) => d.name).join(" · ")],
            ["범위", t.scope],
            ["불확실성", t.uncertainties.join(" ")],
            ["첫 행동", t.firstAction],
          ];
          return (
            <article key={t.id} className={cx("lab-idea", selected && "is-selected")}>
              <span className="lab-idea__index">아이디어 {index + 1}</span>
              <h3>{t.question}</h3>
              <p className="lab-idea__title">{t.title}</p>
              <dl>
                {rows.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <button
                type="button"
                className={cx("lab-idea__select", selected && "is-selected")}
                aria-pressed={selected}
                onClick={() => onSelect(t.id)}
              >
                {selected ? "선택됨" : "이 주제로 선택"}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function IdeaComparisonTable({
  candidates,
  selectedTopicId,
  onSelect,
}: {
  candidates: [TopicWithChecks, TopicWithChecks];
  selectedTopicId: string | null;
  onSelect: (id: string) => void;
}) {
  const labels = ["A", "B"] as const;
  const cell = (candidate: TopicWithChecks, index: number) => {
    const topic = candidate.topic;
    return (
      <div className="idea-compare-head">
        <span className="cand-badge">{labels[index]}</span>
        <div>
          <Tag tone={topic.variant === "안전 축소형" ? "mint" : "violet"}>{topic.variant}</Tag>
          <strong>{topic.title}</strong>
        </div>
      </div>
    );
  };

  return (
    <div className="idea-compare-scroll" tabIndex={0} aria-label="연구 아이디어 2개 비교표">
      <table className="idea-compare-table">
        <caption>두 연구 아이디어를 같은 항목으로 비교</caption>
        <thead>
          <tr>
            <th scope="col">비교 항목</th>
            {candidates.map((candidate, index) => (
              <th scope="col" key={candidate.topic.id}>{cell(candidate, index)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">문제 정의</th>
            {candidates.map(({ topic }) => (
              <td key={topic.id}>{topic.problem ?? "검수된 로컬 후보에는 별도 문제 정의가 없어요."}</td>
            ))}
          </tr>
          <tr>
            <th scope="row">연구질문</th>
            {candidates.map(({ topic }) => <td key={topic.id}>{topic.question}</td>)}
          </tr>
          <tr>
            <th scope="row">사용자 확인</th>
            {candidates.map(({ topic }) => (
              <td key={topic.id}>
                {topic.userConfirmed?.length
                  ? topic.userConfirmed.map((item) => <span className="idea-fact-row" key={item}><CircleCheck size={13} /> {item}</span>)
                  : "상단의 ‘AI와 확인한 맥락’을 참고하세요."}
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row">AI 제안</th>
            {candidates.map(({ topic }) => (
              <td key={topic.id}>
                {topic.aiProposed?.length
                  ? topic.aiProposed.map((item) => <span className="idea-proposal-row" key={item}><Sparkles size={13} /> {item}</span>)
                  : "검수된 로컬 후보에는 별도 AI 제안이 없어요."}
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row">내 조건과 연결</th>
            {candidates.map(({ topic, matchedInterests, matchedMethods }) => (
              <td key={topic.id}>
                <p>{topic.reason}</p>
                <div className="tag-row">
                  {matchedInterests.map((item) => <Tag key={item} tone="blue">{item}</Tag>)}
                  {matchedMethods.map((item) => <Tag key={item}>{item}</Tag>)}
                </div>
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row">데이터 후보</th>
            {candidates.map(({ topic }) => (
              <td key={topic.id}>
                {topic.dataOptions.map((item) => (
                  <span className="cand-data-row" key={item.name}>
                    {item.name} <StatusPill status={item.status} />
                  </span>
                ))}
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row">방법</th>
            {candidates.map(({ topic }) => <td key={topic.id}>{topic.methodDetail}</td>)}
          </tr>
          <tr>
            <th scope="row">예상 범위</th>
            {candidates.map(({ topic }) => <td key={topic.id}>{topic.scope}</td>)}
          </tr>
          <tr>
            <th scope="row">확인할 점</th>
            {candidates.map(({ topic }) => <td key={topic.id}>{topic.uncertainties.join(" ")}</td>)}
          </tr>
          <tr>
            <th scope="row">첫 30분 행동</th>
            {candidates.map(({ topic }) => <td key={topic.id}>{topic.firstAction}</td>)}
          </tr>
          <tr>
            <th scope="row">근거 상태</th>
            {candidates.map(({ topic }) => (
              <td key={topic.id}>
                {topic.evidence.map((item) => (
                  <span className="idea-evidence-row" key={item.id}>
                    <ShieldCheck size={13} /> {item.type} · {item.verifiedAt}
                  </span>
                ))}
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row">선택</th>
            {candidates.map(({ topic }) => {
              const selected = selectedTopicId === topic.id;
              return (
                <td key={topic.id}>
                  <button
                    type="button"
                    className={cx("cand-select", selected && "is-selected")}
                    onClick={() => onSelect(topic.id)}
                    aria-pressed={selected}
                  >
                    {selected ? "선택됨" : "이 주제로 선택"}
                  </button>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const ROLE_LABEL: Record<ProfessorMatchRole, string> = {
  TOPIC: "연구주제 연결",
  METHOD: "방법론 연결",
  CONTEXT: "응용 맥락 연결",
};

const STRENGTH_LABEL: Record<ProfessorMatchStrength, string> = {
  DIRECT: "직접 근거",
  RELATED: "연관 근거",
  LIMITED: "추가 확인 필요",
};

function ProfessorBlock({
  topic,
  matches,
  coverage,
  status,
  error,
  scopeMessage,
  scopeAction,
  onLoad,
}: {
  topic: TopicWithChecks["topic"];
  matches: ProfessorMatch[];
  coverage: Pick<
    ProfessorMatchResponse,
    "officialRecordCount" | "scopeStatus" | "coverageGaps" | "note" | "rankingSource" | "rankingModel"
  > | null;
  status: "idle" | "loading" | "success" | "error";
  error: string | null;
  scopeMessage: string | null;
  scopeAction?: { label: string; onClick: () => void };
  onLoad: () => void;
}) {
  if (scopeMessage) {
    return (
      <section id="professor-connection" className="prof-block">
        <div className="section-heading"><h2>프로젝트 멘토 교수 연결</h2></div>
        <Card className="prof-note prof-note--pending">
          <span><CircleAlert size={18} /></span>
          <div>
            <strong>현재 단국대학교 교수 데이터 파일럿이에요</strong>
            <p>{scopeMessage}</p>
            {scopeAction ? (
              <button type="button" className="prof-load-button" onClick={scopeAction.onClick}>
                <ShieldCheck size={16} /> {scopeAction.label}
              </button>
            ) : (
              <Link href="/research/tutorial?source=full" className="prof-load-button">
                <ShieldCheck size={16} /> 학교 조건 바꾸기
              </Link>
            )}
          </div>
        </Card>
        <p className="prof-disclaimer">{PROFESSOR_DISCLAIMER}</p>
      </section>
    );
  }
  if (status === "idle" || status === "loading" || status === "error") {
    return (
      <section id="professor-connection" className="prof-block">
        <div className="section-heading"><h2>프로젝트 멘토 교수 연결</h2></div>
        <Card className="prof-note prof-note--pending">
          <span><CircleAlert size={18} /></span>
          <div>
            <strong>
              {status === "loading"
                ? "공식 후보 안에서 프로젝트 멘토를 찾고 있어요"
                : status === "error"
                  ? "공식 교수 연결을 완료하지 못했어요"
                  : "선택한 아이디어를 발전시킬 멘토 교수를 연결할 수 있어요"}
            </strong>
            <p>
              {error ?? "주제·방법·확장 관점별 공식 후보를 좁힌 뒤 AI가 프로젝트 맥락으로 재정렬합니다."}
            </p>
            {status !== "loading" && (
              <button type="button" className="prof-load-button" onClick={onLoad}>
                <ShieldCheck size={16} /> {status === "error" ? "다시 연결하기" : "프로젝트 멘토 찾기"}
              </button>
            )}
          </div>
        </Card>
        <p className="prof-disclaimer">{PROFESSOR_DISCLAIMER}</p>
      </section>
    );
  }
  return (
    <section id="professor-connection" className="prof-block">
      <div className="section-heading"><h2>프로젝트 멘토 교수 연결</h2></div>
      <Card className="prof-note">
        <span>{coverage?.rankingSource === "ai-reranked" ? <Sparkles size={18} /> : <ShieldCheck size={18} />}</span>
        <div>
          <strong>
            {coverage?.rankingSource === "ai-reranked"
              ? "AI가 공식 근거 후보 안에서 프로젝트 멘토를 골랐어요"
              : "공식 근거 규칙으로 프로젝트 멘토를 연결했어요"}
          </strong>
          <p>{PROFESSOR_DATA_NOTE} 현재 {coverage?.officialRecordCount ?? matches.length}명의 단국대 공식 교수 레코드 안에서 비교했으며, 프로젝트 성공이나 면담 가능성을 보장하지 않습니다.</p>
        </div>
      </Card>
      <div className="official-match-grid">
      {matches.map((match) => {
        const professor = match.professor;
        const portrait = resolveProfessorPortrait({
          professorId: professor.id,
          professorName: professor.name,
          variant: match.role,
        });
        return (
        <article key={professor.id} className="prof-card official-match-card">
          <div className="prof-card__top">
            <div className="prof-card__identity">
              <div className="official-professor-avatar" title={portrait.sourceLabel}>
                <Image
                  src={portrait.src}
                  alt={portrait.alt}
                  width={48}
                  height={48}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    borderRadius: "inherit",
                  }}
                />
              </div>
              <div>
                <span className="official-match-order">{ROLE_LABEL[match.role]}</span>
                <h3>{professor.name} {professor.title}</h3>
                <small>{professor.university} · {professor.department}</small>
              </div>
            </div>
            <Tag tone={match.strength === "LIMITED" ? "warning" : "mint"}>{ROLE_LABEL[match.role]}</Tag>
          </div>
          <div className="tag-row">
            <Tag tone={portrait.isActualProfessorPhoto ? "mint" : "violet"}>
              {portrait.badgeLabel}
            </Tag>
            <Tag tone={match.strength === "LIMITED" ? "warning" : "blue"}>{STRENGTH_LABEL[match.strength]}</Tag>
            {professor.researchFields.map((field) => <Tag key={field}>{field}</Tag>)}
          </div>
          <p className="official-match-reason"><CircleCheck size={15} /> <span>{match.mentorFitReason ?? match.reason}</span></p>
          <dl className="official-evidence-list">
            <div><dt>근거 ID</dt><dd>{match.evidenceIds.join(" · ")}</dd></div>
            <div>
              <dt>논문 상태</dt>
              <dd>
                {professor.publicationsStatus === "FOUND"
                  ? `공식 프로필 노출 논문 ${professor.publicationCount}건`
                  : "공식 프로필 미기재"}
              </dd>
            </div>
            <div><dt>근거가 말하지 않는 것</dt><dd>{match.doesNotEstablish.join(" · ")}</dd></div>
          </dl>
          <div className="prof-meta">
            <span><ShieldCheck size={13} /> 수집 확인 {new Date(professor.collectedAt).toLocaleDateString("ko-KR")}</span>
            <span className="prof-unknown"><CircleAlert size={13} /> 모집·면담 가능 여부 미확인</span>
          </div>
          <div className="official-match-actions">
            <Link className="prof-link" href={`/professors/${professor.id}?from=result`}>
              상세 근거 보기 <ArrowUpRight size={14} />
            </Link>
            <Link className="prof-link prof-link--secondary" href={professor.officialProfileUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={15} /> 대학 공식 프로필
            </Link>
          </div>
        </article>
      );})}
      </div>
      {coverage?.coverageGaps.map((gap) => (
        <Card
          className="prof-coverage-gap"
          key={`${gap.university}-${gap.department ?? "unknown"}-${gap.status}-${gap.sourceUrl}`}
        >
          <CircleAlert size={17} />
          <div>
            <strong>{gap.university} · {gap.department ?? gap.status}</strong>
            {gap.department && <small>{gap.status}</small>}
            <p>{gap.scopeImpact}</p>
          </div>
        </Card>
      ))}
      {coverage && <p className="prof-scope-note">{coverage.note}</p>}
      {matches.length > 0 ? (
        <Link href="/project-professors" className="prof-load-button">
          맞춤 교수 추천 탭에서 이어보기 <ArrowUpRight size={15} />
        </Link>
      ) : null}
      <p className="prof-disclaimer">{PROFESSOR_DISCLAIMER}</p>
    </section>
  );
}

export function ResearchResultScreen({ view = "summary" }: { view?: ResultPageView }) {
  const router = useRouter();
  const hasHydrated = useResearchStore((s) => s.hasHydrated);
  const result = useResearchStore((s) => s.result);
  const conditions = useResearchStore((s) => s.conditions);
  const ideaMode = useResearchStore((s) => s.ideaMode);
  const coDesignAnswers = useResearchStore((s) => s.coDesignAnswers);
  const resultOrigin = useResearchStore((s) => s.resultOrigin);
  const groundingNote = useResearchStore((s) => s.groundingNote);
  const selectedTopicId = useResearchStore((s) => s.selectedTopicId);
  const professorMatchStatus = useResearchStore((s) => s.projectProfessorMatchStatus);
  const professorMatchError = useResearchStore((s) => s.projectProfessorMatchError);
  const professorMatchTopicId = useResearchStore((s) => s.projectProfessorMatchTopicId);
  const selectTopic = useResearchStore((s) => s.selectTopic);
  const setProfessorMatchLoading = useResearchStore((s) => s.setProjectProfessorMatchLoading);
  const setProfessorMatches = useResearchStore((s) => s.setProjectProfessorMatches);
  const setProfessorMatchError = useResearchStore((s) => s.setProjectProfessorMatchError);
  const reRecommend = useResearchStore((s) => s.reRecommend);
  const reRecommendNote = useResearchStore((s) => s.reRecommendNote);
  const loadKey = useResearchStore((s) => s.loadKey);

  const [loading, setLoading] = useState(true);
  const [cooldown, setCooldown] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const professorRequestRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    professorRequestRef.current?.abort();
  }, []);

  useEffect(() => {
    if (hasHydrated && result === null) {
      router.replace("/research");
      return;
    }
  }, [hasHydrated, result, router]);

  useEffect(() => {
    setLoading(true);
    const t = window.setTimeout(() => setLoading(false), 900);
    return () => window.clearTimeout(t);
  }, [loadKey]);

  const onReRecommend = () => {
    if (cooldown) return;
    setCooldown(true);
    reRecommend();
    window.setTimeout(() => setCooldown(false), 1200);
  };

  const loadProfessorMatches = async (
    topic: TopicWithChecks["topic"],
    university = conditions.school,
  ): Promise<boolean> => {
    if (!isDankookUniversity(university)) return false;
    professorRequestRef.current?.abort();
    const requestController = new AbortController();
    professorRequestRef.current = requestController;
    setProfessorMatchLoading(topic.id);
    try {
      const response = await requestProfessorMatches(
        topic,
        conditions.major ?? "",
        university,
        { signal: requestController.signal },
      );
      if (professorRequestRef.current !== requestController) return false;
      setProfessorMatches(response);
      const current = useResearchStore.getState();
      return projectProfessorRequestCompleted({
        requestedTopicId: topic.id,
        selectedTopicId: current.selectedTopicId,
        matchTopicId: current.projectProfessorMatchTopicId,
        status: current.projectProfessorMatchStatus,
      });
    } catch (matchError) {
      if (
        matchError instanceof ProfessorMatchRequestAbortedError
        || professorRequestRef.current !== requestController
      ) {
        return false;
      }
      setProfessorMatchError(
        topic.id,
        matchError instanceof Error ? matchError.message : "공식 교수 데이터를 연결하지 못했습니다.",
      );
      return false;
    } finally {
      if (professorRequestRef.current === requestController) {
        professorRequestRef.current = null;
      }
    }
  };

  const onSelectTopic = (id: string) => {
    const currentResult = result;
    if (!currentResult) return;
    const chosen = currentResult.kind === "ok"
      ? currentResult.candidates.find((candidate) => candidate.topic.id === id)
      : currentResult.kind === "insufficient" && currentResult.candidate.topic.id === id
        ? currentResult.candidate
        : undefined;
    if (!chosen) return;
    if (selectedTopicId === id) return;
    professorRequestRef.current?.abort();
    professorRequestRef.current = null;
    setContinuing(false);
    selectTopic(id);
  };

  if (!hasHydrated || result === null) {
    return (
      <div className="research-loading">
        <Image src="/mvp-assets/robot-pose-2.png" alt="" width={92} height={92} priority />
        <p>저장된 연구 결과를 불러오고 있어요.</p>
      </div>
    );
  }

  const summaryChips = [
    modeById(ideaMode)?.label,
    conditions.major,
    ...conditions.interests,
    conditions.experience,
    ...conditions.methods,
    conditions.period,
    conditions.dataAccess,
  ].filter(Boolean) as string[];
  const professorScopeMessage = !conditions.school.trim()
    ? "학교는 아이디어 생성에서는 선택 정보이지만, 교수 연결에서는 공식 데이터 범위를 확인해야 합니다. 현재는 학교가 선택되지 않았어요."
    : !isDankookUniversity(conditions.school)
      ? `${conditions.school} 학생도 연구 아이디어 기능은 이용할 수 있지만, 교수 연결 데이터는 아직 단국대학교 1,051명만 지원합니다.`
      : null;
  const selectedCandidate = selectedTopicId && result.kind !== "empty"
    ? result.kind === "ok"
      ? result.candidates.find((candidate) => candidate.topic.id === selectedTopicId) ?? null
      : result.candidate.topic.id === selectedTopicId ? result.candidate : null
    : null;
  const primaryAction = resultPagePrimaryAction(
    view,
    Boolean(selectedCandidate),
    !professorScopeMessage,
  );
  const currentProfessorMatchError = selectedCandidate
    && professorMatchStatus === "error"
    && professorMatchTopicId === selectedCandidate.topic.id
    ? professorMatchError
    : null;

  const continueToProfessors = async () => {
    if (!selectedCandidate || continuing) return;
    setContinuing(true);
    try {
      const completed = await loadProfessorMatches(selectedCandidate.topic);
      if (completed) router.push("/project-professors");
    } finally {
      setContinuing(false);
    }
  };

  const stickyAction = (
    <div className={styles.stickyActions}>
      <SecondaryButton onClick={() => router.push(view === "summary" ? "/research/conditions?view=review" : "/result")}>
        {view === "summary" ? "조건 바꾸기" : "후보 요약"}
      </SecondaryButton>
      <PrimaryButton
        onClick={() => {
          if (view === "summary") router.replace(primaryAction.href ?? "/result/compare");
          else if (professorScopeMessage) router.push(primaryAction.href ?? "/research/conditions?view=review");
          else void continueToProfessors();
        }}
        disabled={primaryAction.disabled || continuing}
      >
        {continuing
          ? <><LoaderCircle size={17} className="spin" /> 교수 추천 준비 중…</>
          : currentProfessorMatchError
            ? <><CircleAlert size={17} /> 교수 추천 다시 시도</>
            : primaryAction.label}
        {!continuing && !primaryAction.disabled && !currentProfessorMatchError ? <ArrowRight size={17} /> : null}
      </PrimaryButton>
    </div>
  );

  return (
    <AppShell
      title={view === "summary" ? "프로젝트 후보 이해" : "프로젝트 근거 비교"}
      onBack={() => router.replace(view === "summary" ? "/research" : "/result")}
      className={cx("research-screen result-screen", styles.shell)}
      stickyAction={stickyAction}
    >
      {loading ? (
        <div className="research-loading">
          <Image src={guideCharacter.processing} alt="" width={92} height={92} priority unoptimized />
          <p>조건에 맞는 연구주제 후보를 찾고 있어요.</p>
        </div>
      ) : view === "summary" ? (
        <>
          <JourneyStageHero
            stage="project"
            eyebrow="프로젝트 설계 · 1단계"
            title={result.kind === "ok" ? "후보 2개를 찾았어요" : "프로젝트 후보를 확인해요"}
            description="핵심 차이를 보고 한 후보를 고른 뒤, 다음 화면에서 상세 근거를 확인하고 관련 교수로 이어가세요."
          />
          <ResultPageSteps current="summary" hasSelection={Boolean(selectedCandidate)} />

          <Card className={cx("result-grounding", resultOrigin === "ai" ? "is-ai" : "is-fallback", styles.grounding)}>
            <span>{resultOrigin === "ai" ? <Sparkles size={18} /> : <ShieldCheck size={18} />}</span>
            <div>
              <strong>{resultOrigin === "ai" ? "AI 공동설계 후보" : "검수된 로컬 후보"}</strong>
              <p>{groundingNote ?? "사용자 확인 답변과 확인 필요 항목을 분리해 구성했어요."}</p>
            </div>
          </Card>

          <details className={styles.contextDisclosure}>
            <summary>설계에 사용한 조건과 답변 보기 <span>{summaryChips.length + coDesignAnswers.length}개</span></summary>
            <div className="tag-row">{summaryChips.map((s, i) => <Tag key={`${s}-${i}`}>{s}</Tag>)}</div>
            {coDesignAnswers.length > 0 ? (
              <dl>
                {coDesignAnswers.map((answer) => <div key={answer.questionId}><dt>{answer.label}</dt><dd>{answer.value}</dd></div>)}
              </dl>
            ) : null}
          </details>

          {result.kind === "empty" ? (
            <EmptyBlock icon={CircleAlert} title="현재 조건에 맞는 연구주제를 찾지 못했어요." desc="관심 분야나 준비 조건을 바꿔 다시 시도해 주세요." onChange={() => router.push("/research/conditions?view=review")} onRetry={onReRecommend} />
          ) : null}

          {result.kind === "insufficient" ? (
            <>
              <Card className="cond-warn"><span><CircleAlert size={18} /></span><div><strong>비교할 두 번째 후보가 부족해요</strong><p>확인된 후보 1개를 먼저 살펴보고 조건을 바꿀 수 있어요.</p></div></Card>
              <div className={styles.summaryGrid}>
                <CandidateSummaryCard candidate={result.candidate} label="A" selected={selectedTopicId === result.candidate.topic.id} onSelect={() => onSelectTopic(result.candidate.topic.id)} />
              </div>
            </>
          ) : null}

          {result.kind === "ok" ? (
            <section className={styles.summarySection} aria-labelledby="candidate-summary-title">
              <div className="section-heading"><div><h2 id="candidate-summary-title">어느 방향이 더 끌리나요?</h2><p>데이터·방법·범위만 먼저 보고 한 후보를 골라도 나중에 바꿀 수 있어요.</p></div></div>
              <div className={styles.summaryGrid}>
                {result.candidates.map((candidate, index) => (
                  <CandidateSummaryCard key={candidate.topic.id} candidate={candidate} label={index === 0 ? "A" : "B"} selected={selectedTopicId === candidate.topic.id} onSelect={() => onSelectTopic(candidate.topic.id)} />
                ))}
              </div>
            </section>
          ) : null}

          {selectedCandidate ? <p className={styles.selectionNotice} role="status"><CircleCheck size={16} /> {selectedCandidate.topic.title} 후보를 선택했어요. 다음 단계에서 조건별 근거를 자세히 확인해 보세요.</p> : null}
          <div className={styles.utilityActions}>
            <button type="button" onClick={onReRecommend} disabled={cooldown || loading}><RotateCw size={16} className={cooldown ? "spin" : ""} /> 후보 다시 만들기</button>
          </div>
          {reRecommendNote ? <div className="rerec-note" role="status"><Info size={15} /> {reRecommendNote}</div> : null}
        </>
      ) : (
        <>
          <JourneyStageHero
            stage="project"
            eyebrow="프로젝트 설계 · 2단계"
            title="두 후보의 근거를 하나씩 비교해요"
            description="한 번에 한 기준만 펼쳐보고, 실행할 후보를 선택하세요."
          />
          <ResultPageSteps current="compare" hasSelection={Boolean(selectedCandidate)} />

          {result.kind === "empty" ? (
            <EmptyBlock icon={CircleAlert} title="비교할 후보가 없어요." desc="조건을 다시 확인해 프로젝트 후보를 만들어 주세요." onChange={() => router.push("/research/conditions?view=review")} />
          ) : null}

          {result.kind === "insufficient" ? (
            <><Card className="cond-warn"><span><CircleAlert size={18} /></span><div><strong>후보가 1개만 있어요</strong><p>이 후보를 선택하거나 조건을 바꿔 비교 후보를 더 만들 수 있어요.</p></div></Card><div className={styles.summaryGrid}><CandidateSummaryCard candidate={result.candidate} label="A" selected={selectedTopicId === result.candidate.topic.id} onSelect={() => onSelectTopic(result.candidate.topic.id)} /></div></>
          ) : null}

          {result.kind === "ok" ? (
            <>
              <section className={styles.choiceSection} aria-labelledby="comparison-choice-title">
                <div className="section-heading"><div><h2 id="comparison-choice-title">비교할 후보</h2><p>후보 이름을 계속 보면서 아래 근거를 확인해요.</p></div></div>
                <div className={styles.summaryGrid}>
                  {result.candidates.map((candidate, index) => (
                    <CandidateSummaryCard key={candidate.topic.id} candidate={candidate} label={index === 0 ? "A" : "B"} selected={selectedTopicId === candidate.topic.id} onSelect={() => onSelectTopic(candidate.topic.id)} />
                  ))}
                </div>
              </section>
              <section className={styles.criteriaSection} aria-labelledby="criteria-title">
                <div className="section-heading"><div><h2 id="criteria-title"><Sliders size={18} /> 기준별 비교</h2><p>필요한 항목만 열어 A와 B를 세로로 비교하세요.</p></div></div>
                {(Object.keys(CRITERION_LABELS) as CriterionKey[]).map((key, index) => (
                  <CriterionDisclosure key={key} criterion={key} candidates={result.candidates} defaultOpen={index === 0} />
                ))}
              </section>
              <details className={styles.fullEvidence}>
                <summary>문제·데이터·방법·범위 전체 근거 보기</summary>
                <IdeaComparisonTable candidates={result.candidates} selectedTopicId={selectedTopicId} onSelect={onSelectTopic} />
              </details>
            </>
          ) : null}

          {selectedCandidate ? (
            <>
              <Card className={styles.nextStepCard} id="professor-status">
                <CircleCheck size={20} />
                <div><strong>{selectedCandidate.topic.title}</strong><p>선택을 저장했어요. 다음 페이지에서 이 주제에 맞는 교수 추천을 확인합니다.</p></div>
                <ArrowUpRight size={18} />
              </Card>
              {professorScopeMessage || currentProfessorMatchError ? (
                <Card
                  className={styles.professorFeedback}
                  role={currentProfessorMatchError ? "alert" : "status"}
                >
                  <CircleAlert size={19} />
                  <div>
                    <strong>{currentProfessorMatchError ? "교수 추천을 불러오지 못했어요" : "교수 연결을 위해 학교를 확인해 주세요"}</strong>
                    <p>{currentProfessorMatchError ?? professorScopeMessage}</p>
                  </div>
                </Card>
              ) : null}
            </>
          ) : <p className={styles.selectionPrompt} role="status">근거를 확인한 뒤 후보 A 또는 B를 선택해 주세요.</p>}
        </>
      )}
    </AppShell>
  );
}

function EmptyBlock({ icon: Icon, title, desc, onChange, onRetry }: { icon: typeof CircleAlert; title: string; desc: string; onChange: () => void; onRetry?: () => void }) {
  return (
    <div className="research-empty">
      <Image src={guideCharacter.confused} alt="" width={96} height={92} unoptimized />
      <Icon size={22} />
      <h2>{title}</h2>
      <p>{desc}</p>
      <div className="research-empty__actions">
        <PrimaryButton onClick={onChange}>조건 바꾸기</PrimaryButton>
        {onRetry && <SecondaryButton onClick={onRetry}>다시 시도</SecondaryButton>}
      </div>
    </div>
  );
}
