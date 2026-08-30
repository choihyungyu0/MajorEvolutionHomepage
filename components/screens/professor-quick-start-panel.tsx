"use client";

import { ProfessorTutorialScreen } from "@/components/tutorial/professor-tutorial-screen";
import type { ProfessorAcademicTaxonomy } from "@/lib/professor-academic-taxonomy";
import styles from "./home-dashboard.module.css";

type ProfessorQuickStartPanelProps = {
  taxonomy: ProfessorAcademicTaxonomy;
  onClose: () => void;
};

export function ProfessorQuickStartPanel({
  taxonomy,
  onClose,
}: ProfessorQuickStartPanelProps) {
  return (
    <section className={styles.quickInlinePanel} aria-label="교수 매칭 기본 설정">
      <ProfessorTutorialScreen
        taxonomy={taxonomy}
        presentation="embedded"
        onRequestClose={onClose}
      />
    </section>
  );
}
