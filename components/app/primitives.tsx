"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bookmark,
  Check,
  ChevronRight,
  Info,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type {
  ButtonHTMLAttributes,
  CSSProperties,
  HTMLAttributes,
  ReactNode,
} from "react";
import { forwardRef } from "react";
import { ServiceHelpGuide } from "@/components/app/service-help-guide";
import { SideNav } from "@/components/app/side-nav";
import { BrandLogo } from "@/components/brand/brand-logo";
import { brandLogo } from "@/lib/brand-assets";
import { backLabelForDestination, resolveBackNavigation } from "@/lib/navigation-flow";

export function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function AppLogo({ compact = false }: { compact?: boolean }) {
  const markSize = compact ? 34 : 42;
  return (
    <span className={cx("app-logo", compact && "app-logo--compact")}>
      <Image
        className="app-logo__mark"
        src={brandLogo.mark}
        alt=""
        aria-hidden="true"
        width={markSize}
        height={markSize}
        priority
        unoptimized
      />
      <span>
        <strong>너의 교수님은?</strong>
        {!compact && <small>찾다 · 만들다 · 잇다</small>}
      </span>
    </span>
  );
}

export function PrimaryButton({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={cx("button button--primary", className)} {...props}>
      {children}
    </button>
  );
}

export function SecondaryButton({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={cx("button button--secondary", className)} {...props}>
      {children}
    </button>
  );
}

export function TextButton({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={cx("text-button", className)} {...props}>
      {children}
    </button>
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  active?: boolean;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, active, children, className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cx("icon-button", active && "is-active", className)}
      aria-label={label}
      title={label}
      aria-pressed={active}
      {...props}
    >
      {children}
    </button>
  );
});

export function LinkButton({
  href,
  children,
  secondary = false,
}: {
  href: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  return (
    <Link className={cx("button", secondary ? "button--secondary" : "button--primary")} href={href}>
      {children}
    </Link>
  );
}

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("card", className)} {...props}>
      {children}
    </div>
  );
}

export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: string }) {
  return <span className={cx("tag", `tag--${tone}`)}>{children}</span>;
}

export function ChoiceChip({
  selected,
  onClick,
  children,
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={cx("choice-chip", selected && "is-selected")}
      aria-pressed={selected}
      onClick={onClick}
      disabled={disabled}
    >
      {selected && <Check size={15} aria-hidden="true" />}
      {children}
    </button>
  );
}

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <header className="page-header">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {description && <p className="page-header__description">{description}</p>}
    </header>
  );
}

export function ProgressBar({ value, max = 100, label }: { value: number; max?: number; label?: string }) {
  const percent = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="progress" aria-label={label} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <span style={{ "--progress": `${percent}%` } as CSSProperties} />
    </div>
  );
}

export function AppShell({
  children,
  title,
  backHref,
  backLabel,
  onBack,
  step,
  stickyAction,
  topAction,
  showHeader = true,
  showSideNav = true,
  bottomNav,
  className,
}: {
  children: ReactNode;
  title?: string;
  backHref?: string;
  backLabel?: string;
  onBack?: () => void;
  step?: { current: number; total: number };
  stickyAction?: ReactNode;
  topAction?: ReactNode;
  showHeader?: boolean;
  /** 넓은 화면 좌측 내비. 스플래시처럼 몰입이 필요한 화면에서만 끕니다. */
  showSideNav?: boolean;
  bottomNav?: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }

    const navigation = resolveBackNavigation(backHref);
    if (navigation?.mode === "back") {
      router.back();
    } else if (navigation?.mode === "replace") {
      router.replace(navigation.href);
    }
  };

  return (
    <>
    {showSideNav && <SideNav />}
    <div className={cx("app-viewport", showSideNav && "has-side-nav", className)}>
      {!showHeader ? (
        <header className="service-tab-header" aria-label="서비스 공통 메뉴">
          <BrandLogo href="/home" compact className="service-tab-header__brand" />
          <div className="service-tab-header__actions">
            <Link
              href="/welcome"
              className="service-tab-header__intro"
              aria-label="서비스 소개"
              title="서비스 소개"
            >
              <Info size={18} aria-hidden="true" />
              <span className="service-tab-header__intro-long">서비스 소개</span>
              <span className="service-tab-header__intro-short" aria-hidden="true">소개</span>
            </Link>
            <ServiceHelpGuide placement="header" />
            <Link
              href="/profile"
              className="service-tab-header__profile"
              aria-label="마이페이지"
              title="마이페이지"
              data-service-onboarding="mobile-profile"
            >
              <UserRound size={21} aria-hidden="true" />
            </Link>
          </div>
        </header>
      ) : null}
      {showHeader && (
        <header className="top-app-bar">
          <div className="top-app-bar__side">
            {(backHref || onBack) && (
              <IconButton label={backLabel ?? backLabelForDestination(backHref)} onClick={handleBack}>
                <ArrowLeft size={21} aria-hidden="true" />
              </IconButton>
            )}
          </div>
          <strong>{title}</strong>
          <div className="top-app-bar__side top-app-bar__side--right">
            {step ? <span className="step-count">{step.current} / {step.total}</span> : topAction}
            <ServiceHelpGuide placement="header" />
          </div>
        </header>
      )}
      <main
        id="main-content"
        className={cx(
          "screen-content",
          Boolean(stickyAction) && "has-sticky-action",
          Boolean(bottomNav) && "has-bottom-nav",
        )}
      >
        <div className="screen-enter">{children}</div>
      </main>
      {stickyAction && <div className="sticky-action">{stickyAction}</div>}
      {bottomNav}
    </div>
    </>
  );
}

export function ChoiceCard({
  title,
  description,
  selected,
  onClick,
  icon: Icon,
}: {
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  icon: LucideIcon;
}) {
  return (
    <button type="button" className={cx("choice-card", selected && "is-selected")} aria-pressed={selected} onClick={onClick}>
      <span className="choice-card__icon"><Icon size={21} aria-hidden="true" /></span>
      <span className="choice-card__copy"><strong>{title}</strong><small>{description}</small></span>
      <span className="choice-card__check" aria-hidden="true">{selected ? <Check size={17} /> : <ChevronRight size={18} />}</span>
    </button>
  );
}

export function SaveButton({ saved, onClick, label = "저장" }: { saved: boolean; onClick: () => void; label?: string }) {
  return (
    <IconButton label={saved ? `${label} 취소` : label} active={saved} onClick={onClick}>
      <Bookmark size={19} fill={saved ? "currentColor" : "none"} aria-hidden="true" />
    </IconButton>
  );
}

export function StatusBanner({
  icon: Icon,
  title,
  children,
  tone = "info",
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  tone?: "info" | "success" | "warning" | "lavender";
}) {
  return (
    <div className={cx("status-banner", `status-banner--${tone}`)}>
      <span className="status-banner__icon"><Icon size={20} aria-hidden="true" /></span>
      <div><strong>{title}</strong><p>{children}</p></div>
    </div>
  );
}

export function EmptyState({
  image,
  title,
  description,
  action,
}: {
  image?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {image && <Image src={image} alt="" width={88} height={88} />}
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}
