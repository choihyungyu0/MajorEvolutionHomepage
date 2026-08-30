"use client";

import { ResearchTutorialScreen } from "@/components/tutorial/research-tutorial-screen";
import styles from "./home-dashboard.module.css";

type ProjectQuickStartPanelProps = {
  onClose: () => void;
};

export function ProjectQuickStartPanel({ onClose }: ProjectQuickStartPanelProps) {
  return (
    <section className={styles.quickInlinePanel} aria-label="프로젝트 빠른 시작">
      <ResearchTutorialScreen presentation="embedded" onRequestClose={onClose} />
    </section>
  );
}
