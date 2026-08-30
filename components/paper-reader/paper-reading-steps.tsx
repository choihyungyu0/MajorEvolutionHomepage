import Link from "next/link";
import { BookOpenCheck, FileSearch, Mail, MessageCircleQuestion, Upload } from "lucide-react";
import { PAPER_TO_EMAIL_STEPS } from "@/lib/email-draft-purpose";

const STEP_ICONS = [BookOpenCheck, FileSearch, Upload, MessageCircleQuestion, Mail] as const;
const PAPER_READING_STEPS = PAPER_TO_EMAIL_STEPS.map((step, index) => ({
  ...step,
  icon: STEP_ICONS[index],
}));

export function PaperReadingSteps({
  current,
  navigationLocked = false,
}: {
  current: 1 | 2 | 3 | 4 | 5;
  navigationLocked?: boolean;
}) {
  return (
    <nav className="paper-reading-steps" aria-label="논문 활용과 메일 준비 5단계">
      <ol>
        {PAPER_READING_STEPS.map((step) => {
          const Icon = step.icon;
          const state = step.number < current
            ? "complete"
            : step.number === current ? "current" : "upcoming";
          const locked = Boolean(step.href && state !== "current" && navigationLocked);
          const content = (
            <>
              <span className="paper-reading-steps__icon">
                <Icon size={17} aria-hidden="true" />
              </span>
              <span className="paper-reading-steps__copy">
                <small>{step.number}단계</small>
                <strong>{step.label}</strong>
                <em>{locked ? "카드 저장 후 이동" : step.description}</em>
              </span>
            </>
          );
          return (
            <li
              key={step.number}
              className={`is-${state}${locked ? " is-locked" : ""}`}
              aria-current={state === "current" ? "step" : undefined}
            >
              {step.href && state !== "current" ? (
                locked ? (
                  <span className="paper-reading-steps__locked" aria-disabled="true">
                    {content}
                  </span>
                ) : (
                  <Link href={step.href} aria-label={`${step.number}단계 ${step.label}, ${step.description}`}>
                    {content}
                  </Link>
                )
              ) : content}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
