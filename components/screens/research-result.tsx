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
  Timer,
} from "lucide-react";
import { AppShell, Card, PageHeader, PrimaryButton, SecondaryButton, Tag, cx } from "@/components/app/primitives";
import {
  PROFESSOR_DATA_NOTE,
  PROFESSOR_DISCLAIMER,
  findProfessor,
  type CheckStatus,
} from "@/data/research-mvp";
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

function ProfessorBlock({ topic }: { topic: TopicWithChecks["topic"] }) {
  const profs = topic.professorIds.map(findProfessor).filter(Boolean);
  return (
    <section className="prof-block">
      <div className="section-heading"><h2>교수 공식 정보 연결</h2></div>
      <Card className="prof-note">
        <span><ShieldCheck size={18} /></span>
        <div><strong>공식 근거로만 연결해요</strong><p>{PROFESSOR_DATA_NOTE}</p></div>
      </Card>
      {profs.map((p) => p && (
        <article key={p.id} className="prof-card">
          <div className="prof-card__top">
            <div><h3>{p.name}</h3><small>{p.affiliation}</small></div>
            <Tag tone="mint">{p.role}</Tag>
          </div>
          <div className="tag-row">{p.fields.map((f) => <Tag key={f}>{f}</Tag>)}</div>
          <ul className="prof-reasons">
            {p.matchReasons.map((r, i) => (
              <li key={i}><CircleCheck size={14} /> <span>{r.reason} <em>· {r.source}</em></span></li>
            ))}
          </ul>
          <div className="prof-meta">
            <span><ShieldCheck size={13} /> 최종 확인일 {p.verifiedAt}</span>
            <span className="prof-unknown"><CircleAlert size={13} /> 모집·면담 가능 여부 미확인</span>
          </div>
          <Link className="prof-link" href={p.officialContactUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={16} /> 학교 공식 문의 페이지 열기 <ArrowUpRight size={14} />
          </Link>
          <p className="prof-caution"><Info size={13} /> 서비스 밖의 공식 페이지로 이동해요. (예시 링크)</p>
        </article>
      ))}
      <p className="prof-disclaimer">{PROFESSOR_DISCLAIMER}</p>
    </section>
  );
}

export function ResearchResultScreen() {
  const router = useRouter();
  const result = useResearchStore((s) => s.result);
  const conditions = useResearchStore((s) => s.conditions);
  const selectedTopicId = useResearchStore((s) => s.selectedTopicId);
  const selectTopic = useResearchStore((s) => s.selectTopic);
  const reRecommend = useResearchStore((s) => s.reRecommend);
  const reRecommendNote = useResearchStore((s) => s.reRecommendNote);
  const loadKey = useResearchStore((s) => s.loadKey);

  const [loading, setLoading] = useState(true);
  const [cooldown, setCooldown] = useState(false);

  useEffect(() => {
    if (result === null) {
      router.replace("/");
      return;
    }
  }, [result, router]);

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

  if (result === null) return null;

  const summaryChips = [
    conditions.major,
    ...conditions.interests,
    conditions.experience,
    ...conditions.methods,
    conditions.period,
    conditions.dataAccess,
  ].filter(Boolean) as string[];

  const stickyAction = (
    <>
      <SecondaryButton onClick={() => router.push("/")}>조건 바꾸기</SecondaryButton>
      <PrimaryButton onClick={onReRecommend} disabled={cooldown || loading}>
        <RotateCw size={17} className={cooldown ? "spin" : ""} /> 다시 추천
      </PrimaryButton>
    </>
  );

  return (
    <AppShell title="추천 결과" onBack={() => router.push("/")} className="research-screen" stickyAction={stickyAction}>
      {loading ? (
        <div className="research-loading">
          <Image src="/mvp-assets/robot-pose-2.png" alt="" width={92} height={104} priority />
          <p>조건에 맞는 연구주제 후보를 찾고 있어요.</p>
        </div>
      ) : (
        <>
          <PageHeader eyebrow="1:1 비교" title="어떤 연구주제가 지금 더 시작 가능한가요?" description="점수 대신 근거·데이터·방법·범위와 확인할 조건으로 비교했어요." />

          <div className="cond-summary">
            <span className="cond-summary__label">선택한 조건</span>
            <div className="tag-row">{summaryChips.map((s, i) => <Tag key={`${s}-${i}`}>{s}</Tag>)}</div>
          </div>

          {result.kind === "unsupported-major" && (
            <EmptyBlock icon={CircleAlert} title="현재 파일럿에서는 이 전공을 아직 지원하지 않아요." desc="지원 전공을 선택해 다시 시도해 주세요." onChange={() => router.push("/")} />
          )}

          {result.kind === "empty" && (
            <EmptyBlock icon={CircleAlert} title="현재 조건에 맞는 연구주제를 찾지 못했어요." desc="관심 분야나 준비 조건을 바꿔 다시 시도해 주세요." onChange={() => router.push("/")} onRetry={onReRecommend} />
          )}

          {result.kind === "insufficient" && (
            <>
              <Card className="cond-warn">
                <span><CircleAlert size={18} /></span>
                <div><strong>비교할 두 번째 연구주제가 부족해요</strong><p>확인된 후보 1개만 보여드려요. 조건을 조금 바꾸면 비교 후보를 더 찾을 수 있어요.</p></div>
              </Card>
              <div className="cand-list cand-list--one">
                <CandidateCard cand={result.candidate} label="A" selected={selectedTopicId === result.candidate.topic.id} onSelect={() => selectTopic(result.candidate.topic.id)} />
              </div>
            </>
          )}

          {result.kind === "ok" && (
            <>
              <div className="cand-list">
                {result.candidates.map((cand, i) => (
                  <CandidateCard key={cand.topic.id} cand={cand} label={i === 0 ? "A" : "B"} selected={selectedTopicId === cand.topic.id} onSelect={() => selectTopic(cand.topic.id)} />
                ))}
              </div>

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
            return chosen ? <ProfessorBlock topic={chosen.topic} /> : null;
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
