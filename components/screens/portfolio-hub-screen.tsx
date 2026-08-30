"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Bot,
  CalendarCheck,
  CheckCircle2,
  FileText,
  FlaskConical,
  GraduationCap,
  Lightbulb,
  LoaderCircle,
  MessageCircleQuestion,
  NotebookPen,
  Route,
  Search,
  Sprout,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppShell } from "@/components/app/primitives";
import { ServiceBottomNav } from "@/components/app/side-nav";
import {
  HubList,
  HubRow,
  HubUtilityLink,
  HubUtilityLinks,
  serviceHubStyles as styles,
} from "@/components/app/service-hub";
import { growthProjectRecordHref } from "@/lib/navigation-flow";
import { cardsForTool, useQuestStore } from "@/store/quest-store";
import { useResearchStore } from "@/store/research-store";
import { useAiProfessorStore } from "@/store/ai-professor-store";
import growthStyles from "./portfolio-hub-screen.module.css";

type GrowthStep = {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  done: boolean;
};

const PROFESSOR_ROLE_LABEL = {
  TOPIC: "주제 연결",
  METHOD: "방법 연결",
  CONTEXT: "맥락 연결",
} as const;

const PROFESSOR_SOURCE_LABEL = {
  student: "첫 교수 매칭",
  project: "프로젝트 매칭",
  paper: "대화 준비",
} as const;

function sameValues(a: string[], b: string[]) {
  return a.length === b.length && a.every((item) => b.includes(item));
}

export function PortfolioHubScreen() {
  const hasResearchHydrated = useResearchStore((state) => state.hasHydrated);
  const hasQuestHydrated = useQuestStore((state) => state.hasHydrated);
  const hasAiHydrated = useAiProfessorStore((state) => state.hasHydrated);
  const aiMessages = useAiProfessorStore((state) => state.messages);
  const aiGrowthNotes = useAiProfessorStore((state) => state.growthNotes);
  const conditions = useResearchStore((state) => state.conditions);
  const result = useResearchStore((state) => state.result);
  const matches = useResearchStore((state) => state.professorMatches);
  const selectedProfessorId = useResearchStore((state) => state.selectedProfessorId);
  const discovery = useResearchStore((state) => state.professorDiscoverySummary);
  const selectedTopicId = useResearchStore((state) => state.selectedTopicId);
  const coDesignAnswers = useResearchStore((state) => state.coDesignAnswers);
  const growthDirectionBaseline = useResearchStore((state) => state.growthDirectionBaseline);
  const growthProjectHistory = useResearchStore((state) => state.growthProjectHistory);
  const growthProfessorHistory = useResearchStore((state) => state.growthProfessorHistory);
  const selectedPaper = useResearchStore((state) => state.selectedProfessorPaper);
  const knockKitDrafts = useResearchStore((state) => state.knockKitDrafts);
  const mentorLoopEntries = useResearchStore((state) => state.mentorLoopEntries);
  const cards = useQuestStore((state) => state.cards);

  if (!hasResearchHydrated || !hasQuestHydrated || !hasAiHydrated) {
    return (
      <div className="research-loading">
        <LoaderCircle className="spin" />
        <p>저장한 성장 기록을 불러오고 있어요.</p>
      </div>
    );
  }

  const hasTopic = Boolean(result || conditions.major || discovery?.major || growthProjectHistory.length);
  const hasProfessor = Boolean(selectedProfessorId || matches.length || growthProfessorHistory.length);
  const hasPaper = Boolean(selectedPaper || cardsForTool(cards, "paper-bite").length);
  const hasPreparation = Boolean(
    Object.keys(knockKitDrafts).length
    || cardsForTool(cards, "first-line").length
    || cardsForTool(cards, "silence-rescue").length,
  );
  const hasRevision = Object.keys(mentorLoopEntries).length > 0;
  const hasActions = Boolean(
    Object.keys(mentorLoopEntries).length
    || cardsForTool(cards, "next-seed").length,
  );

  const steps: GrowthStep[] = [
    { id: "topic", label: "주제 탐색", description: "관심 주제와 고민을 정리했어요.", href: "/research", icon: Search, done: hasTopic },
    { id: "professor", label: "교수 근거", description: "교수의 연구와 연결 근거를 확인했어요.", href: "/professors", icon: UserRound, done: hasProfessor },
    { id: "paper", label: "읽은 논문", description: "교수님의 연구를 한입 카드로 남겨보세요.", href: "/paper/reader?mode=bite&source=favorites", icon: BookOpenCheck, done: hasPaper },
    { id: "prepare", label: "면담 준비", description: "첫 질문과 연락 초안을 준비해 보세요.", href: "/quest", icon: MessageCircleQuestion, done: hasPreparation },
    { id: "revision", label: "수정 전후", description: "받은 조언으로 달라진 점을 남겨보세요.", href: "/mentor-loop", icon: Lightbulb, done: hasRevision },
    { id: "actions", label: "7일 행동", description: "이번 주에 실행할 행동을 기록해 보세요.", href: "/mentor-loop", icon: CalendarCheck, done: hasActions },
  ];

  const recordedCount = steps.filter((step) => step.done).length;
  const nextIndex = steps.findIndex((step) => !step.done);
  const safeNextIndex = nextIndex === -1 ? steps.length - 1 : nextIndex;
  const start = Math.max(0, Math.min(safeNextIndex - 2, steps.length - 3));
  const visibleSteps = steps.slice(start, start + 3);
  const next = nextIndex === -1
    ? {
        icon: NotebookPen,
        title: "성장 포트폴리오 정리하기",
        description: "저장한 단계만 골라 나의 성장 포트폴리오를 만들 수 있어요.",
        cta: "정리하기",
        href: "/portfolio/builder",
      }
    : {
        icon: steps[nextIndex].icon,
        title: `${steps[nextIndex].label} 기록하기`,
        description: steps[nextIndex].description,
        cta: steps[nextIndex].id === "topic" ? "아이디어 시작하기" : "가볍게 기록하기",
        href: steps[nextIndex].href,
      };
  const NextRecordIcon = next.icon;

  const currentInterests = conditions.interests.length
    ? conditions.interests
    : discovery?.interests ?? [];
  const latestProject = growthProjectHistory.at(-1) ?? null;
  const latestSelectedProfessor = [...growthProfessorHistory]
    .reverse()
    .find((record) => record.selectedAt) ?? null;
  const latestProfessor = growthProfessorHistory.at(-1) ?? null;
  const directionChanged = Boolean(
    growthDirectionBaseline
    && currentInterests.length
    && !sameValues(growthDirectionBaseline.interests, currentInterests),
  );
  const startingPoint = growthDirectionBaseline?.careerConcerns[0]
    ?? (growthDirectionBaseline?.interests.length
      ? growthDirectionBaseline.interests.join(" · ")
      : growthDirectionBaseline?.major || "첫 고민을 아직 남기지 않았어요");
  const currentDirection = latestProject?.title
    ?? (currentInterests.length ? currentInterests.join(" · ") : "관심 방향을 정리하는 중이에요");
  const currentAction = latestSelectedProfessor
    ? `${latestSelectedProfessor.name} 교수님과의 다음 행동 준비`
    : latestProfessor
      ? `${latestProfessor.name} 교수님 연결 근거 확인`
      : next.title;
  const changeSummary = directionChanged && growthDirectionBaseline
    ? `처음 관심 ${growthDirectionBaseline.interests.join(" · ")}에서 지금 ${currentInterests.join(" · ")}까지 확장했어요.`
    : latestProject && currentInterests.length
      ? `${currentInterests.join(" · ")} 관심을 ‘${latestProject.title}’ 프로젝트로 구체화했어요.`
      : "저장되는 기록이 쌓이면 처음 고민과 지금의 방향을 비교해 보여드려요.";
  const visibleProjects = [...growthProjectHistory].reverse().slice(0, 3);
  const visibleProfessors = [...growthProfessorHistory].reverse().slice(0, 6);
  const currentResultTopicIds = result?.kind === "ok"
    ? result.candidates.map((candidate) => candidate.topic.id)
    : result?.kind === "insufficient"
      ? [result.candidate.topic.id]
      : [];
  const hasValidCurrentResult = Boolean(
    selectedTopicId && currentResultTopicIds.includes(selectedTopicId),
  );
  const conversationCount = aiMessages.filter((message) => message.role === "user").length;
  const conversationBranchCount = aiMessages.filter((message) => message.branchParentMessageId).length;
  const latestConversationReflection = [...aiMessages]
    .reverse()
    .find((message) => message.reflection)?.reflection;
  const latestMapSummary = aiGrowthNotes.at(-1)?.title
    ?? latestConversationReflection?.title
    ?? [...aiMessages].reverse().find((message) => message.role === "user")?.content
    ?? "첫 고민을 말하면 생각 지도가 시작돼요";

  return (
    <AppShell
      showHeader={false}
      className={`${styles.shell} ${growthStyles.portfolioShell}`}
      bottomNav={<ServiceBottomNav />}
    >
      <div className={`${styles.hub} ${growthStyles.portfolioHub}`}>
        <section className={growthStyles.growthIntro} aria-labelledby="growth-hub-title">
          <header>
            <span className={growthStyles.growthIntroEyebrow}><Sprout size={17} /> 성장 기록 요약</span>
            <h1 id="growth-hub-title">나의 성장과정</h1>
            <p>처음 남긴 고민부터 프로젝트 설계, 교수 연결, 다음 행동까지 내가 이 서비스에서 쌓은 경험을 한곳에서 확인해요.</p>
          </header>
          <dl className={growthStyles.growthOverviewStats} aria-label="성장 기록 전체 요약">
            <div><dt>기록 단계</dt><dd>{recordedCount}<span>/ 6</span></dd></div>
            <div><dt>프로젝트</dt><dd>{growthProjectHistory.length}<span>개</span></dd></div>
            <div><dt>교수 연결</dt><dd>{growthProfessorHistory.length}<span>명</span></dd></div>
            <div><dt>다음 기록</dt><dd className={growthStyles.growthOverviewNext}>{next.title}</dd></div>
          </dl>
        </section>

        <section
          className={growthStyles.aiProfessorSection}
          aria-labelledby="my-ai-professor-title"
          data-service-help="growth-ai-professor"
        >
          <div className={growthStyles.aiProfessorCopy}>
            <span className={growthStyles.aiProfessorEyebrow}>
              <Bot size={16} aria-hidden="true" />
              성장과정의 중심
            </span>
            <h2 id="my-ai-professor-title">나의 AI 교수님</h2>
            <strong>대화가 쌓일수록, 내 고민의 변화가 보이기 시작해요.</strong>
            <p className={growthStyles.aiProfessorSummary}>
              {aiGrowthNotes.at(-1)?.body
                ?? "진로 고민과 프로젝트 생각을 이어서 이야기하면, 중요한 변화와 다음 행동을 대화 지도로 정리해 드려요."}
            </p>
            <Link
              href="/portfolio/ai-professor?view=map"
              className={growthStyles.aiProfessorMapPreview}
              aria-label="최근 생각 지도 미리보기, 전체 대화 지도 보기"
            >
              <span className={growthStyles.aiProfessorMapLabel}>
                <Bot size={15} aria-hidden="true" /> 최근 생각 지도
              </span>
              <span className={growthStyles.aiProfessorMapFlow} aria-hidden="true">
                <i />
                <b>대화 시작</b>
                <em />
                <i />
                <strong>{latestMapSummary}</strong>
              </span>
              <span className={growthStyles.aiProfessorMapLink}>
                전체 지도 보기 <ArrowRight size={15} aria-hidden="true" />
              </span>
            </Link>
            <dl className={growthStyles.aiProfessorStats} aria-label="나의 AI 교수님 기록 요약">
              <div>
                <dt>나눈 대화</dt>
                <dd>{conversationCount}<span>회</span></dd>
              </div>
              <div>
                <dt>성장 메모</dt>
                <dd>{aiGrowthNotes.length}<span>개</span></dd>
              </div>
              <div>
                <dt>대화 갈래</dt>
                <dd>{conversationBranchCount}<span>개</span></dd>
              </div>
            </dl>
            <div className={growthStyles.aiProfessorActions}>
              <Link href="/portfolio/ai-professor" className={growthStyles.aiProfessorAction}>
                {aiMessages.length ? "AI 교수님과 대화 이어가기" : "AI 교수님과 첫 대화 시작하기"}
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <small>실제 교수님의 지도를 대신하지 않고, 내 생각을 발견하고 정리하는 데 집중해요.</small>
            </div>
          </div>
          <div className={growthStyles.aiProfessorVisual} aria-hidden="true">
            <span className={growthStyles.aiProfessorVisualLabel}>생각을 대화 지도로</span>
            <Image
              src="/mvp-assets/robot-pose-2.png"
              alt=""
              width={240}
              height={240}
              className={growthStyles.aiProfessorImage}
              priority
            />
            <i className={growthStyles.aiProfessorNodeOne} />
            <i className={growthStyles.aiProfessorNodeTwo} />
            <i className={growthStyles.aiProfessorNodeThree} />
          </div>
        </section>

        <section
          className={growthStyles.nextRecordCard}
          aria-labelledby="next-growth-record-title"
          data-service-help="growth-next-record"
        >
          <span className={growthStyles.nextRecordIcon}><NextRecordIcon size={20} aria-hidden="true" /></span>
          <div className={growthStyles.nextRecordCopy}>
            <small>다음 기록 제안</small>
            <h2 id="next-growth-record-title">{next.title}</h2>
            <p>{next.description}</p>
          </div>
          <Link href={next.href} className={growthStyles.nextRecordAction}>
            {next.cta}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </section>

        <section
          className={growthStyles.storySection}
          aria-labelledby="growth-story-title"
          data-service-help="growth-story"
        >
          <header className={growthStyles.storyHeading}>
            <div>
              <h2 id="growth-story-title">내 방향이 구체화된 흐름</h2>
              <p>{changeSummary}</p>
            </div>
            <span>{coDesignAnswers.length ? `AI와 확인한 답변 ${coDesignAnswers.length}개` : "기록을 쌓는 중"}</span>
          </header>
          <ol className={growthStyles.storyPath}>
            <li>
              <span className={growthStyles.storyIcon}><Route size={20} aria-hidden="true" /></span>
              <div><small>처음 남긴 고민</small><strong>{startingPoint}</strong></div>
            </li>
            <ArrowRight className={growthStyles.storyArrow} size={20} aria-hidden="true" />
            <li>
              <span className={growthStyles.storyIcon}><FlaskConical size={20} aria-hidden="true" /></span>
              <div><small>프로젝트로 구체화</small><strong>{currentDirection}</strong></div>
            </li>
            <ArrowRight className={growthStyles.storyArrow} size={20} aria-hidden="true" />
            <li>
              <span className={growthStyles.storyIcon}><Sprout size={20} aria-hidden="true" /></span>
              <div><small>지금 이어가는 행동</small><strong>{currentAction}</strong></div>
            </li>
          </ol>
          <div className={growthStyles.mobileStorySummary}>
            <div>
              <small>처음 고민</small>
              <strong>{startingPoint}</strong>
            </div>
            <ArrowRight size={18} aria-hidden="true" />
            <div>
              <small>지금의 방향</small>
              <strong>{currentDirection}</strong>
            </div>
          </div>
          <Link href="/portfolio/builder" className={growthStyles.mobileStoryAction}>
            전체 성장 흐름 보기 <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <p className={growthStyles.storyNote}>선택하고 저장한 기록을 시간 순서대로 모아 성장 흐름을 보여줘요.</p>
        </section>

        <div className={growthStyles.mobileCompactList}>
          <HubList
            title="이 서비스를 통해 쌓은 경험"
            trailing={(
              <>
                <span className={growthStyles.desktopListCount}>{recordedCount} / 6 단계 기록</span>
                <Link href="/portfolio/builder" className={growthStyles.mobileListAction}>
                  전체 보기 <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </>
            )}
          >
            {visibleSteps.map((step) => {
              const Icon = step.done ? CheckCircle2 : step.icon;
              const isCurrent = !step.done && steps.findIndex((item) => !item.done) === steps.indexOf(step);
              return (
                <HubRow
                  key={step.id}
                  icon={Icon}
                  title={step.done ? step.label : isCurrent ? "아직 비어 있는 기록" : step.label}
                  description={step.description}
                  status={step.done ? "기록 있음" : isCurrent ? "다음 단계" : "시작 전"}
                  href={step.done ? "/portfolio/builder" : step.href}
                  tone={step.done ? "mint" : isCurrent ? "violet" : "neutral"}
                />
              );
            })}
          </HubList>
        </div>

        {visibleProjects.length > 0 ? (
          <div className={growthStyles.mobileCompactList}>
            <HubList
              title="프로젝트 설계 기록"
              trailing={(
                <>
                  <span className={growthStyles.desktopListCount}>{growthProjectHistory.length}개 프로젝트</span>
                  <Link href={hasValidCurrentResult ? "/result" : "/portfolio/builder"} className={growthStyles.mobileListAction}>
                    {hasValidCurrentResult ? "현재 결과" : "전체 기록"} <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </>
              )}
            >
              {visibleProjects.map((project) => (
                <HubRow
                  key={project.topicId}
                  icon={FlaskConical}
                  title={project.title}
                  description={project.question}
                  status={project.topicId === selectedTopicId ? "현재 프로젝트" : "이전 선택"}
                  href={growthProjectRecordHref({
                    recordTopicId: project.topicId,
                    selectedTopicId,
                    currentResultTopicIds,
                  })}
                  tone={project.topicId === selectedTopicId ? "violet" : "neutral"}
                />
              ))}
            </HubList>
          </div>
        ) : null}

        {visibleProfessors.length > 0 ? (
          <div className={growthStyles.mobileCompactList}>
            <HubList
              title="지금까지 연결한 교수님"
              trailing={(
                <>
                  <span className={growthStyles.desktopListCount}>{growthProfessorHistory.length}명 기록</span>
                  <Link href="/portfolio/builder" className={growthStyles.mobileListAction}>
                    연결 기록 <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </>
              )}
            >
              {visibleProfessors.map((record) => (
                <HubRow
                  key={`${record.source}-${record.professorId}`}
                  icon={GraduationCap}
                  title={`${record.name} ${record.title}`}
                  description={`${record.department || record.college} · ${record.reason}`}
                  status={record.selectedAt
                    ? "선택한 교수"
                    : `${PROFESSOR_SOURCE_LABEL[record.source]} · ${PROFESSOR_ROLE_LABEL[record.role]}`}
                  href={record.source === "project"
                    ? `/professors/${record.professorId}?from=portfolio&journey=project`
                    : `/professors/${record.professorId}?from=portfolio`}
                  tone={record.selectedAt ? "mint" : record.source === "project" ? "violet" : "neutral"}
                />
              ))}
            </HubList>
          </div>
        ) : null}

        <HubUtilityLinks>
          <HubUtilityLink icon={FileText} href="/portfolio/builder">포트폴리오 만들기</HubUtilityLink>
        </HubUtilityLinks>
      </div>
    </AppShell>
  );
}
