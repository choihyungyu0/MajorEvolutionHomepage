"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Bookmark, CircleAlert, Copy, LoaderCircle, Shuffle } from "lucide-react";
import {
  AppShell,
  Card,
  ChoiceChip,
  PageHeader,
  PrimaryButton,
  SectionHeading,
  Tag,
} from "@/components/app/primitives";
import { SceneBanner } from "@/components/app/scene-banner";
import { PaperReadingSteps } from "@/components/paper-reader/paper-reading-steps";
import { brandScene } from "@/lib/brand-assets";
import { EMAIL_FROM_FIRST_QUESTION_HREF } from "@/lib/email-draft-purpose";
import { canSaveFirstLine } from "@/lib/quest-input-validation";
import {
  buildFirstLine,
  PURPOSES,
  SITUATIONS,
  TONES,
  type FirstLinePurpose,
  type FirstLineSituation,
  type FirstLineTone,
} from "@/lib/first-line";
import { evidencePhrase, useQuestContext } from "@/lib/quest-context";
import { useQuestStore } from "@/store/quest-store";
import { useResearchStore } from "@/store/research-store";

/**
 * Q-02 첫마디 랜덤박스.
 *
 * 상황·목적·말투·연결 근거를 받아 바로 쓸 첫 문장 하나를 만듭니다.
 * 학생이 직접 고치고 복사합니다. 앱이 대신 보내지 않습니다.
 */
export function FirstLineScreen({ fromPaper = false }: { fromPaper?: boolean }) {
  const router = useRouter();
  const hasHydrated = useResearchStore((state) => state.hasHydrated);
  const selectedProfessorPaper = useResearchStore((state) => state.selectedProfessorPaper);
  const { topic, match } = useQuestContext();
  const saveCard = useQuestStore((state) => state.saveCard);

  const [situation, setSituation] = useState<FirstLineSituation>("after-class");
  const [purpose, setPurpose] = useState<FirstLinePurpose>(
    () => fromPaper ? "research-interest" : "career",
  );
  const [tone, setTone] = useState<FirstLineTone>("calm");
  const [evidence, setEvidence] = useState("");
  const [shuffle, setShuffle] = useState(0);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("");
  const [prefilled, setPrefilled] = useState(false);

  // 찾다에서 확인한 근거를 한 번만 채워 둡니다. 이후에는 학생 입력이 우선입니다.
  useEffect(() => {
    if (!hasHydrated || prefilled) return;
    const selectedPaperContext = fromPaper
      && selectedProfessorPaper
      && selectedProfessorPaper.professorId === match?.professor.id
      ? `「${selectedProfessorPaper.title}」`
      : "";
    const phrase = selectedPaperContext || evidencePhrase(match) || topic?.question || topic?.title || "";
    if (phrase) setEvidence(phrase);
    setPrefilled(true);
  }, [fromPaper, hasHydrated, prefilled, match, selectedProfessorPaper, topic]);

  const sentence = useMemo(
    () => buildFirstLine({ situation, purpose, tone, evidence, shuffle }),
    [situation, purpose, tone, evidence, shuffle],
  );

  useEffect(() => {
    setDraft(sentence?.text ?? "");
  }, [sentence]);

  if (!hasHydrated) {
    return (
      <div className="research-loading">
        <LoaderCircle className="spin" />
        <p>저장된 준비 상태를 불러오고 있어요.</p>
      </div>
    );
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("첫 문장을 복사했어요. 보내기 전에 직접 읽어 보세요.");
    } catch {
      setStatus("자동 복사에 실패했어요. 문장을 직접 선택해 복사해 주세요.");
    }
  };

  const save = (text: string, purposeLabel: string, continueToEmail = false) => {
    if (!canSaveFirstLine(text)) {
      setStatus("비어 있는 문장은 저장할 수 없어요. 한 문장 이상 적어 주세요.");
      return;
    }
    saveCard({
      tool: "first-line",
      title: `${SITUATIONS.find((s) => s.id === situation)?.label} · ${purposeLabel} · ${TONES.find((item) => item.id === tone)?.label}`,
      body: text,
      evidence: { label: evidence.trim(), page: null, href: null },
      professorId: match?.professor.id ?? null,
      topicId: topic?.id ?? null,
    });
    if (continueToEmail) {
      router.push(fromPaper ? `${EMAIL_FROM_FIRST_QUESTION_HREF}&journey=paper` : EMAIL_FROM_FIRST_QUESTION_HREF);
      return;
    }
    setStatus("대화 시작 카드로 저장했어요. 퀘스트 허브에서 다시 볼 수 있어요.");
  };

  return (
    <AppShell
      title="첫마디 랜덤박스"
      backHref={fromPaper ? "/paper/reader?mode=bite&source=favorites&step=card" : "/quest"}
      className="first-line-screen"
    >
      {fromPaper ? <PaperReadingSteps current={4} /> : null}
      <SceneBanner
        className="scene-banner--compact"
        scene={brandScene.firstLine}
        alt="수업이 끝난 뒤 교수님께 첫마디를 건네는 장면"
        eyebrow="교수님, 말 걸어도 돼요?"
        title="첫마디 랜덤박스"
        description="상황과 목적, 말투를 고르면 바로 쓸 첫 문장 하나를 만듭니다."
        priority
      />

      <SectionHeading title="어떤 상황인가요?" />
      <div className="filter-scroll">
        {SITUATIONS.map((item) => (
          <ChoiceChip key={item.id} selected={situation === item.id} onClick={() => setSituation(item.id)}>
            {item.label}
          </ChoiceChip>
        ))}
      </div>
      <p className="first-line-hint">{SITUATIONS.find((s) => s.id === situation)?.hint}</p>

      <SectionHeading title="무엇을 묻고 싶나요?" />
      <div className="filter-scroll first-line-purpose-options">
        {PURPOSES.map((item) => (
          <ChoiceChip key={item.id} selected={purpose === item.id} onClick={() => setPurpose(item.id)}>
            {item.label}
          </ChoiceChip>
        ))}
      </div>

      <Card className="first-line-evidence">
        <label>
          <span>질문을 구체화할 맥락</span>
          <input
            type="text"
            value={evidence}
            placeholder="예) 진로 고민 · 수업 내용 · 논문 제목 · 내 프로젝트"
            onChange={(event) => setEvidence(event.target.value)}
          />
        </label>
        <p>진로 고민, 수업 내용, 읽은 자료, 내 프로젝트 중 지금 이야기할 맥락을 적어 주세요.</p>
      </Card>

      <SectionHeading title="어떤 말투로 시작할까요?" />
      <div className="filter-scroll first-line-purpose-options" role="group" aria-label="첫 문장 말투">
        {TONES.map((item) => (
          <ChoiceChip key={item.id} selected={tone === item.id} onClick={() => setTone(item.id)}>
            {item.label}
          </ChoiceChip>
        ))}
      </div>
      <p className="first-line-hint">{TONES.find((item) => item.id === tone)?.hint}</p>

      {!sentence ? (
        <Card className="official-professor-empty">
          <CircleAlert size={26} />
          <h2>연결 근거를 먼저 적어 주세요</h2>
          <p>읽은 자료나 교수님의 연구분야를 적고 첫 문장을 준비해 보세요.</p>
          {!match && (
            <PrimaryButton onClick={() => router.push("/professors")}>
              나의 교수님 — 찾다에서 근거 확인
            </PrimaryButton>
          )}
        </Card>
      ) : (
        <>
          <SectionHeading
            title="바로 쓸 첫 문장"
            action={(
              <button type="button" className="first-line-shuffle" onClick={() => setShuffle((n) => n + 1)}>
                <Shuffle size={15} /> 같은 말투로 다시 섞기
              </button>
            )}
          />
          <div className="first-line-list">
            <article key={sentence.id} className="first-line-card">
              <header>
                <Tag tone="violet">{sentence.purposeLabel}</Tag>
                <Tag tone="mint">{sentence.toneLabel}</Tag>
              </header>
              <textarea
                value={draft}
                rows={4}
                aria-label="첫 문장"
                onChange={(event) => setDraft(event.target.value)}
              />
              <div className="first-line-card__actions">
                <button type="button" onClick={() => void copy(draft)}>
                  <Copy size={15} /> 복사
                </button>
                <button type="button" disabled={!canSaveFirstLine(draft)} onClick={() => save(draft, sentence.purposeLabel)}>
                  <Bookmark size={15} /> 대화 시작 카드 저장
                </button>
                <button type="button" disabled={!canSaveFirstLine(draft)} onClick={() => save(draft, sentence.purposeLabel, true)}>
                  이 질문으로 이메일 이어쓰기 <ArrowRight size={15} />
                </button>
              </div>
            </article>
          </div>
        </>
      )}

      {status && <p className="first-line-status" role="status">{status}</p>}
      <p className="prof-scope-note">실제 연락과 면담은 학생이 직접 진행합니다.</p>
    </AppShell>
  );
}
