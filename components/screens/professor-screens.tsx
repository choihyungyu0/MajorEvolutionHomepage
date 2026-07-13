"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BookOpenCheck,
  Bookmark,
  CalendarCheck,
  Check,
  ChevronRight,
  CircleHelp,
  ExternalLink,
  GitCompareArrows,
  Info,
  LoaderCircle,
  Microscope,
  Save,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { BottomSheet } from "@/components/app/bottom-sheet";
import { ScoreRing } from "@/components/app/data-visuals";
import {
  AppShell,
  Card,
  ChoiceChip,
  IconButton,
  PageHeader,
  PrimaryButton,
  SaveButton,
  SectionHeading,
  StatusBanner,
  Tag,
  TextButton,
  cx,
} from "@/components/app/primitives";
import { professors, type Professor } from "@/data/prototype";
import { requestAiCoach } from "@/lib/ai-client";
import { getAvailableIdeas } from "@/lib/ai-journey";
import { usePrototypeStore } from "@/store/prototype-store";

function ConfidenceBadge({ value, onExplain }: { value: Professor["confidence"]; onExplain?: () => void }) {
  const label = value === "high" ? "근거 신뢰도 높음" : "근거 신뢰도 보통";
  return (
    <button type="button" className={cx("confidence-badge", value === "medium" && "is-medium")} onClick={onExplain}>
      <ShieldCheck size={14} aria-hidden="true" /> {label} {onExplain && <Info size={13} aria-hidden="true" />}
    </button>
  );
}
function ProfessorCard({
  professor,
  featured,
  saved,
  compared,
  comparisonDisabled,
  onSave,
  onCompare,
  onOpen,
  onConfidence,
}: {
  professor: Professor;
  featured?: boolean;
  saved: boolean;
  compared: boolean;
  comparisonDisabled: boolean;
  onSave: () => void;
  onCompare: () => void;
  onOpen: () => void;
  onConfidence: () => void;
}) {
  return (
    <article className={cx("professor-card", featured && "is-featured", compared && "is-compared")}>
      <header className="professor-card__header">
        <Image src={professor.portrait} alt="" width={64} height={64} />
        <div><Tag tone={featured ? "violet" : "blue"}>{professor.role} 연결</Tag><h2>{professor.name}</h2><p>{professor.affiliation}</p></div>
        <ScoreRing score={professor.matchScore} compact />
      </header>
      <ConfidenceBadge value={professor.confidence} onExplain={onConfidence} />
      <div className="tag-row">{professor.keywords.map((keyword) => <Tag key={keyword}>{keyword}</Tag>)}</div>
      <div className="professor-reason"><strong>추천 이유</strong><p>{professor.reason}</p></div>
      <div className="source-meta"><BookOpenCheck size={15} /> 공식 출처 {professor.sources.length}개 · {professor.verifiedAt} 검증</div>
      <footer className="professor-card__actions">
        <button type="button" className="card-action" onClick={onCompare} disabled={comparisonDisabled} aria-pressed={compared}>
          <GitCompareArrows size={17} /> {compared ? "비교에서 빼기" : "비교 담기"}
        </button>
        <IconButton label={saved ? "교수 저장 취소" : "교수 저장"} active={saved} onClick={onSave}><Bookmark size={18} fill={saved ? "currentColor" : "none"} /></IconButton>
        <button type="button" className="card-action card-action--primary" onClick={onOpen}>상세 보기 <ChevronRight size={17} /></button>
      </footer>
    </article>
  );
}

export function ProfessorsScreen() {
  const router = useRouter();
  const filter = usePrototypeStore((state) => state.professorFilter);
  const setFilter = usePrototypeStore((state) => state.setProfessorFilter);
  const saved = usePrototypeStore((state) => state.savedProfessorIds);
  const toggleSaved = usePrototypeStore((state) => state.toggleSavedProfessor);
  const compared = usePrototypeStore((state) => state.comparedProfessorIds);
  const toggleCompared = usePrototypeStore((state) => state.toggleComparedProfessor);
  const setSelectedProfessor = usePrototypeStore((state) => state.setSelectedProfessor);
  const [confidenceOpen, setConfidenceOpen] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const filtered = filter === "전체" ? professors : professors.filter((professor) => professor.role === filter);
  const comparedProfessors = compared.map((id) => professors.find((professor) => professor.id === id)).filter(Boolean) as Professor[];

  const openProfessor = (professor: Professor) => {
    setSelectedProfessor(professor.id);
    router.push(`/professors/${professor.id}`);
  };

  return (
    <AppShell title="너의 교수님은?" backHref="/passport">
      <PageHeader
        eyebrow="아이디어 기반 교수 추천"
        title="이 아이디어를 함께 발전시킬 교수님을 찾았어요"
        description="교수님의 우열이 아니라, 공개 정보와 현재 아이디어의 연결 정도예요."
      />
      <StatusBanner icon={SearchCheck} title="프로토타입용 가상 데이터" tone="lavender">
        이름과 학교, 연구실은 화면 흐름 검증을 위해 만든 가상 정보예요.
      </StatusBanner>

      <SectionHeading title="연결 역할로 보기" />
      <div className="filter-scroll">
        {(["전체", "연구 주제", "방법론", "프로젝트·수업"] as const).map((item) => (
          <ChoiceChip key={item} selected={filter === item} onClick={() => setFilter(item)}>{item}</ChoiceChip>
        ))}
      </div>

      <div className="professor-compare-status">
        <span><GitCompareArrows size={17} /> 비교 후보 <strong>{compared.length}/2</strong></span>
        <TextButton disabled={compared.length !== 2} onClick={() => setComparisonOpen(true)}>비교 보기</TextButton>
      </div>

      <div className="professor-list">
        {filtered.map((professor, index) => (
          <ProfessorCard
            key={professor.id}
            professor={professor}
            featured={filter === "전체" && index === 0}
            saved={saved.includes(professor.id)}
            compared={compared.includes(professor.id)}
            comparisonDisabled={!compared.includes(professor.id) && compared.length >= 2}
            onSave={() => toggleSaved(professor.id)}
            onCompare={() => toggleCompared(professor.id)}
            onOpen={() => openProfessor(professor)}
            onConfidence={() => setConfidenceOpen(true)}
          />
        ))}
      </div>

      <p className="virtual-data-note">모든 교수 정보는 프로토타입용 가상 데이터입니다.</p>

      <BottomSheet open={confidenceOpen} onClose={() => setConfidenceOpen(false)} title="근거 신뢰도란?">
        <div className="confidence-explain">
          <div><Tag tone="mint">높음</Tag><p>공식 출처가 2개 이상이고 최근 검증했어요.</p></div>
          <div><Tag tone="blue">보통</Tag><p>공식 출처는 있지만 일부 정보가 오래되거나 부족해요.</p></div>
          <div><Tag tone="warning">확인 필요</Tag><p>공식 정보가 제한적이어서 원문 확인이 필요해요.</p></div>
        </div>
      </BottomSheet>

      <BottomSheet open={comparisonOpen} onClose={() => setComparisonOpen(false)} title="교수 연결 비교" description="교수님의 우열이 아니라 현재 아이디어와의 연결 역할을 비교해요.">
        <div className="professor-comparison">
          {comparedProfessors.map((professor) => (
            <div key={professor.id}>
              <Image src={professor.portrait} alt="" width={56} height={56} />
              <h3>{professor.name}</h3>
              <Tag tone="violet">{professor.role}</Tag>
              <dl><div><dt>추천 적합도</dt><dd>{professor.matchScore}</dd></div><div><dt>근거</dt><dd>{professor.sources.length}개</dd></div></dl>
              <p>{professor.reason}</p>
              <PrimaryButton onClick={() => { setComparisonOpen(false); openProfessor(professor); }}>상세 보기</PrimaryButton>
            </div>
          ))}
        </div>
      </BottomSheet>
    </AppShell>
  );
}

export function ProfessorDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const professor = professors.find((item) => item.id === id) ?? professors[0];
  const saved = usePrototypeStore((state) => state.savedProfessorIds.includes(professor.id));
  const toggleSaved = usePrototypeStore((state) => state.toggleSavedProfessor);
  const setSelectedProfessor = usePrototypeStore((state) => state.setSelectedProfessor);
  const profile = usePrototypeStore((state) => state.profile);
  const selectedIdeaId = usePrototypeStore((state) => state.selectedIdeaId);
  const aiJourney = usePrototypeStore((state) => state.aiJourney);
  const aiIdeaArchive = usePrototypeStore((state) => state.aiIdeaArchive);
  const idea = [...getAvailableIdeas(aiJourney), ...aiIdeaArchive].find((item) => item.id === selectedIdeaId);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [confidenceOpen, setConfidenceOpen] = useState(false);
  const [sourceIndex, setSourceIndex] = useState<number | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const createQuest = () => {
    setSelectedProfessor(professor.id);
    router.push("/quest");
  };

  const runAiHelp = async (task: "interview-question" | "idea-summary") => {
    setAiLoading(true);
    try {
      const result = await requestAiCoach({ task, context: { profile, idea, professor } });
      setAiResult(result.content);
      setAiOpen(false);
    } catch (error) {
      setAiResult(error instanceof Error ? error.message : "면담 문장을 만들지 못했습니다.");
      setAiOpen(false);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <AppShell
      title="교수 적합 상세"
      backHref="/professors"
      stickyAction={<><SaveButton saved={saved} onClick={() => toggleSaved(professor.id)} label="교수 저장" /><PrimaryButton onClick={createQuest}>면담 준비 퀘스트 만들기</PrimaryButton></>}
    >
      <p className="virtual-data-pill">프로토타입용 가상 데이터</p>
      <section className="professor-hero">
        <div className="professor-identity"><Image src={professor.portrait} alt="" width={64} height={64} /><div><h1>{professor.name}</h1><p>{professor.affiliation}</p></div></div>
        <div className="professor-score-area">
          <button type="button" onClick={() => setScoreOpen(true)} className="score-button"><ScoreRing score={professor.matchScore} /><span><Info size={14} /> 점수 설명</span></button>
          <ConfidenceBadge value={professor.confidence} onExplain={() => setConfidenceOpen(true)} />
        </div>
        <div className="tag-row">{professor.keywords.map((keyword) => <Tag key={keyword}>{keyword}</Tag>)}</div>
      </section>

      <SectionHeading title="추천 이유 3가지" description="사실과 현재 아이디어의 연결을 나눠 보여드려요." />
      <div className="evidence-list">
        {professor.evidences.map((evidence, index) => (
          <article key={evidence.title}>
            <span>{index + 1}</span>
            <div><h3>{evidence.title}</h3><p>{evidence.body}</p><small>근거: {evidence.source}</small></div>
          </article>
        ))}
      </div>

      <SectionHeading title="함께 볼 정보" />
      <Card className="course-list">
        {professor.courses.map((course) => <div key={course}><BookOpenCheck size={18} /><span><strong>{course}</strong><small>관련 강의</small></span></div>)}
      </Card>

      <StatusBanner icon={AlertTriangle} title="직접 확인할 점" tone="warning">{professor.checkPoint} 면담 요청 전 최신 정보를 직접 확인해 주세요.</StatusBanner>

      <SectionHeading title="공식 출처" description={`최종 검증 ${professor.verifiedAt}`} />
      <div className="source-list">
        {professor.sources.map((source, index) => (
          <button type="button" key={`${source.type}-${source.title}`} onClick={() => setSourceIndex(index)}>
            <span><BookOpenCheck size={19} /></span><div><Tag tone="blue">{source.type}</Tag><strong>{source.title}</strong><small>검증일 {source.verifiedAt}</small></div><ChevronRight size={18} />
          </button>
        ))}
      </div>

      <div className="context-actions"><TextButton onClick={() => setAiOpen(true)}><WandSparkles size={17} /> 면담 준비를 도와줘</TextButton></div>
      {aiResult && <StatusBanner icon={Sparkles} title="면담용 문장으로 바꿨어요" tone="lavender">{aiResult}</StatusBanner>}

      <BottomSheet open={scoreOpen} onClose={() => setScoreOpen(false)} title="추천 적합도란?">
        <p className="sheet-long-copy">현재 아이디어, 사용자가 입력한 목표, 교수님의 공개 연구 정보 사이의 연결 정도예요. 성공 가능성, 교수님의 우열, 연구실 합격 가능성을 의미하지 않아요.</p>
      </BottomSheet>
      <BottomSheet open={confidenceOpen} onClose={() => setConfidenceOpen(false)} title="근거 신뢰도">
        <p className="sheet-long-copy">공식 교수 소개, 공식 연구실, 공식 강의계획서의 개수와 최신성을 기준으로 표시해요. 정보가 부족하면 점수를 숨기지 않고 직접 확인할 항목을 함께 보여드려요.</p>
      </BottomSheet>
      <BottomSheet open={sourceIndex !== null} onClose={() => setSourceIndex(null)} title="출처 상세">
        {sourceIndex !== null && <div className="source-detail"><Tag tone="blue">{professor.sources[sourceIndex].type}</Tag><h3>{professor.sources[sourceIndex].title}</h3><p>추천 이유와 연구 키워드 연결에 사용한 프로토타입용 출처 항목이에요.</p><small>검증일 {professor.sources[sourceIndex].verifiedAt}</small><p className="source-caution"><Info size={15} /> 가상 데이터라 실제 외부 페이지로 이동하지 않아요.</p></div>}
      </BottomSheet>
      <BottomSheet open={aiOpen} onClose={() => setAiOpen(false)} title="어떤 준비가 필요하세요?">
        <div className="sheet-choice-list">
          <button type="button" disabled={aiLoading} onClick={() => runAiHelp("interview-question")}>{aiLoading ? <LoaderCircle size={19} className="spin" /> : <CircleHelp size={19} />}<span><strong>교수님께 물어볼 질문 만들기</strong><small>현재 아이디어와 확인할 점을 면담 문장으로 연결해요.</small></span><ChevronRight size={18} /></button>
          <button type="button" disabled={aiLoading} onClick={() => runAiHelp("idea-summary")}>{aiLoading ? <LoaderCircle size={19} className="spin" /> : <Microscope size={19} />}<span><strong>내 아이디어를 3문장으로 설명해줘</strong><small>면담 첫 설명에 바로 쓸 수 있게 줄여요.</small></span><ChevronRight size={18} /></button>
        </div>
      </BottomSheet>
    </AppShell>
  );
}
