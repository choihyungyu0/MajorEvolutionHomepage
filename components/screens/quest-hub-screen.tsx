"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarCheck,
  Check,
  Compass,
  FileText,
  LoaderCircle,
  Mail,
  MessageCircleQuestion,
  MessageSquareText,
  NotebookPen,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  AppShell,
  ChoiceChip,
  Tag,
} from "@/components/app/primitives";
import { ServiceBottomNav } from "@/components/app/side-nav";
import {
  HubAdaptiveLayout,
  HubList,
  HubPrimaryTask,
  HubRow,
  HubUtilityLink,
  HubUtilityLinks,
  serviceHubStyles as styles,
} from "@/components/app/service-hub";
import { JourneyStageHero } from "@/components/app/journey-stage-hero";
import { SceneBanner } from "@/components/app/scene-banner";
import { brandScene, questIcon } from "@/lib/brand-assets";
import { getJourneyProgress } from "@/lib/journey-progress";
import { useQuestContext } from "@/lib/quest-context";
import { buildProfessorConnectionSavedSections } from "@/lib/quest-saved-records";
import { getQuestToolCompletionCounts, getRecommendedQuestToolId } from "@/lib/quest-tools-hierarchy";
import { cardsForTool, useQuestStore, type QuestToolId } from "@/store/quest-store";
import { useResearchStore } from "@/store/research-store";
import questStyles from "./quest-hub-screen.module.css";

/**
 * Q-00 교수님 퀘스트 허브.
 *
 * 만나기 전·대화 중·만난 후의 작은 도구를 한곳에 모읍니다.
 * 연락과 면담은 학생이 직접 하고, 앱은 준비·검토·기록만 돕습니다.
 */

type Timing = "before" | "during" | "after";

const TIMING_LABEL: Record<Timing, string> = {
  before: "만나기 전",
  during: "대화 중",
  after: "만난 후",
};

type Tool = {
  id: QuestToolId;
  code: string;
  name: string;
  timings: Timing[];
  summary: string;
  /** 이 도구가 학생에게 남기는 결과물. */
  output: string;
  icon: string;
  href: string | null;
  /** 아직 결과가 온전히 나오지 않는 도구에 붙이는 솔직한 상태 문구. */
  note?: string;
};

const TOOLS: Tool[] = [
  {
    id: "paper-bite",
    code: "Q01",
    name: "논문 한입",
    timings: ["before"],
    summary: "문제·방법·결과·질문을 3분 카드로 정리",
    output: "문제·방법·결과·한계·질문 5카드",
    icon: questIcon.paperBite,
    href: "/paper/reader?mode=bite&source=favorites",
    note: "텍스트 분석은 지금 사용할 수 있어요. PDF 페이지 근거는 후속 모듈이에요.",
  },
  {
    id: "first-line",
    code: "Q02",
    name: "첫마디 랜덤박스",
    timings: ["before"],
    summary: "상황·목적·말투를 고른 첫 문장 1개",
    output: "학생이 수정 가능한 첫 문장",
    icon: questIcon.firstLine,
    href: "/quest/first-line",
  },
  {
    id: "silence-rescue",
    code: "Q03",
    name: "침묵 구조대",
    timings: ["during"],
    summary: "말이 끊겼을 때 미리 저장한 질문을 조용히 확인",
    output: "오프라인 큰 글자 질문 카드",
    icon: questIcon.silenceRescue,
    href: "/quest/silence-rescue",
  },
  {
    id: "email-guard",
    code: "Q04",
    name: "메일 흑역사 방지기",
    timings: ["before", "after"],
    summary: "과한 아부·모호한 요청·무례한 표현 점검",
    output: "이유·수정안·검토 후 복사",
    icon: questIcon.emailGuard,
    href: "/quest/email-guard",
  },
  {
    id: "next-seed",
    code: "Q05",
    name: "다음 만남 씨앗",
    timings: ["after"],
    summary: "피드백을 이번 주 행동과 다시 보여줄 결과물로 변환",
    output: "행동·결과물·후속 질문",
    icon: questIcon.nextSeed,
    href: "/mentor-loop",
  },
];

const TOOL_NAME = new Map(TOOLS.map((tool) => [tool.id, tool.name]));

const TIMING_DESCRIPTION: Record<Timing, string> = {
  before: "논문과 첫 질문, 연락 문장을 준비해 첫 만남의 부담을 줄여요.",
  during: "대화가 잠시 멈춰도 바로 확인할 질문을 미리 챙겨요.",
  after: "들은 조언을 기록하고 다음 행동과 후속 연락으로 이어가요.",
};

function QuestToolCard({
  tool,
  saved,
  favoriteProfessorIds,
  featured = false,
  onStart,
}: {
  tool: Tool;
  saved: number;
  favoriteProfessorIds: string[];
  featured?: boolean;
  onStart: (href: string) => void;
}) {
  const ready = Boolean(tool.href);
  return (
    <article
      className={[
        "quest-tool",
        questStyles.catalogTool,
        featured ? questStyles.catalogToolFeatured : "",
        ready ? "" : "is-pending",
      ].filter(Boolean).join(" ")}
      aria-labelledby={`catalog-tool-${tool.id}`}
    >
      <header>
        <Image src={tool.icon} alt="" aria-hidden="true" width={48} height={48} loading="eager" unoptimized />
        <div>
          <span className="quest-tool__code">{tool.code}</span>
          <h2 id={`catalog-tool-${tool.id}`}>{tool.name}</h2>
        </div>
      </header>
      <div className="tag-row">
        {tool.timings.map((item) => <Tag key={item} tone="violet">{TIMING_LABEL[item]}</Tag>)}
        {saved > 0 ? <Tag tone="mint">저장 {saved}장</Tag> : null}
        {tool.id === "paper-bite" ? (
          <Tag tone={favoriteProfessorIds.length > 0 ? "mint" : "warning"}>
            즐겨찾는 교수 {favoriteProfessorIds.length}명
          </Tag>
        ) : null}
      </div>
      <p className="quest-tool__summary">{tool.summary}</p>
      <p className="quest-tool__output"><span>결과</span> {tool.output}</p>
      {tool.note ? <p className="quest-tool__note">{tool.note}</p> : null}
      {ready && tool.href ? (
        <button type="button" onClick={() => onStart(tool.href!)}>
          {tool.id === "paper-bite" ? "교수님 논문 고르기" : saved > 0 ? "다시 열기" : "시작하기"}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      ) : (
        <p className="quest-tool__pending">아직 열지 않은 도구입니다.</p>
      )}
    </article>
  );
}

export function QuestHubScreen() {
  const hasHydrated = useQuestStore((state) => state.hasHydrated);
  const hasResearchHydrated = useResearchStore((state) => state.hasHydrated);
  const knockKitDrafts = useResearchStore((state) => state.knockKitDrafts);
  const mentorLoopEntries = useResearchStore((state) => state.mentorLoopEntries);
  const cards = useQuestStore((state) => state.cards);
  const { topic, match: selectedProfessorMatch } = useQuestContext();

  if (!hasHydrated || !hasResearchHydrated) {
    return (
      <div className="research-loading">
        <LoaderCircle className="spin" />
        <p>저장한 대화 준비를 불러오고 있어요.</p>
      </div>
    );
  }

  const selectedProfessor = selectedProfessorMatch?.professor ?? null;
  const progress = getJourneyProgress({
    topicId: topic?.id ?? null,
    professorId: selectedProfessor?.id ?? null,
    cards,
    emailDrafts: knockKitDrafts,
    mentorEntries: mentorLoopEntries,
  });
  const paperCount = progress.before.paper;
  const questionCount = progress.before.question;
  const silenceCount = progress.during.total;
  const emailCount = progress.before.email;
  const afterCount = progress.after.total;
  const beforeCount = progress.before.total;
  const savedSections = buildProfessorConnectionSavedSections({
    cards,
    emailDrafts: knockKitDrafts,
    mentorEntries: mentorLoopEntries,
  });
  const savedRecordCount = savedSections.reduce(
    (sum, section) => sum + section.records.length,
    0,
  );
  const hasConnectedProfessor = progress.readySteps.professor;

  const primary = !hasConnectedProfessor
      ? {
          icon: Compass,
          heading: "먼저 대화할 교수를 고를 차례예요",
          taskTitle: "만남 준비 시작 · 교수 선택",
        description: "연결 이유를 확인하고 저장하면, 그 교수에게 맞춘 준비가 시작돼요.",
        cta: "교수 찾기",
        href: "/professors",
      }
    : paperCount === 0
      ? {
          icon: BookOpenCheck,
          heading: selectedProfessor
            ? `${selectedProfessor.name} 교수님의 연구를 살펴볼 차례예요`
            : "교수님의 연구를 살펴볼 차례예요",
          taskTitle: "만나기 전 · 논문 한입 준비",
          description: "공식 프로필의 논문을 문제·방법·결과·질문으로 가볍게 정리해요.",
          cta: "논문 한입 시작하기",
          href: "/paper/reader?mode=bite&source=favorites",
        }
      : questionCount === 0
        ? {
            icon: MessageCircleQuestion,
            heading: "지금은 첫 질문을 준비할 차례예요",
            taskTitle: "만나기 전 · 첫 질문 3개 준비",
            description: "교수님께 궁금한 점을 정리하고 첫 대화의 실마리를 만들어요.",
            cta: "질문 준비하기",
            href: "/quest/first-line",
          }
        : emailCount === 0
          ? {
              icon: Mail,
              heading: "첫 연락을 보내기 전에 점검해 볼까요?",
              taskTitle: "첫 연락 준비 · 이메일 초안 점검",
              description: "연결 이유와 요청을 담아 목적별 이메일 초안을 준비해요.",
              cta: "이메일 준비하기",
              href: "/quest/email-guard",
            }
          : afterCount === 0
            ? {
                icon: CalendarCheck,
                heading: "면담에서 들은 조언을 행동으로 바꿔보세요",
                taskTitle: "만난 후 · 7일 행동 정리",
                description: "이번 주에 할 일과 다시 보여줄 결과물을 짧게 남겨요.",
                cta: "면담 후 기록하기",
                href: "/mentor-loop",
              }
            : {
                icon: NotebookPen,
                heading: "준비하며 달라진 과정을 확인해 보세요",
                taskTitle: "나의 성장 과정 보기",
                description: "저장한 근거와 질문, 다음 행동을 성장 기록에서 이어 봐요.",
                cta: "성장 기록 보기",
                href: "/portfolio",
              };

  const beforeDoneCount = [paperCount > 0, questionCount > 0, emailCount > 0]
    .filter(Boolean).length;
  const meetingSteps = [
    {
      id: "professor",
      label: "교수 선택",
      status: hasConnectedProfessor ? "연결 완료" : "먼저 선택",
      href: selectedProfessor ? `/professors/${selectedProfessor.id}?from=quest` : "/professors",
      icon: Compass,
      done: hasConnectedProfessor,
    },
    {
      id: "before",
      label: "만나기 전",
      status: `${beforeDoneCount}/3 준비`,
      href: hasConnectedProfessor
        ? paperCount === 0
          ? "/paper/reader?mode=bite&source=favorites"
          : questionCount === 0
            ? "/quest/first-line"
            : "/quest/email-guard"
        : "/professors",
      icon: BookOpenCheck,
      done: beforeDoneCount === 3,
    },
    {
      id: "during",
      label: "대화 중",
      status: silenceCount ? "질문 저장" : "질문 준비",
      href: "/quest/silence-rescue",
      icon: MessageSquareText,
      done: silenceCount > 0,
    },
    {
      id: "after",
      label: "만난 후",
      status: afterCount ? "기록 완료" : "면담 후 기록",
      href: "/mentor-loop",
      icon: CalendarCheck,
      done: afterCount > 0,
    },
  ] as const;
  const completedMeetingSteps = meetingSteps.filter((step) => step.done).length;
  const currentMeetingStep = meetingSteps.findIndex((step) => !step.done);
  const mobileCurrentMeetingStep = currentMeetingStep >= 0
    ? currentMeetingStep
    : meetingSteps.length - 1;
  const mobileJourneyStart = mobileCurrentMeetingStep < meetingSteps.length - 1
    ? mobileCurrentMeetingStep
    : Math.max(0, mobileCurrentMeetingStep - 1);
  const progressPercent = Math.round((completedMeetingSteps / meetingSteps.length) * 100);

  return (
    <AppShell showHeader={false} className={`${styles.shell} ${questStyles.meetingShell}`} bottomNav={<ServiceBottomNav />}>
      <div className={`${styles.hub} ${questStyles.questHub}`}>
        <JourneyStageHero
          stage="meeting"
          eyebrow="교수 연결 · 2단계"
          title={selectedProfessor
            ? `${selectedProfessor.name} 교수님과 첫 만남을 준비해요`
            : "교수님과 첫 만남을 준비해요"}
          description="교수 선택부터 연락, 대화 중 질문, 면담 후 행동까지 현재 단계와 다음 할 일을 한 화면에서 이어가요."
        />
        <HubAdaptiveLayout
          layout="stacked"
          contextLabel="현재 교수 연결과 저장한 준비 현황"
          primary={(
            <HubPrimaryTask
              icon={primary.icon}
              title={primary.taskTitle}
              description={primary.description}
              cta={primary.cta}
              href={primary.href}
              secondary={{ label: "전체 준비 도구 보기", href: "/quest/all" }}
            />
          )}
          context={(
            <div className={questStyles.contextRail}>
              <section className={`${questStyles.contextCard} ${questStyles.professorContextCard}`} aria-labelledby="meeting-professor-summary">
                <span className={questStyles.contextEyebrow}>현재 연결</span>
                <h2 id="meeting-professor-summary">
                  {selectedProfessor ? `${selectedProfessor.name} 교수님` : "첫 교수를 선택해 주세요"}
                </h2>
                <p>
                  {selectedProfessor
                    ? `${selectedProfessor.university} · ${selectedProfessor.department}`
                    : "공식 프로필의 연구 분야를 확인한 뒤 첫 대화를 준비할 교수를 골라요."}
                </p>
                {selectedProfessorMatch?.reason ? (
                  <blockquote>{selectedProfessorMatch.reason}</blockquote>
                ) : null}
                <Link
                  href={selectedProfessor ? `/professors/${selectedProfessor.id}?from=quest` : "/professors"}
                  className={questStyles.contextLink}
                >
                  {selectedProfessor ? "연결 근거 다시 보기" : "교수 찾기"}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <Link href="/quest/saved" className={questStyles.mobileSavedLink}>
                  저장한 준비물 {savedRecordCount}개 보기
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </section>

              <section className={`${questStyles.contextCard} ${questStyles.savedContextCard}`} aria-labelledby="meeting-saved-summary">
                <span className={questStyles.contextEyebrow}>준비 현황</span>
                <div className={questStyles.contextHeadingRow}>
                  <h2 id="meeting-saved-summary">저장한 준비물</h2>
                  <strong>{beforeCount + silenceCount + afterCount}개</strong>
                </div>
                <dl className={questStyles.contextStats}>
                  <div><dt>만나기 전</dt><dd>{beforeCount}</dd></div>
                  <div><dt>대화 중</dt><dd>{silenceCount}</dd></div>
                  <div><dt>만난 후</dt><dd>{afterCount}</dd></div>
                </dl>
                <div className={questStyles.contextProgressCopy}>
                  <span>첫 만남 여정</span>
                  <strong>{progressPercent}%</strong>
                </div>
                <div className={questStyles.contextProgressTrack} aria-hidden="true">
                  <span style={{ width: `${progressPercent}%` }} />
                </div>
              </section>
            </div>
          )}
        >
          <section className={questStyles.journey} aria-labelledby="meeting-journey-title">
          <header className={questStyles.journeyHeader}>
            <div>
              <span>첫 만남 여정</span>
              <h2 id="meeting-journey-title">지금 어디까지 준비했나요?</h2>
            </div>
            <strong>{completedMeetingSteps} / {meetingSteps.length} 단계</strong>
          </header>
          <div
            className={questStyles.progressTrack}
            role="progressbar"
            aria-label="첫 만남 준비 진행률"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
          >
            <span style={{ width: `${progressPercent}%` }} />
          </div>
          <div className={questStyles.journeySteps}>
            {meetingSteps.map((step, index) => {
              const Icon = step.icon;
              const isCurrent = currentMeetingStep === index;
              const isMobileVisible = index >= mobileJourneyStart
                && index <= Math.min(mobileJourneyStart + 1, meetingSteps.length - 1);
              return (
                <Link
                  key={step.id}
                  href={step.href}
                  className={`${questStyles.journeyStep}${step.done ? ` ${questStyles.isDone}` : ""}${isCurrent ? ` ${questStyles.isCurrent}` : ""}${isMobileVisible ? ` ${questStyles.mobileVisibleStep}` : ""}`}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  <span className={questStyles.stepIcon}>
                    {step.done ? <Check size={19} aria-hidden="true" /> : <Icon size={19} aria-hidden="true" />}
                  </span>
                  <span className={questStyles.stepCopy}>
                    <small>{index + 1}단계</small>
                    <strong>{step.label}</strong>
                    <em>{step.status}</em>
                  </span>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              );
            })}
          </div>
          </section>
        </HubAdaptiveLayout>

        <div className={questStyles.expandedToolLists}>
          <HubList title="단계별 준비 도구">
            <HubRow
              icon={BookOpenCheck}
              title="만나기 전"
              description="논문 이해 · 첫 질문 · 이메일 준비"
              status={beforeCount ? `${beforeCount}개 저장` : "준비 중"}
              href={paperCount === 0 ? "/paper/reader?mode=bite&source=favorites" : questionCount === 0 ? "/quest/first-line" : "/quest/email-guard"}
              tone="violet"
            />
            <HubRow
              icon={MessageSquareText}
              title="대화 중"
              description="말이 막힐 때 볼 질문을 미리 준비해요."
              status={silenceCount ? `${silenceCount}개 저장` : "시작 전"}
              href="/quest/silence-rescue"
              tone={silenceCount ? "mint" : "neutral"}
            />
            <HubRow
              icon={CalendarCheck}
              title="만난 후"
              description="피드백을 수정 전후와 7일 행동으로 남겨요."
              status={afterCount ? `${afterCount}개 저장` : "시작 전"}
              href="/mentor-loop"
              tone={afterCount ? "mint" : "neutral"}
            />
          </HubList>

          <HubList title="저장한 준비물">
            <HubRow
              icon={FileText}
              title="저장한 준비물"
              description={savedRecordCount ? "질문·논문·메일·면담 후 기록을 한곳에서 확인해요." : "아직 저장한 준비물이 없어요."}
              status={savedRecordCount ? `${savedRecordCount}개` : "비어 있음"}
              href="/quest/saved"
              tone={savedRecordCount ? "mint" : "neutral"}
            />
          </HubList>

          <HubUtilityLinks>
            <HubUtilityLink icon={Sparkles} href="/quest/mini-tools">가볍게 써보는 미니도구</HubUtilityLink>
          </HubUtilityLinks>
        </div>
        <nav className={questStyles.mobileQuickLinks} aria-label="만남 준비 바로가기">
          <Link href="/quest/all">
            전체 도구 <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <Link href="/quest/saved">
            저장 보기 <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <Link href="/quest/mini-tools">
            미니 도구 <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </nav>
      </div>
    </AppShell>
  );
}

export function QuestAllToolsScreen() {
  const router = useRouter();
  const hasHydrated = useQuestStore((state) => state.hasHydrated);
  const hasResearchHydrated = useResearchStore((state) => state.hasHydrated);
  const favoriteProfessorIds = useResearchStore((state) => state.favoriteProfessorIds);
  const knockKitDrafts = useResearchStore((state) => state.knockKitDrafts);
  const mentorLoopEntries = useResearchStore((state) => state.mentorLoopEntries);
  const cards = useQuestStore((state) => state.cards);
  const deleteCard = useQuestStore((state) => state.deleteCard);
  const { topic, match } = useQuestContext();
  const [timing, setTiming] = useState<Timing | "all">("all");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  if (!hasHydrated || !hasResearchHydrated) {
    return (
      <div className="research-loading">
        <LoaderCircle className="spin" />
        <p>저장된 퀘스트 카드를 불러오고 있어요.</p>
      </div>
    );
  }

  const visible = timing === "all"
    ? TOOLS
    : TOOLS.filter((tool) => tool.timings.includes(timing));
  const progress = getJourneyProgress({
    topicId: topic?.id ?? null,
    professorId: match?.professor.id ?? null,
    cards,
    emailDrafts: knockKitDrafts,
    mentorEntries: mentorLoopEntries,
  });
  const completionCounts = getQuestToolCompletionCounts(progress);
  const savedCounts = Object.fromEntries(
    visible.map((tool) => [tool.id, completionCounts[tool.id]]),
  );
  const recommendedToolId = getRecommendedQuestToolId({
    visibleToolIds: visible.map((tool) => tool.id),
    savedCounts,
  });
  const recommendedTool = visible.find((tool) => tool.id === recommendedToolId) ?? null;
  const phaseTimings: Timing[] = timing === "all" ? ["before", "during", "after"] : [timing];
  const phaseGroups = phaseTimings
    .map((groupTiming) => ({
      timing: groupTiming,
      tools: visible.filter((tool) => (
        tool.id !== recommendedToolId
        && (timing === "all" ? tool.timings[0] === groupTiming : true)
      )),
    }))
    .filter((group) => group.tools.length > 0);

  return (
    <AppShell title="전체 준비 도구" backHref="/quest" className={`quest-hub-screen ${questStyles.allToolsShell}`}>
      <div className={questStyles.allToolsPage}>
        <SceneBanner
          scene={brandScene.connect}
          alt="연구실 문 앞에서 교수님께 첫 대화를 준비하는 장면"
          eyebrow="교수님, 말 걸어도 돼요?"
          title="교수님 퀘스트 — 잇다"
          description="지금 필요한 도구부터 시작하고, 만남 전·중·후의 준비를 차례로 이어가세요."
          className="scene-banner--compact"
          priority
        />

        {recommendedTool ? (
          <section
            className={questStyles.recommendedTool}
            aria-labelledby="recommended-tool-title"
            data-quest-recommended="true"
          >
            <header className={questStyles.recommendedHeading}>
              <div>
                <small>지금 추천하는 도구</small>
                <h2 id="recommended-tool-title">{recommendedTool.name}부터 시작해 볼까요?</h2>
                <p>
                  {(savedCounts[recommendedTool.id] ?? 0) > 0
                    ? "저장한 내용을 다시 확인하거나 다음 단계로 이어갈 수 있어요."
                    : "현재 선택한 단계에서 아직 저장한 결과가 없는 첫 도구예요."}
                </p>
              </div>
              <span>{recommendedTool.code}</span>
            </header>
            <QuestToolCard
              tool={recommendedTool}
              saved={savedCounts[recommendedTool.id] ?? 0}
              favoriteProfessorIds={favoriteProfessorIds}
              featured
              onStart={(href) => router.push(href)}
            />
          </section>
        ) : null}

        <div
          className={`filter-scroll quest-hub-filter ${questStyles.phaseFilter}`}
          role="group"
          aria-label="만남 단계별 도구 필터"
        >
          {(["all", "before", "during", "after"] as const).map((item) => (
            <ChoiceChip key={item} selected={timing === item} onClick={() => setTiming(item)}>
              {item === "all" ? "전체" : TIMING_LABEL[item]}
            </ChoiceChip>
          ))}
        </div>

        <div className={questStyles.allToolsWorkspace}>
          <div className={questStyles.toolsColumn}>
            {phaseGroups.map((group) => (
              <section key={group.timing} className={questStyles.phaseGroup} aria-labelledby={`phase-${group.timing}`}>
                <header className={questStyles.phaseHeading}>
                  <div>
                    <small>{TIMING_LABEL[group.timing]}</small>
                    <h2 id={`phase-${group.timing}`}>{TIMING_LABEL[group.timing]} 준비 도구</h2>
                    <p>{TIMING_DESCRIPTION[group.timing]}</p>
                  </div>
                  <span>{group.tools.length}개</span>
                </header>
                <div className={`quest-tool-grid ${questStyles.phaseToolGrid}`}>
                  {group.tools.map((tool) => (
                    <QuestToolCard
                      key={tool.id}
                      tool={tool}
                      saved={savedCounts[tool.id] ?? 0}
                      favoriteProfessorIds={favoriteProfessorIds}
                      onStart={(href) => router.push(href)}
                    />
                  ))}
                </div>
              </section>
            ))}

            <button type="button" className={`official-courses-link quest-hub-mini ${questStyles.miniToolsLink}`} onClick={() => router.push("/quest/mini-tools")}>
              <Sparkles size={18} aria-hidden="true" />
              <div>
                <strong>교수님과 친해지기 미니도구</strong>
                <p>논문 한 줄 리액션 · 용어 번역 카드 · 키워드 빙고 · 첫 질문 셔플</p>
              </div>
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>

          <aside id="saved-cards" tabIndex={-1} className={questStyles.savedRail} aria-labelledby="saved-cards-title">
            <div className={questStyles.savedHeading}>
              <div>
                <small>내 준비 기록</small>
                <h2 id="saved-cards-title">저장한 카드</h2>
                <p>직접 저장한 결과물만 만남 준비 증거로 사용합니다.</p>
              </div>
              <strong>{cards.length}장</strong>
            </div>
            {cards.length > 0 ? (
              <div className="quest-saved-list">
                {cards.map((card) => (
                  <article key={card.id} className="quest-saved">
                    <div>
                      <Tag>{TOOL_NAME.get(card.tool) ?? card.tool}</Tag>
                      <h3>{card.title}</h3>
                      <p>{card.body}</p>
                      {card.evidence ? (
                        <small>
                          근거 {card.evidence.label}
                          {card.evidence.page !== null ? ` p.${card.evidence.page}` : ""}
                        </small>
                      ) : null}
                    </div>
                    {pendingDelete === card.id ? (
                      <div className="quest-saved__confirm">
                        <p>이 카드 1장을 삭제합니다. 되돌릴 수 없습니다.</p>
                        <div>
                          <button type="button" onClick={() => setPendingDelete(null)}>취소</button>
                          <button
                            type="button"
                            className="is-danger"
                            onClick={() => {
                              deleteCard(card.id);
                              setPendingDelete(null);
                            }}
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="quest-saved__delete"
                        aria-label={`${card.title} 삭제`}
                        onClick={() => setPendingDelete(card.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className="quest-saved-empty">
                <FileText size={24} aria-hidden="true" />
                <div>
                  <strong>저장한 준비물이 아직 없어요</strong>
                  <p>준비 도구에서 논문 카드나 첫 질문을 저장하면 이곳에서 다시 볼 수 있어요.</p>
                </div>
                <button
                  type="button"
                  onClick={() => document.querySelector('[data-quest-recommended="true"]')?.scrollIntoView({ behavior: "smooth", block: "start" })}
                >
                  준비 도구 살펴보기 <ArrowRight size={15} aria-hidden="true" />
                </button>
              </div>
            )}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
