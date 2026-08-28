"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleHelp,
  FlaskConical,
  GitBranch,
  GraduationCap,
  Lightbulb,
  ListChecks,
  MessageCircleMore,
  Save,
  SearchCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import styles from "./landing-product-preview.module.css";

type PreviewId = "ai-professor" | "professor-match" | "project-design";

const PREVIEWS = [
  {
    id: "professor-match" as const,
    tab: "교수 3인 피칭",
    eyebrow: "가까운 연결부터 역할별 비교",
    title: "한 줄 순위 대신, 왜 이 교수님과 이야기할지 비교합니다.",
    description:
      "내 학과에서 먼저 이야기하기 쉬운 교수 한 명과, 다른 학과의 주제·방법 연결 교수를 함께 보여줍니다. 공식 근거, 확인할 점, 첫 질문이 한 카드 안에서 이어져요.",
    features: ["내 학과 연결 한 명", "주제·방법 역할 구분", "공식 근거와 첫 질문"],
    href: "/tutorial",
    cta: "내 교수 연결 시작하기",
  },
  {
    id: "project-design" as const,
    tab: "AI 프로젝트 설계",
    eyebrow: "관심을 실행 가능한 주제로",
    title: "한 번에 한 질문씩 답하며 프로젝트의 범위를 좁혀갑니다.",
    description:
      "공통 질문으로 출발점을 잡고, 앞선 답변에 따라 달라지는 맞춤 질문으로 문제·방법·결과물을 구체화합니다. 완성한 프로젝트에는 필요한 전문성의 교수를 다시 연결해요.",
    features: ["공통 질문 뒤 맞춤 질문", "답변 방향을 직접 선택", "프로젝트 기반 교수 추천"],
    href: "/research/tutorial",
    cta: "프로젝트 설계 시작하기",
  },
  {
    id: "ai-professor" as const,
    tab: "AI 상상나무",
    eyebrow: "저장하고 다시 이어가는 AI 성장 파트너",
    title: "AI와 나눈 대화를, 다시 이어갈 수 있는 생각의 기록으로 바꿉니다.",
    description:
      "저장한 전공·관심·프로젝트·연결 교수 맥락만 참고해 짧게 대화하고, 실제 대화를 생각 카드와 갈래 지도로 정리합니다. 이전 기록을 다시 열거나 새 대화를 시작해도 원문과 생각의 흐름은 남아요.",
    features: ["저장한 내 맥락만 참고", "질문·발견·선택·행동 카드화", "선택한 카드에서 새 갈래 시작", "대화·지도·성장 메모를 따로 보존"],
    href: "/portfolio/ai-professor",
    cta: "AI 교수님과 첫 대화하기",
  },
] as const;

const AI_MAP_BRANCHES = [
  {
    id: "data",
    tone: "mint",
    clue: {
      icon: Lightbulb,
      label: "발견한 단서",
      title: "데이터 분석 경험",
      copy: "공공데이터로 흥미를 확인해요",
    },
    next: {
      icon: ListChecks,
      label: "다음 발걸음",
      title: "2주 분석 노트",
      copy: "결과를 한 페이지로 남겨요",
    },
  },
  {
    id: "ml",
    tone: "violet",
    clue: {
      icon: CircleHelp,
      label: "새로 생긴 질문",
      title: "모델 만들기도 궁금해요",
      copy: "분석과 개발의 차이를 비교해요",
    },
    next: {
      icon: FlaskConical,
      label: "비교 실험",
      title: "작은 분류 모델",
      copy: "직접 만들며 필요한 역량을 봐요",
    },
  },
  {
    id: "mentor",
    tone: "navy",
    clue: {
      icon: SearchCheck,
      label: "확인할 관점",
      title: "혼자 결정하지 않기",
      copy: "교수님께 물어볼 기준을 정리해요",
    },
    next: {
      icon: Target,
      label: "대화 준비",
      title: "첫 질문 세 가지",
      copy: "진로와 프로젝트 조언을 연결해요",
    },
  },
] as const;

export function LandingProductPreview() {
  const [activeId, setActiveId] = useState<PreviewId>("professor-match");
  const active = PREVIEWS.find((preview) => preview.id === activeId) ?? PREVIEWS[0];

  const moveTab = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (currentIndex + 1) % PREVIEWS.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (currentIndex - 1 + PREVIEWS.length) % PREVIEWS.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = PREVIEWS.length - 1;
    if (nextIndex === currentIndex) return;
    event.preventDefault();
    const next = PREVIEWS[nextIndex];
    setActiveId(next.id);
    requestAnimationFrame(() => document.getElementById(`preview-tab-${next.id}`)?.focus());
  };

  return (
    <section id="preview" className={styles.section} aria-labelledby="product-preview-title">
      <div className={styles.inner}>
        <header className={styles.heading}>
          <span><Sparkles size={15} aria-hidden="true" /> 실제 서비스 미리보기</span>
          <h2 id="product-preview-title">
            설명만 듣지 말고,
            <br />실제 흐름을 먼저 살펴보세요.
          </h2>
          <p>입력에 따라 달라지는 교수 연결·프로젝트·성장 화면을 미리 보세요. 처음 여는 탭에서는 화면 안내 AI가 핵심 카드와 버튼을 한 번만 짚어줘요.</p>
        </header>

        <div className={styles.tabs} role="tablist" aria-label="서비스 화면 선택">
          {PREVIEWS.map((preview, index) => (
            <button
              key={preview.id}
              id={`preview-tab-${preview.id}`}
              type="button"
              role="tab"
              aria-selected={activeId === preview.id}
              aria-controls={`preview-panel-${preview.id}`}
              tabIndex={activeId === preview.id ? 0 : -1}
              onClick={() => setActiveId(preview.id)}
              onKeyDown={(event) => moveTab(event, index)}
            >
              {preview.id === "ai-professor" ? <Bot size={17} /> : null}
              {preview.id === "professor-match" ? <GraduationCap size={18} /> : null}
              {preview.id === "project-design" ? <FlaskConical size={17} /> : null}
              {preview.tab}
            </button>
          ))}
        </div>

        <div
          id={`preview-panel-${active.id}`}
          className={styles.panel}
          role="tabpanel"
          aria-labelledby={`preview-tab-${active.id}`}
        >
          <div className={styles.copy}>
            <span>{active.eyebrow}</span>
            <h3>{active.title}</h3>
            <p>{active.description}</p>
            <ul>
              {active.features.map((feature) => (
                <li key={feature}><CheckCircle2 size={16} aria-hidden="true" /> {feature}</li>
              ))}
            </ul>
            <Link href={active.href}>
              {active.cta} <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>

          <figure className={styles.browserFrame} aria-label={`${active.tab} 실제 서비스 화면 예시`}>
            <div className={styles.browserTopbar} aria-hidden="true">
              <span /><span /><span />
              <strong>너의 교수님은?</strong>
              <small>실제 서비스 화면 예시</small>
            </div>
            {active.id === "ai-professor" ? <AiProfessorPreview /> : null}
            {active.id === "professor-match" ? <ProfessorMatchPreview /> : null}
            {active.id === "project-design" ? <ProjectDesignPreview /> : null}
            <figcaption className={styles.screenReaderOnly}>{active.tab} 기능을 축약해 보여주는 실제 MVP 예시 화면</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

function AiProfessorPreview() {
  return (
    <div className={styles.aiPreview}>
      <section className={styles.mapPane} aria-label="AI 대화에서 만들어진 상상나무 예시">
        <header>
          <GitBranch size={16} aria-hidden="true" />
          <strong>나의 상상나무</strong>
          <span>대화 4개 · 생각 7개 · 갈림점 3개</span>
        </header>
        <div className={styles.thoughtMap}>
          <span className={styles.mapStart}><MessageCircleMore size={13} /> 대화 시작</span>
          <span className={styles.mapStem} aria-hidden="true" />
          <article className={styles.mapRoot}>
            <span><CircleHelp size={12} /> 생각 씨앗</span>
            <strong>AI 진로의 첫 경험 찾기</strong>
            <small>전공을 살릴 두 방향을 비교해요</small>
          </article>
          <span className={styles.mapFork} aria-hidden="true" />
          <div className={styles.mapBranches} role="list" aria-label="대화에서 갈라진 세 가지 생각 흐름">
            {AI_MAP_BRANCHES.map((branch) => {
              const ClueIcon = branch.clue.icon;
              const NextIcon = branch.next.icon;
              return (
                <div
                  key={branch.id}
                  className={styles.mapBranch}
                  data-tone={branch.tone}
                  data-selected={branch.id === "data" ? "true" : "false"}
                  role="listitem"
                >
                  <span className={styles.mapBranchStem} aria-hidden="true" />
                  <article className={styles.mapNode} data-selected={branch.id === "data" ? "true" : "false"}>
                    <span><ClueIcon size={11} aria-hidden="true" /> {branch.clue.label}</span>
                    <strong>{branch.clue.title}</strong>
                    <small>{branch.clue.copy}</small>
                  </article>
                  <span className={styles.mapBranchStem} aria-hidden="true" />
                  <article className={`${styles.mapNode} ${styles.mapNodeNext}`}>
                    <span><NextIcon size={11} aria-hidden="true" /> {branch.next.label}</span>
                    <strong>{branch.next.title}</strong>
                    <small>{branch.next.copy}</small>
                  </article>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <aside className={styles.aiPreviewDetail} aria-label="선택한 생각 카드 상세 예시">
        <header>
          <div><span>발견</span><span>진로 방향</span></div>
          <small>선택한 생각 1 / 7</small>
        </header>
        <h4>데이터 분석 경험</h4>
        <p>공공데이터로 작은 분석을 해보며 내가 흥미를 느끼는 지점을 확인해요.</p>
        <div className={styles.previewBranchAction}>
          <span><GitBranch size={15} aria-hidden="true" /></span>
          <div><strong>이 카드에서 가지치기</strong><small>이 생각을 출발점으로 새 질문을 시작해요</small></div>
          <ArrowRight size={15} aria-hidden="true" />
        </div>
        <section className={styles.previewSource}>
          <header><Bot size={14} aria-hidden="true" /><strong>이 카드가 나온 대화</strong></header>
          <article><span>내 질문</span><p>데이터 분석부터 경험해 보고 싶어요.</p></article>
          <article><span>AI 교수님</span><p>작은 분석 경험으로 관심과 필요한 역량을 먼저 확인해 볼 수 있어요.</p></article>
        </section>
        <div className={styles.previewRecordStatus} aria-label="AI 교수님 대화 저장 기능 예시">
          <span><Save size={12} aria-hidden="true" /> 대화·생각 지도 함께 저장</span>
          <span><MessageCircleMore size={12} aria-hidden="true" /> 저장본을 다시 열거나 새 대화 시작</span>
        </div>
        <p className={styles.previewBranchNote}><CheckCircle2 size={13} aria-hidden="true" /> 기존 대화는 그대로 남고 새 가지가 옆에 자라요.</p>
      </aside>
    </div>
  );
}

function ProfessorMatchPreview() {
  const cards = [
    { icon: GraduationCap, type: "내 학과 연결", role: "가까운 시작점", title: "우리 학과 교수님", copy: "전공 수업과 학과 맥락 안에서 첫 질문을 시작해요." },
    { icon: SearchCheck, type: "주제 연결", role: "관심 길잡이", title: "관심 주제 교수님", copy: "공식 연구 주제에서 내 관심과 만나는 근거를 확인해요." },
    { icon: FlaskConical, type: "방법 연결", role: "방법 코치", title: "실행 방법 교수님", copy: "프로젝트에 필요한 데이터·실험 방법을 함께 비교해요." },
  ] as const;

  return (
    <div className={styles.matchPreview}>
      <header><div><span>교수 3인 피칭</span><strong>역할이 다른 세 분을 비교해보세요</strong></div><small>공식 정보 기반</small></header>
      <div className={styles.matchCards}>
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.type}>
              <div className={styles.matchCardTop}><span><Icon size={17} /></span><small>{card.role}</small></div>
              <em>{card.type}</em>
              <strong>{card.title}</strong>
              <p>{card.copy}</p>
              <span className={styles.matchCardAction}>연결 근거 보기 <ArrowRight size={13} /></span>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function ProjectDesignPreview() {
  const options = [
    { icon: Target, title: "문제를 더 좁혀보기", copy: "누구의 어떤 불편을 다룰지 정해요." },
    { icon: FlaskConical, title: "사용할 방법 비교하기", copy: "데이터와 실행 조건을 함께 봐요." },
    { icon: Lightbulb, title: "가능성을 열어두기", copy: "답변에 따라 다음 질문이 달라져요." },
  ] as const;

  return (
    <div className={styles.projectPreview}>
      <section className={styles.projectQuestion}>
        <span><Sparkles size={14} /> AI 공동설계 · 2 / 5</span>
        <h4>이 아이디어로 가장 먼저 바꾸고 싶은 것은 무엇인가요?</h4>
        <p>앞선 답변을 반영해 질문을 하나씩 보여드려요.</p>
        <div><strong>내 답변</strong><span>학생이 실제로 겪는 진로 정보의 막막함을 줄이고 싶어요.</span></div>
      </section>
      <section className={styles.projectOptions}>
        <header><strong>이어갈 방향</strong><small>한 가지를 골라보세요</small></header>
        {options.map((option, index) => {
          const Icon = option.icon;
          return (
            <article key={option.title} data-selected={index === 0 ? "true" : "false"}>
              <span><Icon size={17} /></span>
              <div><strong>{option.title}</strong><p>{option.copy}</p></div>
              <i>{index === 0 ? <CheckCircle2 size={17} /> : null}</i>
            </article>
          );
        })}
      </section>
    </div>
  );
}
