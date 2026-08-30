"use client";

import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ChevronLeft,
  CircleHelp,
  ListChecks,
  Map,
  Sparkles,
  X,
} from "lucide-react";
import {
  Suspense,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { guideCharacter } from "@/lib/brand-assets";
import {
  getServiceHelpAutoOpenStorageKey,
  getServiceHelpCopy,
  navigationJourney,
  SERVICE_HOME_ONBOARDING_EVENT,
  SERVICE_NAV_GUIDE_EVENT,
  SERVICE_NAV_GUIDE_QUERY_PARAM,
  SERVICE_NAV_GUIDE_QUERY_VALUE,
  type ServiceHelpArea,
} from "@/lib/service-navigation";

type ServiceHelpGuideProps = {
  placement?: "header" | "floating";
};

type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const JOURNEY_STEPS = {
  professor: ["교수 매칭", "교수 만남 준비"],
  project: ["AI 프로젝트 설계", "맞춤 교수 추천"],
} as const;

function mascotForSection(section: string) {
  if (section === "/professors" || section === "/project-professors") return guideCharacter.findRadar;
  if (section === "/quest") return guideCharacter.questFlag;
  if (section === "/research") return guideCharacter.makeLab;
  if (section === "/portfolio") return guideCharacter.thinking;
  return guideCharacter.processing;
}

function ServiceHelpGuideContent({ placement = "floating" }: ServiceHelpGuideProps) {
  const pathname = usePathname() ?? "/home";
  const searchParams = useSearchParams();
  const help = getServiceHelpCopy(pathname, searchParams);
  const journey = navigationJourney(help.section);
  const autoOpenStorageKey = getServiceHelpAutoOpenStorageKey(pathname, searchParams);
  const navigationGuideRequested = searchParams.get(SERVICE_NAV_GUIDE_QUERY_PARAM)
    === SERVICE_NAV_GUIDE_QUERY_VALUE;
  const [open, setOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourAreas, setTourAreas] = useState<ServiceHelpArea[]>([]);
  const [tourIndex, setTourIndex] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const tourCloseButtonRef = useRef<HTMLButtonElement>(null);
  const tourDialogRef = useRef<HTMLElement>(null);
  const tourTitleRef = useRef<HTMLHeadingElement>(null);
  const autoOpenAttemptRef = useRef<string | null>(null);
  const manualInteractionKeyRef = useRef<string | null>(null);

  const closeHelp = () => {
    setOpen(false);
    setTourOpen(false);
    setSpotlightRect(null);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!open) return;
    document.documentElement.setAttribute("data-service-help-open", "true");
    const appViewport = document.querySelector<HTMLElement>(".app-viewport");
    const previousViewportInert = appViewport?.inert ?? false;
    if (appViewport) appViewport.inert = true;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyPaddingRight = document.body.style.paddingRight;
    const scrollbarGap = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    if (scrollbarGap > 0) {
      const currentPadding = Number.parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;
      document.body.style.paddingRight = `${currentPadding + scrollbarGap}px`;
    }
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeHelp();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => !element.hasAttribute("hidden"));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialogRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", closeWithEscape);
    return () => {
      document.documentElement.removeAttribute("data-service-help-open");
      if (appViewport) appViewport.inert = previousViewportInert;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.paddingRight = previousBodyPaddingRight;
      window.removeEventListener("keydown", closeWithEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!tourOpen) return;
    const area = tourAreas[tourIndex];
    if (!area) return;

    const highlightsHelpTrigger = area.selector.includes("service-help-trigger");
    if (highlightsHelpTrigger) {
      document.documentElement.setAttribute("data-service-help-trigger-target", "true");
    } else {
      document.documentElement.removeAttribute("data-service-help-trigger-target");
    }

    const target = document.querySelector<HTMLElement>(area.selector);
    if (!target) {
      setTourOpen(false);
      setOpen(true);
      return;
    }

    document.documentElement.setAttribute("data-service-help-open", "true");
    const appViewport = document.querySelector<HTMLElement>(".app-viewport");
    const previousViewportInert = appViewport?.inert ?? false;
    if (appViewport) appViewport.inert = true;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyPaddingRight = document.body.style.paddingRight;
    const scrollbarGap = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    if (scrollbarGap > 0) {
      const currentPadding = Number.parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;
      document.body.style.paddingRight = `${currentPadding + scrollbarGap}px`;
    }

    const updateSpotlight = () => {
      const rect = target.getBoundingClientRect();
      const gap = window.innerWidth <= 640 ? 6 : 10;
      const top = Math.max(8, rect.top - gap);
      const left = Math.max(8, rect.left - gap);
      const right = Math.min(window.innerWidth - 8, rect.right + gap);
      const bottom = Math.min(window.innerHeight - 8, rect.bottom + gap);
      setSpotlightRect({
        top,
        left,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
      });
    };

    target.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
    updateSpotlight();
    const settleTimer = window.setTimeout(updateSpotlight, 100);
    const positionTimer = window.setInterval(updateSpotlight, 120);
    document.body.style.overflow = "hidden";
    tourTitleRef.current?.focus();

    const handleViewportChange = () => updateSpotlight();
    const handleTourKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeHelp();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        tourDialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => !element.hasAttribute("hidden"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!tourDialogRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("keydown", handleTourKeys);
    const resizeObserver = new ResizeObserver(updateSpotlight);
    resizeObserver.observe(target);
    window.visualViewport?.addEventListener("resize", handleViewportChange);
    window.visualViewport?.addEventListener("scroll", handleViewportChange);
    return () => {
      window.clearTimeout(settleTimer);
      window.clearInterval(positionTimer);
      document.documentElement.removeAttribute("data-service-help-trigger-target");
      document.documentElement.removeAttribute("data-service-help-open");
      if (appViewport) appViewport.inert = previousViewportInert;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.paddingRight = previousBodyPaddingRight;
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("keydown", handleTourKeys);
      resizeObserver.disconnect();
      window.visualViewport?.removeEventListener("resize", handleViewportChange);
      window.visualViewport?.removeEventListener("scroll", handleViewportChange);
    };
  }, [tourAreas, tourIndex, tourOpen]);

  const openAreaTour = (areas: readonly ServiceHelpArea[]) => {
    const availableAreas = areas.filter((area) => {
      const element = document.querySelector<HTMLElement>(area.selector);
      if (!element || !element.isConnected || element.getClientRects().length === 0) return false;
      const style = window.getComputedStyle(element);
      return style.display !== "none"
        && style.visibility !== "hidden"
        && !element.hidden
        && element.getAttribute("aria-hidden") !== "true";
    });
    if (availableAreas.length === 0) {
      setOpen(true);
      return;
    }
    setTourAreas([...availableAreas]);
    setTourIndex(0);
    setTourOpen(true);
  };

  const startAreaTour = () => {
    manualInteractionKeyRef.current = autoOpenStorageKey;
    if (autoOpenStorageKey) {
      autoOpenAttemptRef.current = autoOpenStorageKey;
      try {
        window.localStorage.setItem(autoOpenStorageKey, "complete");
      } catch {
        // 저장소를 사용할 수 없어도 현재 화면의 수동 도움말은 계속 제공합니다.
      }
    }
    openAreaTour(help.areas);
  };

  useEffect(() => {
    const openHomeOnboarding = () => {
      if (pathname !== "/home" || !autoOpenStorageKey?.endsWith(":home")) return;

      autoOpenAttemptRef.current = autoOpenStorageKey;
      try {
        if (window.localStorage.getItem(autoOpenStorageKey) === "complete") return;
        window.localStorage.setItem(autoOpenStorageKey, "complete");
      } catch {
        // 저장소 오류가 있어도 현재 첫 진입 안내는 계속 진행합니다.
      }

      const desktop = window.matchMedia("(min-width: 1280px)").matches;
      openAreaTour([
        {
          title: "마이페이지에서 내 정보를 관리해요",
          description: "학교·전공·관심 분야를 이 기기에 저장하고 나중에 다시 수정할 수 있어요.",
          selector: desktop
            ? '[data-service-onboarding="desktop-profile"]'
            : '[data-service-onboarding="mobile-profile"]',
        },
        {
          title: "홈에서는 지금 할 일을 먼저 봐요",
          description: "교수 연결, 프로젝트, 성장 기록 중 지금 이어갈 한 가지와 현재 상태를 확인해요.",
          selector: '[data-service-onboarding="home-content"]',
        },
        {
          title: "궁금한 화면은 도움말 AI에게 물어보세요",
          description: "도움말을 누르면 화면 안내 AI가 현재 화면의 핵심 카드와 버튼을 순서대로 짚어줘요.",
          selector: ".service-tab-header .service-help-trigger",
        },
      ]);
    };

    window.addEventListener(SERVICE_HOME_ONBOARDING_EVENT, openHomeOnboarding);
    return () => window.removeEventListener(SERVICE_HOME_ONBOARDING_EVENT, openHomeOnboarding);
  }, [autoOpenStorageKey, pathname]);

  useEffect(() => {
    if (!autoOpenStorageKey || autoOpenAttemptRef.current === autoOpenStorageKey) return;

    try {
      if (window.localStorage.getItem(autoOpenStorageKey) === "complete") {
        autoOpenAttemptRef.current = autoOpenStorageKey;
        return;
      }
    } catch {
      // 저장소가 막힌 환경에서는 현재 마운트의 ref로만 중복을 막습니다.
    }

    const timer = window.setTimeout(() => {
      if (autoOpenAttemptRef.current === autoOpenStorageKey) return;
      autoOpenAttemptRef.current = autoOpenStorageKey;

      if (
        manualInteractionKeyRef.current === autoOpenStorageKey
        || navigationGuideRequested
        || document.documentElement.hasAttribute("data-service-nav-guide-open")
      ) return;

      try {
        window.localStorage.setItem(autoOpenStorageKey, "complete");
      } catch {
        // 저장소 오류가 도움말 노출 자체를 막지 않게 합니다.
      }
      setOpen(true);
    }, 240);

    return () => window.clearTimeout(timer);
  }, [autoOpenStorageKey, navigationGuideRequested]);

  const openFullGuide = () => {
    setTourOpen(false);
    setSpotlightRect(null);
    window.setTimeout(() => setOpen(true), 40);
  };

  const activeTourArea = tourAreas[tourIndex];
  const tourPlacement = spotlightRect
    && typeof window !== "undefined"
    && spotlightRect.top + spotlightRect.height / 2 > window.innerHeight / 2
    ? "is-top"
    : "is-bottom";
  const showPreviousTourArea = () => setTourIndex((index) => Math.max(0, index - 1));
  const showNextTourArea = () => {
    if (tourIndex >= tourAreas.length - 1) {
      closeHelp();
      return;
    }
    setTourIndex((index) => index + 1);
  };

  const openNavigationGuide = () => {
    setOpen(false);
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent(SERVICE_NAV_GUIDE_EVENT));
    }, 80);
  };

  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) closeHelp();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`service-help-trigger service-help-trigger--${placement}`}
        aria-haspopup="dialog"
        aria-expanded={open || tourOpen}
        onClick={startAreaTour}
      >
        <CircleHelp size={18} aria-hidden="true" />
        <span>도움말</span>
      </button>

      {tourOpen && activeTourArea && typeof document !== "undefined" ? createPortal((
        <div className="service-help-tour-backdrop" onMouseDown={closeFromBackdrop}>
          {spotlightRect ? (
            <span
              className="service-help-tour__spotlight"
              style={{
                top: spotlightRect.top,
                left: spotlightRect.left,
                width: spotlightRect.width,
                height: spotlightRect.height,
              }}
              aria-hidden="true"
            />
          ) : null}
          <section
            ref={tourDialogRef}
            className={`service-help-tour ${tourPlacement}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="service-help-tour-title"
            aria-describedby="service-help-tour-description"
          >
            <button
              ref={tourCloseButtonRef}
              type="button"
              className="service-help-tour__close"
              aria-label="화면 안내 닫기"
              onClick={closeHelp}
            >
              <X size={18} aria-hidden="true" />
            </button>

            <header className="service-help-tour__header">
              <span aria-hidden="true">
                <Image
                  src={mascotForSection(help.section)}
                  alt=""
                  width={76}
                  height={76}
                  priority
                />
              </span>
              <div>
                <span><Sparkles size={13} aria-hidden="true" /> 화면 안내 AI</span>
                <small aria-live="polite">{help.label} · {tourIndex + 1} / {tourAreas.length}</small>
                <h2 ref={tourTitleRef} id="service-help-tour-title" tabIndex={-1}>{activeTourArea.title}</h2>
              </div>
            </header>

            <p id="service-help-tour-description">{activeTourArea.description}</p>

            <footer className="service-help-tour__footer">
              <button type="button" className="service-help-tour__full-guide" onClick={openFullGuide}>
                <ListChecks size={16} aria-hidden="true" /> 전체 사용 안내
              </button>
              <div>
                {tourIndex > 0 ? (
                  <button type="button" className="service-help-tour__previous" onClick={showPreviousTourArea}>
                    <ChevronLeft size={17} aria-hidden="true" /> 이전
                  </button>
                ) : null}
                <button type="button" className="service-help-tour__next" onClick={showNextTourArea}>
                  {tourIndex >= tourAreas.length - 1 ? "확인했어요" : "다음 영역"}
                  {tourIndex < tourAreas.length - 1 ? <ArrowRight size={17} aria-hidden="true" /> : null}
                </button>
              </div>
            </footer>
          </section>
        </div>
      ), document.body) : null}

      {open && typeof document !== "undefined" ? createPortal((
        <div className="service-help-backdrop" onMouseDown={closeFromBackdrop}>
          <section
            ref={dialogRef}
            className="service-help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="service-help-title"
            aria-describedby="service-help-purpose"
          >
            <button
              ref={closeButtonRef}
              type="button"
              className="service-help-dialog__close"
              aria-label="도움말 닫기"
              onClick={closeHelp}
            >
              <X size={19} aria-hidden="true" />
            </button>

            <header className="service-help-dialog__header">
              <span className="service-help-dialog__mascot" aria-hidden="true">
                <Image
                  src={mascotForSection(help.section)}
                  alt=""
                  width={104}
                  height={104}
                  priority
                />
              </span>
              <div>
                <span className="service-help-dialog__label"><Sparkles size={14} /> 화면 안내 AI</span>
                <small>{help.label}</small>
                <h2 id="service-help-title">{help.title}</h2>
              </div>
            </header>

            <div className="service-help-dialog__body">
              <div className="service-help-dialog__purpose" id="service-help-purpose">
                <strong>이 화면의 목적</strong>
                <p>{help.purpose}</p>
              </div>

              <section className="service-help-dialog__steps" aria-labelledby="service-help-steps-title">
                <header>
                  <span><ListChecks size={16} aria-hidden="true" /></span>
                  <strong id="service-help-steps-title">탭 사용 순서</strong>
                  <small>3단계</small>
                </header>
                <ol>
                  {help.steps.map((step, index) => (
                    <li key={step.title}>
                      <span>{index + 1}</span>
                      <div>
                        <strong>{step.title}</strong>
                        <p>{step.description}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>

              <div className="service-help-dialog__actions-now">
                <article>
                  <span>지금 해볼 일</span>
                  <p>{help.now}</p>
                </article>
                <article>
                  <span>다음으로 이어져요</span>
                  <p>{help.next}</p>
                </article>
              </div>

              {journey ? (
                <div className={`service-help-dialog__journey is-${journey.key}`}>
                  <strong>{journey.label}</strong>
                  <ol>
                    {JOURNEY_STEPS[journey.key].map((step, index) => (
                      <li key={step} className={journey.step === index + 1 ? "is-current" : undefined}>
                        <span>{index + 1}</span>
                        {step}
                        {index === 0 ? <ArrowRight size={14} aria-hidden="true" /> : null}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </div>

            <footer className="service-help-dialog__footer">
              <button type="button" className="service-help-dialog__menu-guide" onClick={openNavigationGuide}>
                <Map size={17} aria-hidden="true" /> 전체 메뉴 안내
              </button>
              <button type="button" className="service-help-dialog__confirm" onClick={closeHelp}>
                알겠어요
              </button>
            </footer>
          </section>
        </div>
      ), document.body) : null}
    </>
  );
}

export function ServiceHelpGuide(props: ServiceHelpGuideProps) {
  return (
    <Suspense fallback={null}>
      <ServiceHelpGuideContent {...props} />
    </Suspense>
  );
}
