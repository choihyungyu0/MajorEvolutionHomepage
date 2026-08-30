import Image from "next/image";
import {
  FlaskConical,
  MessageSquareText,
  Search,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import {
  getJourneyStageTheme,
  type JourneyStage,
} from "@/lib/journey-stage-theme";
import styles from "./journey-stage-hero.module.css";

const STAGE_ICON: Record<JourneyStage, LucideIcon> = {
  match: Search,
  project: FlaskConical,
  recommend: Sparkles,
  meeting: MessageSquareText,
};

export function JourneyStageHero({
  stage,
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  stage: JourneyStage;
  eyebrow?: string;
  title: string;
  description: string;
  children?: ReactNode;
  className?: string;
}) {
  const theme = getJourneyStageTheme(stage);
  const Icon = STAGE_ICON[stage];
  const style = {
    "--journey-stage-accent": theme.accent,
    "--journey-stage-accent-soft": theme.accentSoft,
    "--journey-stage-foreground": theme.foreground,
    "--journey-stage-fallback": theme.fallbackBackground,
  } as CSSProperties;

  return (
    <section
      className={[styles.hero, className].filter(Boolean).join(" ")}
      data-journey-stage={stage}
      style={style}
    >
      <Image
        className={styles.background}
        src={theme.backgroundImage}
        alt=""
        aria-hidden="true"
        fill
        priority
        sizes="(min-width: 1280px) 1120px, (min-width: 768px) 92vw, 100vw"
      />
      <div className={styles.content}>
        <div className={styles.stageMeta}>
          <span className={styles.stageLabel}>
            <Icon size={15} aria-hidden="true" />
            {theme.label}
          </span>
          {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
        </div>
        <h1>{title}</h1>
        <p>{description}</p>
        {children ? <div className={styles.actions}>{children}</div> : null}
      </div>
    </section>
  );
}
