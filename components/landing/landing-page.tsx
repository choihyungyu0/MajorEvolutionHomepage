"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  CheckCircle2,
  Compass,
  FileCheck2,
  FlaskConical,
  Mail,
  Menu,
  MessageCircleQuestion,
  Route,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useState } from "react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { LandingProductPreview } from "@/components/landing/landing-product-preview";
import { brandScene } from "@/lib/brand-assets";
import { SERVICE_HOME_WITH_NAV_GUIDE } from "@/lib/service-navigation";
import { useProfileStore } from "@/store/profile-store";
import styles from "./landing-page.module.css";

const NAV_ITEMS = [
  { href: "#about", label: "서비스 소개" },
  { href: "#preview", label: "서비스 화면" },
  { href: "#flow", label: "교수 연결 흐름" },
  { href: "#trust", label: "신뢰 원칙" },
] as const;

const PROBLEMS = [
  {
    icon: MessageCircleQuestion,
    title: "고민을 어떻게 설명할지 막막해요",
    description: "관심은 있지만 진로, 수업, 프로젝트 중 무엇부터 물어야 할지 정리하기 어렵습니다.",
  },
  {
    icon: SearchCheck,
    title: "누구에게 왜 물어볼지 모르겠어요",
    description: "교수 정보는 많아도 내 고민과 어떤 연결점이 있는지 한눈에 알기 어렵습니다.",
  },
  {
    icon: Route,
    title: "조언이 다음 행동으로 이어지지 않아요",
    description: "좋은 이야기를 들어도 수업 선택이나 프로젝트 시작으로 옮길 구체적인 계획이 남지 않습니다.",
  },
] as const;

const FLOW = [
  {
    number: "01",
    title: "교수 연결의 기본을 설정하다",
    description:
      "전공과 관심 분야만 두 단계로 설정합니다. 설정을 마치면 단국대학교 공식 교수 정보에서 연결 이유가 다른 세 분을 보여드려요.",
    points: ["전공·관심 분야만 입력", "입력은 이 기기에 저장", "완료 후 교수 3인 피칭"],
    image: brandScene.home.w1440,
    alt: "학생과 AI 가이드가 캠퍼스에서 전공과 진로 방향을 정리하는 장면",
  },
  {
    number: "02",
    title: "역할이 다른 교수를 찾다",
    description:
      "입력한 주전공과 부·복수전공 교수님을 가까운 시작점으로 보고, 전체 교수 중에서 내 관심 주제와 방법의 공식 근거가 가장 강한 후보를 비교합니다.",
    points: ["학업 소속 교수 한 명부터", "전체 교수의 주제·방법 근거 비교", "추천 이유·공식 근거·직접 확인할 항목"],
    image: brandScene.find.w1440,
    alt: "학생이 학교 공식 정보를 바탕으로 교수 연결 이유를 살펴보는 장면",
  },
  {
    number: "03",
    title: "첫 대화와 다음 행동을 잇다",
    description:
      "교수 정보를 읽는 데서 끝내지 않습니다. 첫 질문과 연락 초안을 준비하고, 면담에서 얻은 조언을 다음 행동으로 바꿔요.",
    points: ["논문 한입과 첫 질문", "학생이 검토하는 이메일 초안", "면담 후 7일 행동과 성장 기록"],
    image: brandScene.connect.w1440,
    alt: "학생이 교수와 대화를 준비하고 다음 행동을 연결하는 장면",
  },
] as const;

const JOURNEYS = [
  {
    icon: SearchCheck,
    eyebrow: "교수 연결 여정",
    title: "내 고민을 함께 이야기할 교수님을 찾아요",
    description:
      "전공과 관심 분야를 설정하고, 공식 교수 정보에서 연결 이유를 확인한 뒤 첫 만남을 준비합니다.",
    steps: ["전공·관심 기본 설정", "근거가 보이는 교수 3인 피칭", "논문·질문·이메일·면담 준비"],
    href: "/tutorial",
    cta: "교수 연결 시작하기",
  },
  {
    icon: FlaskConical,
    eyebrow: "프로젝트 여정",
    title: "관심을 실행 가능한 프로젝트로 구체화해요",
    description:
      "AI와 공통 질문 뒤 맞춤 질문을 나누고, 프로젝트 후보를 고르면 필요한 전문성을 가진 교수를 다시 찾습니다.",
    steps: ["공통 3문항과 맞춤 2문항", "프로젝트 후보와 실행 조건 비교", "주제·방법·확장 역할별 교수 추천"],
    href: "/research/tutorial",
    cta: "프로젝트 설계 시작하기",
  },
] as const;

const OUTCOMES = [
  {
    icon: Sparkles,
    title: "AI 맞춤 공동설계",
    description: "공통 질문 3개 뒤에는 앞선 답변을 반영한 맞춤 질문 2개로 프로젝트의 문제·방법·범위를 좁힙니다.",
  },
  {
    icon: FlaskConical,
    title: "프로젝트 맞춤 교수 추천",
    description: "선택한 프로젝트를 기준으로 공식 후보 안에서 주제·방법·확장 역할이 다른 교수를 확인합니다.",
  },
  {
    icon: Route,
    title: "나의 성장과정",
    description: "처음 남긴 고민부터 프로젝트 설계, 교수 연결과 다음 행동까지 실제 저장한 경험을 한곳에서 이어 봅니다.",
  },
  {
    icon: MessageCircleQuestion,
    title: "나의 AI 교수님과 대화 지도",
    description: "진로·프로젝트 대화에서 나온 질문·발견·결정·다음 행동을 카드로 보고, 원문에서 새 갈래를 이어가거나 핵심만 성장 메모로 남깁니다.",
  },
] as const;

const AUDIENCES = [
  { icon: Compass, title: "진로 방향", copy: "내 전공으로 가능한 선택을 교수와 점검하고 싶을 때" },
  { icon: BookOpen, title: "수업 선택", copy: "관심 분야를 위해 어떤 수업부터 들을지 궁금할 때" },
  { icon: BriefcaseBusiness, title: "프로젝트", copy: "작은 경험으로 내 관심과 적성을 시험해 보고 싶을 때" },
  { icon: FlaskConical, title: "연구·대학원", copy: "연구실과 대학원 생활을 현실적으로 알아보고 싶을 때" },
] as const;

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const markServiceEntered = useProfileStore((state) => state.markServiceEntered);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <BrandLogo href="/" tagline="전공·진로 첫 대화" className={styles.logo} />

          <nav className={styles.desktopNav} aria-label="랜딩페이지 주요 메뉴">
            {NAV_ITEMS.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>

          <div className={styles.headerActions}>
            <Link href="/home" className={styles.resumeLink} onClick={markServiceEntered}>
              이어하기
            </Link>
            <Link href={SERVICE_HOME_WITH_NAV_GUIDE} className={styles.headerCta} onClick={markServiceEntered}>
              서비스 시작하기
            </Link>
          </div>

          <button
            type="button"
            className={styles.menuButton}
            aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={menuOpen}
            aria-controls="landing-mobile-menu"
            onClick={() => setMenuOpen((value) => !value)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {menuOpen && (
          <nav id="landing-mobile-menu" className={styles.mobileMenu} aria-label="모바일 메뉴">
            {NAV_ITEMS.map((item) => (
              <a key={item.href} href={item.href} onClick={closeMenu}>
                {item.label}
              </a>
            ))}
            <Link href="/home" onClick={() => { markServiceEntered(); closeMenu(); }}>
              이어하기
            </Link>
            <Link
              href={SERVICE_HOME_WITH_NAV_GUIDE}
              className={styles.mobileMenuCta}
              onClick={() => { markServiceEntered(); closeMenu(); }}
            >
              서비스 시작하기 <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </nav>
        )}
      </header>

      <main id="main-content">
        <section className={styles.hero} aria-labelledby="landing-title">
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <h1 id="landing-title">
                막막한 전공·진로 고민,
                <br />
                이제 <em>누구와 이야기할지</em>부터
                <br className={styles.desktopBreak} /> 찾으세요.
              </h1>
              <p>
                공식 정보로 교수 연결을 준비하고,
                <br className={styles.desktopBreak} /> AI와 프로젝트를 구체화해
                <br className={styles.desktopBreak} /> 첫 만남과 성장 기록까지 이어갑니다.
              </p>
              <div className={styles.heroActions}>
                <Link href={SERVICE_HOME_WITH_NAV_GUIDE} className={styles.primaryCta} onClick={markServiceEntered}>
                  서비스 시작하기 <ArrowRight size={19} aria-hidden="true" />
                </Link>
                <a href="#preview" className={styles.secondaryCta}>
                  실제 화면 보기 <ArrowRight size={18} aria-hidden="true" />
                </a>
              </div>
              <div className={styles.trustNote}>
                <ShieldCheck size={18} aria-hidden="true" />
                <span>단국대학교 공식 교수 정보 기반 · 교수에게 자동으로 연락하지 않아요</span>
              </div>
            </div>

            <div className={styles.heroMedia}>
              <Image
                src={brandScene.home.w1920 ?? brandScene.home.w1440}
                alt="학생과 AI 가이드가 캠퍼스에서 교수 연결과 다음 행동을 탐색하는 모습"
                fill
                priority
                sizes="(max-width: 767px) 100vw, 54vw"
              />
            </div>
          </div>
          <a href="#about" className={styles.scrollCue} aria-label="서비스 문제 설명으로 이동">
            <span>왜 필요한가요?</span>
            <span className={styles.scrollLine} aria-hidden="true" />
          </a>
        </section>

        <section id="about" className={styles.problemSection} aria-labelledby="problem-title">
          <div className={styles.sectionInner}>
            <div className={styles.problemIntro}>
              <h2 id="problem-title">
                교수 정보는 많지만,
                <br />
                <em>첫 대화까지 가는 길</em>은 흩어져 있습니다.
              </h2>
              <p>
                학생에게 부족한 것은 검색 결과보다, 내 고민을 설명하고 적절한 사람에게 질문한 뒤
                행동으로 옮기는 과정입니다.
              </p>
            </div>

            <div className={styles.problemList}>
              {PROBLEMS.map((problem) => {
                const Icon = problem.icon;
                return (
                  <article key={problem.title}>
                    <span className={styles.problemIcon} aria-hidden="true">
                      <Icon size={23} />
                    </span>
                    <div>
                      <h3>{problem.title}</h3>
                      <p>{problem.description}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="solution" className={styles.promiseSection} aria-labelledby="promise-title">
          <div className={styles.promiseInner}>
            <Sparkles size={28} aria-hidden="true" />
            <h2 id="promise-title">
              그래서 교수 검색 화면이 아니라,
              <br />
              <em>고민이 행동으로 자라는 과정</em>을 설계했습니다.
            </h2>
            <p>AI는 생각과 근거를 정리하고, 실제 교수와의 대화와 학생의 선택이 다음 방향을 만듭니다.</p>
          </div>
        </section>

        <LandingProductPreview />

        <section id="journeys" className={styles.journeySection} aria-labelledby="journey-title">
          <div className={styles.sectionInner}>
            <div className={`${styles.sectionHeading} ${styles.journeyHeading}`}>
              <h2 id="journey-title">지금 필요한 여정부터 시작할 수 있어요.</h2>
              <p>교수를 먼저 만나도, 프로젝트를 먼저 설계해도 괜찮아요. 두 여정은 성장 기록에서 다시 연결됩니다.</p>
            </div>

            <div className={styles.journeyGrid}>
              {JOURNEYS.map((journey) => {
                const Icon = journey.icon;
                return (
                  <article key={journey.eyebrow} className={styles.journeyCard}>
                    <div className={styles.journeyCardHeading}>
                      <span className={styles.journeyIcon} aria-hidden="true"><Icon size={24} /></span>
                      <span className={styles.journeyEyebrow}>{journey.eyebrow}</span>
                    </div>
                    <h3>{journey.title}</h3>
                    <p>{journey.description}</p>
                    <ol className={styles.journeySteps}>
                      {journey.steps.map((step, index) => (
                        <li key={step}>
                          <span>{index + 1}</span>
                          <strong>{step}</strong>
                        </li>
                      ))}
                    </ol>
                    <Link href={journey.href} className={styles.journeyCta}>
                      {journey.cta} <ArrowRight size={17} aria-hidden="true" />
                    </Link>
                  </article>
                );
              })}
            </div>

            <div className={styles.growthBridge}>
              <Route size={20} aria-hidden="true" />
              <p><strong>두 여정의 기록은 사라지지 않아요.</strong> 관심 변화, 선택한 프로젝트, 연결한 교수와 다음 행동을 ‘나의 성장과정’에서 다시 확인합니다.</p>
              <Link href="/portfolio">성장과정 보기 <ArrowRight size={16} aria-hidden="true" /></Link>
            </div>
          </div>
        </section>

        <section id="flow" className={styles.flowSection} aria-labelledby="flow-title">
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeading}>
              <h2 id="flow-title">교수 연결은 이렇게 첫 만남까지 이어져요.</h2>
              <p>고민을 입력하는 순간부터 교수 선택, 대화 준비와 면담 이후의 행동까지 한 흐름으로 이어집니다.</p>
            </div>

            <div className={styles.flowList}>
              {FLOW.map((step, index) => (
                <article key={step.number} className={styles.flowItem}>
                  <div className={styles.flowCopy}>
                    <span className={styles.flowNumber}>{step.number}</span>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                    <ul>
                      {step.points.map((point) => (
                        <li key={point}>
                          <CheckCircle2 size={17} aria-hidden="true" /> {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <figure className={styles.flowMedia}>
                    <Image
                      src={step.image}
                      alt={step.alt}
                      fill
                      sizes="(max-width: 767px) 100vw, 58vw"
                      loading={index === 0 ? "eager" : "lazy"}
                    />
                  </figure>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.outcomeSection} aria-labelledby="outcome-title">
          <div className={styles.sectionInner}>
            <div className={styles.outcomeHeading}>
              <div>
                <h2 id="outcome-title">
                  첫 교수 연결 이후,
                  <br />
                  <em>프로젝트와 성장</em>까지 이어져요.
                </h2>
                <p>추천 한 번으로 끝내지 않고, 생각이 구체화된 과정을 내가 확인하고 다시 이어갈 수 있습니다.</p>
              </div>
              <figure className={styles.outcomeMedia}>
                <Image
                  src={brandScene.make.w1440}
                  alt="학생과 AI 가이드가 관심을 실행 가능한 프로젝트로 구체화하는 모습"
                  fill
                  sizes="(max-width: 767px) 100vw, 43vw"
                />
              </figure>
            </div>

            <div className={styles.outcomeRail}>
              {OUTCOMES.map((outcome, index) => {
                const Icon = outcome.icon;
                return (
                  <article key={outcome.title}>
                    <span className={styles.outcomeIndex}>{index + 1}</span>
                    <span className={styles.outcomeIcon} aria-hidden="true">
                      <Icon size={25} />
                    </span>
                    <h3>{outcome.title}</h3>
                    <p>{outcome.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="trust" className={styles.trustSection} aria-labelledby="trust-title">
          <div className={styles.trustInner}>
            <div className={styles.trustHeading}>
              <ShieldCheck size={31} aria-hidden="true" />
              <h2 id="trust-title">
                AI는 답을 대신하지 않고,
                <br />
                사람과의 <em>대화를 준비합니다.</em>
              </h2>
            </div>

            <div className={styles.trustGrid}>
              <article>
                <FileCheck2 size={24} aria-hidden="true" />
                <h3>공식 출처와 확인일</h3>
                <p>학과·대학·연구실 등 확인 가능한 출처와 마지막 확인 시점을 함께 보여줍니다.</p>
              </article>
              <article>
                <SearchCheck size={24} aria-hidden="true" />
                <h3>사실과 질문을 분리</h3>
                <p>확인된 정보와 교수에게 직접 물어봐야 할 최신 정보를 구분합니다.</p>
              </article>
              <article>
                <Mail size={24} aria-hidden="true" />
                <h3>학생이 직접 연락</h3>
                <p>초안은 사용자가 검토·수정하며, 최종 연락과 선택은 학생이 직접 진행합니다.</p>
              </article>
            </div>
          </div>
        </section>

        <section className={styles.audienceSection} aria-labelledby="audience-title">
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeading}>
              <h2 id="audience-title">지금 고민의 모양이 달라도 시작할 수 있어요.</h2>
              <p>연구만을 위한 서비스가 아닙니다. 대학생활에서 방향을 정해야 하는 순간을 함께 다룹니다.</p>
            </div>
            <div className={styles.audienceList}>
              {AUDIENCES.map((audience) => {
                const Icon = audience.icon;
                return (
                  <article key={audience.title}>
                    <Icon size={22} aria-hidden="true" />
                    <div>
                      <h3>{audience.title}</h3>
                      <p>{audience.copy}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className={styles.closingSection} aria-labelledby="closing-title">
          <div className={styles.closingInner}>
            <div className={styles.closingCopy}>
              <h2 id="closing-title">
                혼자 고민하던 시간을,
                <br />
                <em>나만의 성장 흐름</em>으로 바꿔보세요.
              </h2>
              <p>가입 없이 전공과 관심 분야를 설정하면 첫 교수 연결을 확인할 수 있고, 이후 프로젝트와 성장 기록을 이 기기에서 이어갈 수 있어요.</p>
              <div className={styles.closingActions}>
                <Link href={SERVICE_HOME_WITH_NAV_GUIDE} className={styles.primaryCta} onClick={markServiceEntered}>
                  서비스 시작하기 <ArrowRight size={19} aria-hidden="true" />
                </Link>
                <Link href="/home" className={styles.closingResume} onClick={markServiceEntered}>
                  이어하기 <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </div>
            <figure className={styles.closingMedia}>
              <Image
                src={brandScene.nextSeed.w1440}
                alt="학생이 교수와의 대화 후 다음 행동 계획을 세우는 모습"
                fill
                sizes="(max-width: 900px) 100vw, 55vw"
              />
              <figcaption className={styles.closingCaption}>
                <span>
                  <Sparkles size={15} aria-hidden="true" /> 첫 대화 이후
                </span>
                <strong>조언을 나의 다음 행동으로</strong>
              </figcaption>
            </figure>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <BrandLogo href="/" inverse />
            <p>대학생의 고민을 교수 연결, 프로젝트와 다음 행동으로 이어갑니다.</p>
          </div>
          <nav aria-label="푸터 메뉴">
            <a href="#about">서비스 소개</a>
            <a href="#preview">서비스 화면</a>
            <a href="#flow">이용 흐름</a>
            <a href="#trust">신뢰 원칙</a>
            <Link href="/home" onClick={markServiceEntered}>서비스 홈</Link>
          </nav>
          <div className={styles.footerTeam}>
            <span>TEAM TRION</span>
            <p>
              <strong>팀장</strong> 이연수 <i aria-hidden="true">·</i> <strong>팀원</strong> 최현규, 이진재
            </p>
          </div>
          <p className={styles.footerNote}>교수 정보는 공식 출처를 우선하며, 연락과 최종 선택은 학생이 직접 진행합니다.</p>
        </div>
      </footer>
    </div>
  );
}
