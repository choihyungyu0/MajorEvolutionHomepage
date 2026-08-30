"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronRight, CompassIcon, FlaskConical, GraduationCap, Home, MessagesSquare, TrendingUp, UserRound } from "lucide-react";
import { Suspense, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { guideCharacter } from "@/lib/brand-assets";
import {
  navigationJourney,
  resolveServiceSection,
  shouldOpenServiceNavGuide,
  SERVICE_DESKTOP_NAV_GUIDE_STORAGE_KEY,
  SERVICE_GUIDE_STEPS,
  SERVICE_HOME_ONBOARDING_EVENT,
  SERVICE_MOBILE_NAV_GUIDE_STORAGE_KEY,
  SERVICE_NAV_GUIDE_EVENT,
  SERVICE_NAV_GUIDE_QUERY_PARAM,
  SERVICE_NAV_GUIDE_QUERY_VALUE,
  SERVICE_NAV_GUIDE_STORAGE_KEY,
  projectExecutionTabHref,
} from "@/lib/service-navigation";
import { useProfileStore } from "@/store/profile-store";
import { useResearchStore } from "@/store/research-store";

/**
 * 넓은 화면 좌측 내비.
 *
 * 와이어프레임의 데스크톱 사이드바를 그대로 옮긴 것으로, 모바일에서는 나타나지 않습니다.
 * 홈 다음에 두 사용자 여정을 순서대로 둡니다.
 * 1) 교수 매칭 → 교수 만남 준비
 * 2) AI 프로젝트 설계 → 맞춤 교수 추천
 * 마지막에는 두 여정에서 쌓인 기록을 돌아보는 성장 탭을 둡니다.
 */

export const NAV_ITEMS = [
  { href: "/home", section: "/home", label: "홈", shortLabel: "홈", icon: Home },
  { href: "/professors", section: "/professors", label: "교수 매칭", shortLabel: "매칭", icon: CompassIcon },
  { href: "/quest", section: "/quest", label: "교수 만남 준비", shortLabel: "만남", icon: MessagesSquare },
  { href: "/research", section: "/research", label: "AI 프로젝트 설계", shortLabel: "프로젝트", icon: FlaskConical },
  { href: "/project-professors", section: "/project-professors", label: "프로젝트 실행", shortLabel: "실행", icon: GraduationCap },
  { href: "/portfolio", section: "/portfolio", label: "나의 성장과정", shortLabel: "성장", icon: TrendingUp },
] as const;

function useProjectExecutionTabHref(): "/project-professors" | "/project-execution" {
  const hasHydrated = useResearchStore((state) => state.hasHydrated);
  const selectedTopicId = useResearchStore((state) => state.selectedTopicId);
  const projectProfessorMatchTopicId = useResearchStore((state) => state.projectProfessorMatchTopicId);
  const selectedProjectProfessorId = useResearchStore((state) => state.selectedProjectProfessorId);
  const projectProfessorMatches = useResearchStore((state) => state.projectProfessorMatches);
  return projectExecutionTabHref({
    hasHydrated,
    selectedTopicId,
    projectProfessorMatchTopicId,
    selectedProjectProfessorId,
    availableProfessorIds: projectProfessorMatches.map((match) => match.professor.id),
  });
}

function navigationHref(
  item: (typeof NAV_ITEMS)[number],
  projectExecutionHref: "/project-professors" | "/project-execution",
) {
  if (item.section === "/project-professors") return projectExecutionHref;
  return item.href;
}

let openNavigationGuideCount = 0;

function markNavigationGuideOpen() {
  openNavigationGuideCount += 1;
  document.documentElement.setAttribute("data-service-nav-guide-open", "true");
  let released = false;

  return () => {
    if (released) return;
    released = true;
    openNavigationGuideCount = Math.max(0, openNavigationGuideCount - 1);
    if (openNavigationGuideCount === 0) {
      document.documentElement.removeAttribute("data-service-nav-guide-open");
    }
  };
}

function hasRequestedNavigationGuide(pathname: string) {
  if (pathname !== "/home") return false;
  return new URLSearchParams(window.location.search).get(SERVICE_NAV_GUIDE_QUERY_PARAM)
    === SERVICE_NAV_GUIDE_QUERY_VALUE;
}

function consumeNavigationGuideRequest() {
  const url = new URL(window.location.href);
  url.searchParams.delete(SERVICE_NAV_GUIDE_QUERY_PARAM);
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, "", nextUrl);
}


function ServiceBottomNavContent() {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const active = resolveServiceSection(pathname, searchParams);
  const professorJourneyActive = active === "/professors" || active === "/quest";
  const projectJourneyActive = active === "/research" || active === "/project-professors";
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const forcedGuideRef = useRef(false);
  const guide = SERVICE_GUIDE_STEPS[guideStep];
  const projectExecutionHref = useProjectExecutionTabHref();

  const finishGuide = useCallback(() => {
    forcedGuideRef.current = false;
    try {
      window.localStorage.setItem(SERVICE_MOBILE_NAV_GUIDE_STORAGE_KEY, "complete");
      window.localStorage.setItem(SERVICE_NAV_GUIDE_STORAGE_KEY, "complete");
    } catch {
      // 저장이 제한된 환경에서도 현재 세션의 안내는 정상적으로 닫습니다.
    }
    setGuideOpen(false);
  }, []);

  const finishMobileGuideAndContinue = useCallback(() => {
    finishGuide();
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent(SERVICE_HOME_ONBOARDING_EVENT));
    }, 120);
  }, [finishGuide]);

  useEffect(() => {
    if (pathname !== "/home") {
      forcedGuideRef.current = false;
      setGuideOpen(false);
      return;
    }

    const desktopViewport = window.matchMedia("(min-width: 1280px)");
    const syncGuideVisibility = () => {
      let hasCompletedGuide = false;
      try {
        hasCompletedGuide =
          window.localStorage.getItem(SERVICE_MOBILE_NAV_GUIDE_STORAGE_KEY) === "complete" ||
          window.localStorage.getItem(SERVICE_NAV_GUIDE_STORAGE_KEY) === "complete";
      } catch {
        // 저장소를 읽을 수 없으면 이번 방문에는 안내를 제공합니다.
      }

      const isPlainHome = window.location.search.length === 0;
      const requestedForMobile = !desktopViewport.matches && hasRequestedNavigationGuide(pathname);
      if (requestedForMobile) forcedGuideRef.current = true;
      if (shouldOpenServiceNavGuide({
        matchingViewport: !desktopViewport.matches,
        requested: forcedGuideRef.current,
        hasCompletedGuide,
        isPlainHome,
      })) {
        setGuideStep(0);
        setGuideOpen(true);
        if (requestedForMobile) consumeNavigationGuideRequest();
      } else {
        setGuideOpen(false);
      }
    };

    syncGuideVisibility();
    desktopViewport.addEventListener("change", syncGuideVisibility);
    return () => desktopViewport.removeEventListener("change", syncGuideVisibility);
  }, [pathname]);

  useEffect(() => {
    const openGuide = () => {
      if (window.matchMedia("(min-width: 1280px)").matches) return;
      setGuideStep(0);
      setGuideOpen(true);
    };
    window.addEventListener(SERVICE_NAV_GUIDE_EVENT, openGuide);
    return () => window.removeEventListener(SERVICE_NAV_GUIDE_EVENT, openGuide);
  }, []);

  useEffect(() => {
    if (!guideOpen) return;
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") finishGuide();
    };
    window.addEventListener("keydown", closeWithEscape);
    return () => window.removeEventListener("keydown", closeWithEscape);
  }, [finishGuide, guideOpen]);

  useEffect(() => {
    if (!guideOpen) return;
    return markNavigationGuideOpen();
  }, [guideOpen]);

  const goToNextGuideStep = () => {
    if (guideStep === SERVICE_GUIDE_STEPS.length - 1) {
      finishMobileGuideAndContinue();
      return;
    }
    setGuideStep((current) => current + 1);
  };

  return (
    <nav
      className={[
        "service-bottom-nav",
        professorJourneyActive ? "has-active-professor-journey" : "",
        projectJourneyActive ? "has-active-project-journey" : "",
        guideOpen ? "is-guiding" : "",
      ].filter(Boolean).join(" ")}
      aria-label="모바일 주요 메뉴"
    >
      {NAV_ITEMS.map((item, index) => {
        const Icon = item.icon;
        const href = navigationHref(item, projectExecutionHref);
        const isActive = active === item.section;
        const journey = navigationJourney(item.section);
        const isGuideTarget = guideOpen && guideStep === index;
        return (
          <Link
            key={item.section}
            href={href}
            className={[
              isActive ? "is-active" : "",
              journey ? "is-journey" : "",
              journey ? `is-${journey.key}-journey` : "",
              journey?.step === 1 ? "is-journey-start" : "",
              journey?.step === 2 ? "is-journey-end" : "",
              journey?.key === "project" && journey.step === 1 ? "is-project-journey-start" : "",
              journey?.key === "professor" && journey.step === 1 ? "is-professor-journey-start" : "",
              isGuideTarget ? "is-guide-target" : "",
            ].filter(Boolean).join(" ") || undefined}
            aria-current={isActive ? "page" : undefined}
            aria-label={journey ? `${item.label}, ${journey.label} ${journey.step}단계` : item.label}
            aria-describedby={isGuideTarget ? "bottom-nav-guide-description" : undefined}
            onClick={() => {
              if (guideOpen) finishGuide();
            }}
          >
            {journey?.step === 1 ? (
              <span className="service-bottom-nav__journey-label" aria-hidden="true">{journey.label}</span>
            ) : null}
            <Icon size={21} aria-hidden="true" />
            <span>{item.shortLabel}</span>
          </Link>
        );
      })}
      {guideOpen ? (
        <aside
          key={guide.label}
          className="service-bottom-nav__guide"
          style={{ "--nav-guide-anchor": guide.anchor } as CSSProperties}
          role="dialog"
          aria-modal="false"
          aria-label="하단 메뉴 사용 가이드"
          aria-live="polite"
        >
          <button
            type="button"
            className="service-bottom-nav__guide-skip"
            onClick={finishGuide}
          >
            건너뛰기
          </button>
          <div className="service-bottom-nav__guide-message">
            <span className="service-bottom-nav__guide-mascot" aria-hidden="true">
              <Image
                src={guideCharacter.connectOpener}
                alt=""
                width={96}
                height={96}
                priority
              />
            </span>
            <div className="service-bottom-nav__guide-copy">
              <span>{guideStep + 1} / {SERVICE_GUIDE_STEPS.length} · {guide.label}</span>
              <strong>{guide.title}</strong>
              <p id="bottom-nav-guide-description">{guide.description}</p>
            </div>
          </div>
          <div className="service-bottom-nav__guide-footer">
            <div
              className="service-bottom-nav__guide-progress"
              aria-label={`${SERVICE_GUIDE_STEPS.length}단계 중 ${guideStep + 1}단계`}
            >
              {SERVICE_GUIDE_STEPS.map((step, index) => (
                <span
                  key={step.label}
                  className={index === guideStep ? "is-current" : index < guideStep ? "is-complete" : undefined}
                  aria-hidden="true"
                />
              ))}
            </div>
            <div className="service-bottom-nav__guide-actions">
              {guideStep > 0 ? (
                <button type="button" onClick={() => setGuideStep((current) => current - 1)}>
                  이전
                </button>
              ) : null}
              <button type="button" className="is-primary" onClick={goToNextGuideStep} autoFocus>
                {guideStep === SERVICE_GUIDE_STEPS.length - 1 ? "시작하기" : "다음"}
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        </aside>
      ) : null}
    </nav>
  );
}

export function ServiceBottomNav() {
  return (
    <Suspense fallback={null}>
      <ServiceBottomNavContent />
    </Suspense>
  );
}

function SideNavContent() {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const active = resolveServiceSection(pathname, searchParams);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const forcedGuideRef = useRef(false);
  const guide = SERVICE_GUIDE_STEPS[guideStep];
  const projectExecutionHref = useProjectExecutionTabHref();
  const hasProfileHydrated = useProfileStore((state) => state.hasHydrated);
  const hasEnteredService = useProfileStore((state) => state.hasEnteredService);
  const markServiceEntered = useProfileStore((state) => state.markServiceEntered);
  const profile = useProfileStore((state) => state.profile);

  useEffect(() => {
    if (hasProfileHydrated && !hasEnteredService) markServiceEntered();
  }, [hasEnteredService, hasProfileHydrated, markServiceEntered]);

  const finishGuide = useCallback(() => {
    forcedGuideRef.current = false;
    try {
      window.localStorage.setItem(SERVICE_DESKTOP_NAV_GUIDE_STORAGE_KEY, "complete");
    } catch {
      // 저장이 제한된 환경에서도 현재 안내는 닫을 수 있습니다.
    }
    setGuideOpen(false);
  }, []);

  const finishGuideAndContinue = useCallback(() => {
    finishGuide();
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent(SERVICE_HOME_ONBOARDING_EVENT));
    }, 120);
  }, [finishGuide]);

  useEffect(() => {
    if (pathname !== "/home") {
      forcedGuideRef.current = false;
      setGuideOpen(false);
      return;
    }

    const desktopViewport = window.matchMedia("(min-width: 1280px)");
    const syncGuideVisibility = () => {
      let hasCompletedGuide = false;
      try {
        hasCompletedGuide =
          window.localStorage.getItem(SERVICE_DESKTOP_NAV_GUIDE_STORAGE_KEY) === "complete";
      } catch {
        // 저장소를 읽을 수 없으면 이번 방문에는 안내를 제공합니다.
      }

      const requestedForDesktop = desktopViewport.matches && hasRequestedNavigationGuide(pathname);
      if (requestedForDesktop) forcedGuideRef.current = true;
      const isPlainHome = window.location.search.length === 0;
      if (shouldOpenServiceNavGuide({
        matchingViewport: desktopViewport.matches,
        requested: forcedGuideRef.current,
        hasCompletedGuide,
        isPlainHome,
      })) {
        setGuideStep(0);
        setGuideOpen(true);
        if (requestedForDesktop) consumeNavigationGuideRequest();
      } else {
        setGuideOpen(false);
      }
    };

    syncGuideVisibility();
    desktopViewport.addEventListener("change", syncGuideVisibility);
    return () => desktopViewport.removeEventListener("change", syncGuideVisibility);
  }, [pathname]);

  useEffect(() => {
    const openGuide = () => {
      if (!window.matchMedia("(min-width: 1280px)").matches) return;
      setGuideStep(0);
      setGuideOpen(true);
    };
    window.addEventListener(SERVICE_NAV_GUIDE_EVENT, openGuide);
    return () => window.removeEventListener(SERVICE_NAV_GUIDE_EVENT, openGuide);
  }, []);

  useEffect(() => {
    if (!guideOpen) return;
    const releaseGuideOpen = markNavigationGuideOpen();
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") finishGuide();
    };
    window.addEventListener("keydown", closeWithEscape);
    return () => {
      releaseGuideOpen();
      window.removeEventListener("keydown", closeWithEscape);
    };
  }, [finishGuide, guideOpen]);

  useEffect(() => {
    if (!guideOpen) return;
    const frame = window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(".side-nav > ul > li.is-guide-target")
        ?.scrollIntoView({ block: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [guideOpen, guideStep]);

  const goToNextGuideStep = () => {
    if (guideStep === SERVICE_GUIDE_STEPS.length - 1) {
      finishGuideAndContinue();
      return;
    }
    setGuideStep((current) => current + 1);
  };

  return (
    <nav className={`side-nav${guideOpen ? " is-guiding" : ""}`} aria-label="주요 메뉴">
      <BrandLogo
        href="/home"
        tagline="찾다 · 준비하다 · 이어가다"
        compact
        className="side-nav__brand"
      />
      <ul>
        {NAV_ITEMS.map((item, index) => {
          const Icon = item.icon;
          const href = navigationHref(item, projectExecutionHref);
          const isActive = active === item.section;
          const journey = navigationJourney(item.section);
          const isGuideTarget = guideOpen && guideStep === index;
          return (
            <li
              key={item.section}
              className={[
                journey
                  ? `side-nav__journey-item side-nav__journey-item--${journey.key} side-nav__journey-item--step-${journey.step}`
                  : "",
                isGuideTarget ? "is-guide-target" : "",
              ].filter(Boolean).join(" ") || undefined}
            >
              {journey?.step === 1 ? (
                <span className="side-nav__journey-label" aria-hidden="true">{journey.label}</span>
              ) : null}
              <Link
                href={href}
                className={isActive ? "is-active" : undefined}
                aria-current={isActive ? "page" : undefined}
                aria-label={journey ? `${item.label}, ${journey.label} ${journey.step}단계` : undefined}
                aria-describedby={isGuideTarget ? "side-nav-guide-description" : undefined}
                aria-disabled={guideOpen || undefined}
                tabIndex={guideOpen ? -1 : undefined}
                onClick={(event) => {
                  if (guideOpen) event.preventDefault();
                }}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
                {journey ? (
                  <span className="side-nav__journey-step" aria-hidden="true">{journey.step}/2</span>
                ) : null}
              </Link>
              {isGuideTarget ? (
                <aside
                  className="side-nav__guide"
                  role="dialog"
                  aria-modal="false"
                  aria-label="주요 메뉴 사용 가이드"
                  aria-live="polite"
                >
                  <button type="button" className="side-nav__guide-skip" onClick={finishGuide}>
                    건너뛰기
                  </button>
                  <div className="side-nav__guide-message">
                    <Image
                      src={guideCharacter.connectOpener}
                      alt=""
                      width={72}
                      height={72}
                      aria-hidden="true"
                    />
                    <div>
                      <span>{guideStep + 1} / {SERVICE_GUIDE_STEPS.length} · {guide.label}</span>
                      <strong>{guide.title}</strong>
                      <p id="side-nav-guide-description">{guide.description}</p>
                    </div>
                  </div>
                  <div className="side-nav__guide-footer">
                    <div
                      className="side-nav__guide-progress"
                      aria-label={`${SERVICE_GUIDE_STEPS.length}단계 중 ${guideStep + 1}단계`}
                    >
                      {SERVICE_GUIDE_STEPS.map((step, index) => (
                        <span
                          key={step.label}
                          className={index === guideStep ? "is-current" : index < guideStep ? "is-complete" : undefined}
                          aria-hidden="true"
                        />
                      ))}
                    </div>
                    <div className="side-nav__guide-actions">
                      {guideStep > 0 ? (
                        <button type="button" onClick={() => setGuideStep((current) => current - 1)}>
                          이전
                        </button>
                      ) : null}
                      <button type="button" className="is-primary" onClick={goToNextGuideStep} autoFocus>
                        {guideStep === SERVICE_GUIDE_STEPS.length - 1 ? "시작하기" : "다음"}
                        <ChevronRight size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </aside>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="side-nav__footer">
        <Link
          href="/profile"
          className={`side-nav__profile${active === "/profile" ? " is-active" : ""}`}
          aria-current={active === "/profile" ? "page" : undefined}
          data-service-onboarding="desktop-profile"
        >
          <span className="side-nav__avatar" aria-hidden="true">
            {profile.name ? profile.name.slice(0, 1) : <UserRound size={18} />}
          </span>
          <span className="side-nav__profile-copy">
            <strong>{profile.name ? `${profile.name}님` : "내 정보 설정"}</strong>
            <small>{profile.major || "이 기기에 내 정보 저장"}</small>
          </span>
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </nav>
  );
}

export function SideNav() {
  return (
    <Suspense fallback={null}>
      <SideNavContent />
    </Suspense>
  );
}
