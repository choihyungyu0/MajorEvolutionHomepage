"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  CircleAlert,
  ExternalLink,
  GraduationCap,
  SearchCheck,
  ShieldCheck,
} from "lucide-react";
import {
  AppShell,
  Card,
  ChoiceChip,
  PageHeader,
  PrimaryButton,
  SectionHeading,
  StatusBanner,
  Tag,
} from "@/components/app/primitives";
import type {
  OfficialProfessor,
  ProfessorMatch,
  ProfessorMatchRole,
} from "@/lib/professor-domain";
import { useResearchStore } from "@/store/research-store";

const ROLE_LABEL: Record<ProfessorMatchRole, string> = {
  TOPIC: "연구주제",
  METHOD: "방법론",
  CONTEXT: "응용 맥락",
};

function selectedTopicTitle(): string | null {
  const { result, selectedTopicId } = useResearchStore.getState();
  if (!result || !selectedTopicId) return null;
  if (result.kind === "ok") {
    return result.candidates.find((candidate) => candidate.topic.id === selectedTopicId)?.topic.title ?? null;
  }
  return result.kind === "insufficient" && result.candidate.topic.id === selectedTopicId
    ? result.candidate.topic.title
    : null;
}

function MatchCard({
  match,
  index,
  onOpen,
}: {
  match: ProfessorMatch;
  index: number;
  onOpen: () => void;
}) {
  const professor = match.professor;
  return (
    <article className="official-professor-card">
      <header>
        <div className="official-professor-avatar" aria-hidden="true">{professor.name.slice(0, 1)}</div>
        <div>
          <span>{index === 0 ? "연결 후보" : "대안 후보"}</span>
          <h2>{professor.name} {professor.title}</h2>
          <p>{professor.university} · {professor.department}</p>
        </div>
        <Tag tone={match.strength === "LIMITED" ? "warning" : "mint"}>{ROLE_LABEL[match.role]}</Tag>
      </header>
      <div className="tag-row">
        {professor.researchFields.map((field) => <Tag key={field}>{field}</Tag>)}
      </div>
      <p className="official-professor-reason">{match.reason}</p>
      <dl>
        <div><dt>공식 근거</dt><dd>{match.evidenceIds.length}개</dd></div>
        <div>
          <dt>논문 목록</dt>
          <dd>{professor.publicationsStatus === "FOUND" ? `${professor.publicationCount}건` : "공식 프로필 미기재"}</dd>
        </div>
      </dl>
      <button type="button" className="official-professor-open" onClick={onOpen}>
        상세 근거 보기 <ArrowRight size={16} />
      </button>
    </article>
  );
}

export function OfficialProfessorsScreen() {
  const router = useRouter();
  const matches = useResearchStore((state) => state.professorMatches);
  const coverage = useResearchStore((state) => state.professorCoverage);
  const selectProfessor = useResearchStore((state) => state.selectProfessor);
  const [role, setRole] = useState<ProfessorMatchRole | "ALL">("ALL");
  const topicTitle = selectedTopicTitle();
  const filtered = role === "ALL" ? matches : matches.filter((match) => match.role === role);

  const openProfessor = (match: ProfessorMatch) => {
    selectProfessor(match.professor.id);
    router.push(`/professors/${match.professor.id}`);
  };

  return (
    <AppShell title="교수 레이더" backHref="/result">
      <PageHeader
        eyebrow="공식 프로필 기반"
        title={topicTitle ? "선택한 주제와 연결되는 교수를 확인하세요" : "먼저 연구주제를 선택해 주세요"}
        description={topicTitle ?? "연구주제를 선택하면 주제·방법·응용 맥락 역할로 교수 1명과 대안을 연결합니다."}
      />
      {matches.length === 0 ? (
        <Card className="official-professor-empty">
          <SearchCheck size={28} />
          <h2>저장된 공식 교수 연결 결과가 없어요</h2>
          <p>연구주제 비교 화면에서 한 주제를 선택하고 공식 교수 연결을 실행해 주세요.</p>
          <PrimaryButton onClick={() => router.push("/result")}>연구주제 결과로 이동</PrimaryButton>
        </Card>
      ) : (
        <>
          <StatusBanner icon={ShieldCheck} title="점수 없는 역할 기반 연결" tone="lavender">
            교수의 우열이나 면담 가능성을 평가하지 않습니다. 공식 연구분야와 논문 목록에 드러난 범위만 보여줍니다.
          </StatusBanner>
          <SectionHeading title="연결 역할로 보기" />
          <div className="filter-scroll">
            {(["ALL", "TOPIC", "METHOD", "CONTEXT"] as const).map((item) => (
              <ChoiceChip key={item} selected={role === item} onClick={() => setRole(item)}>
                {item === "ALL" ? "전체" : ROLE_LABEL[item]}
              </ChoiceChip>
            ))}
          </div>
          <div className="official-professor-grid">
            {filtered.map((match) => (
              <MatchCard
                key={match.professor.id}
                match={match}
                index={matches.findIndex((item) => item.professor.id === match.professor.id)}
                onOpen={() => openProfessor(match)}
              />
            ))}
          </div>
          {filtered.length === 0 && (
            <Card className="official-professor-empty">
              <CircleAlert size={24} />
              <h2>이 역할의 연결 후보는 아직 없어요</h2>
              <p>현재 단국대 공식 데이터에서 이 역할의 근거를 확인하지 못했습니다.</p>
            </Card>
          )}
          {coverage && <p className="prof-scope-note">{coverage.note}</p>}
        </>
      )}
    </AppShell>
  );
}

export function OfficialProfessorDetailScreen({ professor }: { professor: OfficialProfessor }) {
  const router = useRouter();
  const matches = useResearchStore((state) => state.professorMatches);
  const selectProfessor = useResearchStore((state) => state.selectProfessor);
  const match = useMemo(
    () => matches.find((item) => item.professor.id === professor.id),
    [matches, professor.id],
  );
  const recentPublications = professor.publications.slice(0, 6);

  return (
    <AppShell
      title="교수 공식 근거"
      backHref="/professors"
      stickyAction={(
        <>
          <PrimaryButton onClick={() => {
            selectProfessor(professor.id);
            router.push("/quest");
          }}>
            교수 Knock Kit 준비 <ArrowRight size={17} />
          </PrimaryButton>
        </>
      )}
    >
      <p className="official-data-pill"><ShieldCheck size={14} /> 대학 공식 페이지 수집 데이터</p>
      <section className="official-professor-hero">
        <div className="official-professor-avatar official-professor-avatar--large" aria-hidden="true">
          {professor.name.slice(0, 1)}
        </div>
        <div>
          <h1>{professor.name} {professor.title}</h1>
          <p>{professor.university} · {professor.college} · {professor.department}</p>
          <div className="tag-row">
            {professor.researchFields.map((field) => <Tag key={field}>{field}</Tag>)}
          </div>
        </div>
      </section>

      {match ? (
        <>
          <SectionHeading title="선택한 주제와의 연결" description="내부 점수 대신 역할과 근거 ID를 확인하세요." />
          <Card className="official-match-detail">
            <Tag tone={match.strength === "LIMITED" ? "warning" : "mint"}>{ROLE_LABEL[match.role]}</Tag>
            <p>{match.reason}</p>
            <dl>
              <div><dt>근거 ID</dt><dd>{match.evidenceIds.join(" · ")}</dd></div>
              <div><dt>판단하지 않은 항목</dt><dd>{match.doesNotEstablish.join(" · ")}</dd></div>
            </dl>
          </Card>
        </>
      ) : (
        <StatusBanner icon={CircleAlert} title="주제 연결 맥락 없음" tone="warning">
          이 주소로 직접 들어왔기 때문에 선택 주제와의 연결 이유는 표시하지 않습니다. 연구 결과 화면에서 다시 연결해 주세요.
        </StatusBanner>
      )}

      <SectionHeading title="공식 프로필의 연구분야" />
      <Card className="official-field-list">
        {professor.researchFieldsStatus === "FOUND"
          ? professor.researchFields.map((field) => (
              <div key={field}><GraduationCap size={18} /><span>{field}</span></div>
            ))
          : <p>{professor.researchFieldsStatus}</p>}
      </Card>

      <SectionHeading
        title="공식 프로필에 노출된 논문"
        description={professor.publicationsStatus === "FOUND"
          ? `전체 ${professor.publicationCount}건 중 최근 목록 순서 ${recentPublications.length}건`
          : "논문이 없다는 뜻이 아니라 공식 프로필에 목록이 노출되지 않았다는 뜻입니다."}
      />
      {recentPublications.length > 0 ? (
        <div className="official-publication-list">
          {recentPublications.map((publication) => (
            <article key={publication.id}>
              <BookOpenCheck size={18} />
              <div>
                <h3>{publication.title}</h3>
                <p>{publication.publicationType} · {publication.publishedDate ?? "발행일 미기재"}</p>
                <small>{publication.id}</small>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Card className="official-publication-empty">
          <CircleAlert size={18} />
          <div>
            <strong>{professor.publicationsStatus}</strong>
            <p>공식 프로필에 논문 목록이 노출되지 않아 논문 근거를 만들지 않았습니다.</p>
          </div>
        </Card>
      )}

      <SectionHeading title="공식 출처" description={`수집일 ${new Date(professor.collectedAt).toLocaleDateString("ko-KR")}`} />
      <div className="official-source-actions">
        <Link href={professor.officialProfileUrl} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={17} /> 대학 공식 프로필 열기
        </Link>
        <Link href={professor.sourceUrl} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={17} /> 학과 교수 목록 열기
        </Link>
      </div>
      <StatusBanner icon={CircleAlert} title="직접 확인할 점" tone="warning">
        교수의 면담·지도·모집 가능 여부는 수집하거나 추정하지 않습니다. 연락 전 공식 페이지의 최신 안내를 직접 확인하세요.
      </StatusBanner>
    </AppShell>
  );
}
