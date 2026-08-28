"use client";

import {
  Bookmark,
  Compass,
  LoaderCircle,
  MessageCircleQuestion,
  Search,
  Settings2,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { AppShell } from "@/components/app/primitives";
import { ServiceBottomNav } from "@/components/app/side-nav";
import {
  HubList,
  HubPrimaryTask,
  HubRow,
  HubUtilityLink,
  HubUtilityLinks,
  ServiceHubIntro,
  serviceHubStyles as styles,
} from "@/components/app/service-hub";
import { useResearchStore } from "@/store/research-store";
import routeStyles from "./professor-hub-screen.module.css";

export function ProfessorHubScreen() {
  const hasHydrated = useResearchStore((state) => state.hasHydrated);
  const matches = useResearchStore((state) => state.professorMatches);
  const selectedProfessorId = useResearchStore((state) => state.selectedProfessorId);
  const favoriteProfessorIds = useResearchStore((state) => state.favoriteProfessorIds);

  if (!hasHydrated) {
    return (
      <div className="research-loading">
        <LoaderCircle className="spin" />
        <p>교수 연결을 불러오고 있어요.</p>
      </div>
    );
  }

  const selected = matches.find((match) => match.professor.id === selectedProfessorId) ?? null;
  const saved = matches.filter((match) => favoriteProfessorIds.includes(match.professor.id));

  const primary = selected
    ? {
        title: "첫 대화를 준비할 차례예요",
        description: `${selected.professor.name} 교수님과 나눌 첫 질문부터 준비해 보세요.`,
        cta: "대화 준비 이어가기",
        href: "/quest",
        icon: MessageCircleQuestion,
        secondary: { label: "다른 교수 연결 보기", href: "/professors/pitch" },
      }
    : matches.length > 0
      ? {
          title: "대화할 교수를 골라보세요",
          description: "순위가 아니라, 내 고민과 연결된 이유를 보고 첫 교수를 선택해요.",
          cta: "교수 피칭 이어보기",
          href: "/professors/pitch",
          icon: UserRound,
          secondary: { label: "새로 찾기", href: "/tutorial" },
        }
      : {
          title: "전공과 관심 분야부터 설정해 볼까요?",
          description: "두 단계 기본 설정을 마치면 학교 공식 정보에서 연결 이유가 다른 교수 세 분을 보여드려요.",
          cta: "기본 설정하기",
          href: "/tutorial",
          icon: Compass,
          secondary: { label: "질문을 한 화면에서 입력하기", href: "/professors/discover" },
        };

  return (
    <AppShell
      showHeader={false}
      className={styles.shell}
      bottomNav={<ServiceBottomNav />}
    >
      <div className={styles.hub}>
        <ServiceHubIntro
          title="누구와 이야기할지 찾아볼까요?"
          description="지금 고민을 정리하면 학교 공식 정보에서 대화할 교수를 찾아드려요."
          variant="compact"
        />

        <div className={routeStyles.workspace}>
          <div className={routeStyles.primaryArea} data-service-help="professor-hub-primary">
            <HubPrimaryTask {...primary} />
          </div>

          <aside
            className={routeStyles.contextRail}
            aria-label="내 교수 연결 요약"
            data-service-help="professor-hub-connection"
          >
            <HubList title="내 교수 연결">
              <HubRow
                icon={UserRound}
                title={selected ? `${selected.professor.name} ${selected.professor.title}` : "아직 선택한 교수가 없어요"}
                description={selected ? `${selected.professor.department} · 첫 대화 준비 중` : "공식 근거를 비교한 뒤 첫 교수를 선택해요."}
                status={selected ? "연결됨" : "시작 전"}
                href={selected ? `/professors/${selected.professor.id}` : undefined}
                tone={selected ? "mint" : "neutral"}
              />
              <HubRow
                icon={Bookmark}
                title="저장한 교수"
                description={saved.length ? saved.map((item) => item.professor.name).join(" · ") : "관심 있는 교수를 저장하면 여기에 모여요."}
                status={saved.length ? `${saved.length}명` : "비어 있음"}
                href={saved.length ? "/professors/pitch" : undefined}
                tone={saved.length ? "violet" : "neutral"}
              />
            </HubList>

            <p className={`${styles.trustNote} ${routeStyles.officialStatus}`}>
              <ShieldCheck size={18} aria-hidden="true" />
              <span>
                <strong>공식정보 상태</strong>
                <small>
                  {matches.length
                    ? `학교 공식 정보로 확인한 후보 ${matches.length}명을 비교하고 있어요.`
                    : "교수 탐색을 시작하면 학교 공식 정보 안에서 연결 근거를 확인해요."}
                </small>
              </span>
            </p>
          </aside>

          <div className={routeStyles.moreArea} data-service-help="professor-hub-tools">
            <HubUtilityLinks>
              <HubUtilityLink icon={Search} href="/professors/discover">조건을 직접 입력해 교수 찾기</HubUtilityLink>
              <HubUtilityLink icon={Settings2} href="/portfolio/manage">저장한 연결 관리</HubUtilityLink>
            </HubUtilityLinks>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
