"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck2,
  FileText,
  LoaderCircle,
  MailCheck,
  MessageCircleQuestion,
} from "lucide-react";
import { AppShell } from "@/components/app/primitives";
import { ServiceBottomNav } from "@/components/app/side-nav";
import { buildProfessorConnectionSavedSections } from "@/lib/quest-saved-records";
import { useQuestStore } from "@/store/quest-store";
import { useResearchStore } from "@/store/research-store";
import styles from "./quest-saved-screen.module.css";

const PHASE_ICON = {
  before: MailCheck,
  during: MessageCircleQuestion,
  after: CalendarCheck2,
} as const;

export function QuestSavedScreen() {
  const questHydrated = useQuestStore((state) => state.hasHydrated);
  const researchHydrated = useResearchStore((state) => state.hasHydrated);
  const cards = useQuestStore((state) => state.cards);
  const emailDrafts = useResearchStore((state) => state.knockKitDrafts);
  const mentorEntries = useResearchStore((state) => state.mentorLoopEntries);

  if (!questHydrated || !researchHydrated) {
    return (
      <div className="research-loading">
        <LoaderCircle className="spin" />
        <p>교수 연결 저장 기록을 불러오고 있어요.</p>
      </div>
    );
  }

  const sections = buildProfessorConnectionSavedSections({ cards, emailDrafts, mentorEntries });
  const total = sections.reduce((sum, section) => sum + section.records.length, 0);

  return (
    <AppShell
      title="교수 연결 저장함"
      backHref="/quest"
      className={styles.shell}
      bottomNav={<ServiceBottomNav />}
    >
      <div className={styles.page}>
        <header className={styles.hero}>
          <div className={styles.heroIcon}><FileText size={26} aria-hidden="true" /></div>
          <div>
            <span>교수 연결 · 나의 준비 기록</span>
            <h1>교수님과 만나기 위해 저장한 내용을 모았어요</h1>
            <p>프로젝트 실행용 자문 기록과 분리해, 교수 연결 탭에서 만든 준비만 보여드려요.</p>
          </div>
          <strong>{total}개</strong>
        </header>

        {total === 0 ? (
          <section className={styles.empty} aria-labelledby="saved-empty-title">
            <FileText size={30} aria-hidden="true" />
            <div>
              <h2 id="saved-empty-title">저장한 준비 기록이 아직 없어요</h2>
              <p>논문 카드, 첫 질문, 연락 문장이나 만남 후 기록을 저장하면 단계별로 모여요.</p>
            </div>
            <Link href="/quest/all">준비 도구 살펴보기 <ArrowRight size={16} aria-hidden="true" /></Link>
          </section>
        ) : (
          <div className={styles.sections}>
            {sections.map((section) => {
              const Icon = PHASE_ICON[section.id];
              return (
                <section key={section.id} className={styles.section} aria-labelledby={`saved-${section.id}`}>
                  <header className={styles.sectionHeader}>
                    <div className={styles.phaseIcon}><Icon size={21} aria-hidden="true" /></div>
                    <div>
                      <span>교수 연결 {section.label}</span>
                      <h2 id={`saved-${section.id}`}>{section.label}</h2>
                      <p>{section.description}</p>
                    </div>
                    <strong>{section.records.length}개</strong>
                  </header>

                  {section.records.length > 0 ? (
                    <div className={styles.recordGrid}>
                      {section.records.map((record) => (
                        <article key={record.id} className={styles.record}>
                          <div className={styles.recordMeta}>
                            <span>{record.label}</span>
                            <time dateTime={record.updatedAt}>
                              {record.updatedAt.slice(0, 10).replaceAll("-", ".")}
                            </time>
                          </div>
                          <h3>{record.title}</h3>
                          <p>{record.body}</p>
                          {record.detail ? <small>{record.detail}</small> : null}
                          <Link href={record.href} aria-label={`${record.label} 도구 열기`}>
                            같은 도구 열기 <ArrowRight size={15} aria-hidden="true" />
                          </Link>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.phaseEmpty}>
                      <p>이 단계에서 저장한 기록은 아직 없어요.</p>
                      <Link href="/quest/all">도구 선택하기 <ArrowRight size={15} aria-hidden="true" /></Link>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
