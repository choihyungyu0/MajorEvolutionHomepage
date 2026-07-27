"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  Database,
  ExternalLink,
  FlaskConical,
  Info,
  RotateCw,
  ShieldCheck,
  Sliders,
  Sparkles,
  Timer,
} from "lucide-react";
import { AppShell, Card, PageHeader, PrimaryButton, SecondaryButton, Tag, cx } from "@/components/app/primitives";
import { modeById } from "@/data/co-design";
import {
  PROFESSOR_DATA_NOTE,
  PROFESSOR_DISCLAIMER,
  type CheckStatus,
} from "@/data/research-mvp";
import { requestProfessorMatches } from "@/lib/professor-client";
import type {
  ProfessorMatch,
  ProfessorMatchResponse,
  ProfessorMatchRole,
  ProfessorMatchStrength,
} from "@/lib/professor-domain";
import { CRITERION_LABELS, type CriterionKey, type TopicWithChecks } from "@/lib/recommend";
import { useResearchStore } from "@/store/research-store";

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
  onLoad,
  onSelectProfessor,
}: {
  topic: TopicWithChecks["topic"];
  matches: ProfessorMatch[];
  coverage: Pick<
    ProfessorMatchResponse,
    "officialRecordCount" | "scopeStatus" | "coverageGaps" | "note"
  > | null;
  status: "idle" | "loading" | "success" | "error";
  error: string | null;
  onLoad: () => void;
  onSelectProfessor: (id: string) => void;
}) {
  if (status === "idle" || status === "loading" || status === "error") {
    return (
      <section id="professor-connection" className="prof-block">
        <div className="section-heading"><h2>교수 공식 정보 연결</h2></div>
        <Card className="prof-note prof-note--pending">
          <span><CircleAlert size={18} /></span>
          <div>
            <strong>
              {status === "loading"
                ? "공식 프로필 근거를 연결하고 있어요"
                : status === "error"
                  ? "공식 교수 연결을 완료하지 못했어요"
                  : "선택한 주제와 공식 교수 데이터를 연결할 수 있어요"}
            </strong>
            <p>
              {error ?? "교수의 우열을 점수로 매기지 않고, 주제·방법·응용 맥락 역할과 공식 근거 ID를 연결합니다."}
            </p>
            {status !== "loading" && (
              <button type="button" className="prof-load-button" onClick={onLoad}>
                <ShieldCheck size={16} /> {status === "error" ? "다시 연결하기" : "공식 교수 2명 찾기"}
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
      <div className="section-heading"><h2>교수 공식 정보 연결</h2></div>
      <Card className="prof-note">
        <span><ShieldCheck size={18} /></span>
        <div>
          <strong>공식 근거로만 연결했어요</strong>
          <p>{PROFESSOR_DATA_NOTE} 현재 {coverage?.officialRecordCount ?? matches.length}명의 단국대 공식 교수 레코드 안에서 비교했습니다.</p>
        </div>
      </Card>
      <div className="official-match-grid">
      {matches.map((match, index) => {
        const professor = match.professor;
        return (
        <article key={professor.id} className="prof-card official-match-card">
          <div className="prof-card__top">
            <div>
              <span className="official-match-order">{index === 0 ? "연결 후보" : "대안 후보"}</span>
              <h3>{professor.name} {professor.title}</h3>
              <small>{professor.university} · {professor.department}</small>
            </div>
            <Tag tone={match.strength === "LIMITED" ? "warning" : "mint"}>{ROLE_LABEL[match.role]}</Tag>
          </div>
          <div className="tag-row">
            <Tag tone={match.strength === "LIMITED" ? "warning" : "blue"}>{STRENGTH_LABEL[match.strength]}</Tag>
            {professor.researchFields.map((field) => <Tag key={field}>{field}</Tag>)}
          </div>
          <p className="official-match-reason"><CircleCheck size={15} /> <span>{match.reason}</span></p>
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
            <Link className="prof-link" href={`/professors/${professor.id}`} onClick={() => onSelectProfessor(professor.id)}>
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
      <p className="prof-disclaimer">{PROFESSOR_DISCLAIMER}</p>
    </section>
  );
}

export function ResearchResultScreen() {
  const router = useRouter();
  const hasHydrated = useResearchStore((s) => s.hasHydrated);
  const result = useResearchStore((s) => s.result);
  const conditions = useResearchStore((s) => s.conditions);
  const ideaMode = useResearchStore((s) => s.ideaMode);
  const coDesignAnswers = useResearchStore((s) => s.coDesignAnswers);
  const resultOrigin = useResearchStore((s) => s.resultOrigin);
  const groundingNote = useResearchStore((s) => s.groundingNote);
  const selectedTopicId = useResearchStore((s) => s.selectedTopicId);
  const professorMatches = useResearchStore((s) => s.professorMatches);
  const professorCoverage = useResearchStore((s) => s.professorCoverage);
  const professorMatchStatus = useResearchStore((s) => s.professorMatchStatus);
  const professorMatchError = useResearchStore((s) => s.professorMatchError);
  const selectTopic = useResearchStore((s) => s.selectTopic);
  const setProfessorMatchLoading = useResearchStore((s) => s.setProfessorMatchLoading);
  const setProfessorMatches = useResearchStore((s) => s.setProfessorMatches);
  const setProfessorMatchError = useResearchStore((s) => s.setProfessorMatchError);
  const selectProfessor = useResearchStore((s) => s.selectProfessor);
  const reRecommend = useResearchStore((s) => s.reRecommend);
  const reRecommendNote = useResearchStore((s) => s.reRecommendNote);
  const loadKey = useResearchStore((s) => s.loadKey);

  const [loading, setLoading] = useState(true);
  const [cooldown, setCooldown] = useState(false);

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

  const loadProfessorMatches = async (topic: TopicWithChecks["topic"]) => {
    setProfessorMatchLoading();
    try {
      const response = await requestProfessorMatches(topic, conditions.major ?? "");
      setProfessorMatches(response);
    } catch (matchError) {
      setProfessorMatchError(
        matchError instanceof Error ? matchError.message : "공식 교수 데이터를 연결하지 못했습니다.",
      );
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
    selectTopic(id);
    void loadProfessorMatches(chosen.topic);
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

  const stickyAction = (
    <>
      <SecondaryButton onClick={() => router.push("/research")}>조건 바꾸기</SecondaryButton>
      <PrimaryButton onClick={onReRecommend} disabled={cooldown || loading}>
        <RotateCw size={17} className={cooldown ? "spin" : ""} /> 후보 다시 만들기
      </PrimaryButton>
    </>
  );

  return (
    <AppShell title="공동설계 결과" onBack={() => router.push("/research")} className="research-screen" stickyAction={stickyAction}>
      {loading ? (
        <div className="research-loading">
          <Image src="/mvp-assets/robot-pose-2.png" alt="" width={92} height={92} priority />
          <p>조건에 맞는 연구주제 후보를 찾고 있어요.</p>
        </div>
      ) : (
        <>
          <PageHeader eyebrow="1:1 비교" title="어떤 연구주제가 지금 더 시작 가능한가요?" description="점수 대신 근거·데이터·방법·범위와 확인할 조건으로 비교했어요." />

          <Card className={cx("result-grounding", resultOrigin === "ai" ? "is-ai" : "is-fallback")}>
            <span>{resultOrigin === "ai" ? <Sparkles size={18} /> : <ShieldCheck size={18} />}</span>
            <div>
              <strong>{resultOrigin === "ai" ? "AI 공동설계 후보" : "검수된 로컬 후보"}</strong>
              <p>{groundingNote ?? "사용자 확인 답변과 확인 필요 항목을 분리해 구성했어요."}</p>
            </div>
          </Card>

          <div className="cond-summary">
            <span className="cond-summary__label">선택한 조건</span>
            <div className="tag-row">{summaryChips.map((s, i) => <Tag key={`${s}-${i}`}>{s}</Tag>)}</div>
            {coDesignAnswers.length > 0 && (
              <details className="co-answer-summary">
                <summary>AI와 확인한 맥락 {coDesignAnswers.length}개</summary>
                <dl>
                  {coDesignAnswers.map((answer) => (
                    <div key={answer.questionId}>
                      <dt>{answer.label}</dt>
                      <dd>{answer.value}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
          </div>

          {result.kind === "unsupported-major" && (
            <EmptyBlock icon={CircleAlert} title="현재 파일럿에서는 이 전공을 아직 지원하지 않아요." desc="지원 전공을 선택해 다시 시도해 주세요." onChange={() => router.push("/research")} />
          )}

          {result.kind === "empty" && (
            <EmptyBlock icon={CircleAlert} title="현재 조건에 맞는 연구주제를 찾지 못했어요." desc="관심 분야나 준비 조건을 바꿔 다시 시도해 주세요." onChange={() => router.push("/research")} onRetry={onReRecommend} />
          )}

          {result.kind === "insufficient" && (
            <>
              <Card className="cond-warn">
                <span><CircleAlert size={18} /></span>
                <div><strong>비교할 두 번째 연구주제가 부족해요</strong><p>확인된 후보 1개만 보여드려요. 조건을 조금 바꾸면 비교 후보를 더 찾을 수 있어요.</p></div>
              </Card>
              <div className="cand-list cand-list--one">
                <CandidateCard cand={result.candidate} label="A" selected={selectedTopicId === result.candidate.topic.id} onSelect={() => onSelectTopic(result.candidate.topic.id)} />
              </div>
            </>
          )}

          {result.kind === "ok" && (
            <>
              <IdeaComparisonTable
                candidates={result.candidates}
                selectedTopicId={selectedTopicId}
                onSelect={onSelectTopic}
              />

              <section className="compare-block">
                <div className="section-heading"><h2><Sliders size={18} /> 정성 비교</h2><p>숫자 점수 없이 조건별 근거로 비교해요.</p></div>
                {(Object.keys(CRITERION_LABELS) as CriterionKey[]).map((key) => {
                  const Icon = CRIT_ICON[key];
                  const a = result.candidates[0].checks[key];
                  const b = result.candidates[1].checks[key];
                  return (
                    <div key={key} className="compare-row">
                      <div className="compare-row__title"><Icon size={15} /> {CRITERION_LABELS[key]}</div>
                      <div className="compare-row__sides">
                        <div><span className="compare-ab">A</span><StatusPill status={a.status} /><p>{a.note}</p></div>
                        <div><span className="compare-ab">B</span><StatusPill status={b.status} /><p>{b.note}</p></div>
                      </div>
                    </div>
                  );
                })}
                <p className="compare-foot">어느 후보가 절대적으로 더 좋다고 단정하지 않아요. 선택 이유는 직접 정해요.</p>
                {selectedTopicId && (
                  <a className="prof-jump-link" href="#professor-connection">
                    선택한 주제의 교수 연결 상태 보기 <ArrowUpRight size={14} />
                  </a>
                )}
              </section>
            </>
          )}

          {reRecommendNote && <div className="rerec-note" role="status"><Info size={15} /> {reRecommendNote}</div>}

          {selectedTopicId && (() => {
            const chosen =
              result.kind === "ok"
                ? result.candidates.find((c) => c.topic.id === selectedTopicId)
                : result.kind === "insufficient" && result.candidate.topic.id === selectedTopicId
                  ? result.candidate
                  : undefined;
            return chosen ? (
              <ProfessorBlock
                topic={chosen.topic}
                matches={professorMatches}
                coverage={professorCoverage}
                status={professorMatchStatus}
                error={professorMatchError}
                onLoad={() => void loadProfessorMatches(chosen.topic)}
                onSelectProfessor={selectProfessor}
              />
            ) : null;
          })()}
        </>
      )}
    </AppShell>
  );
}

function EmptyBlock({ icon: Icon, title, desc, onChange, onRetry }: { icon: typeof CircleAlert; title: string; desc: string; onChange: () => void; onRetry?: () => void }) {
  return (
    <div className="research-empty">
      <Image src="/mvp-assets/robot-pose-1.png" alt="" width={96} height={92} />
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
