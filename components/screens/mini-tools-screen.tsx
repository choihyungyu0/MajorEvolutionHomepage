"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  Copy,
  Grid3x3,
  Heart,
  Languages,
  LoaderCircle,
  Shuffle,
  Sparkles,
} from "lucide-react";
import {
  AppShell,
  Card,
  PageHeader,
  SectionHeading,
  Tag,
} from "@/components/app/primitives";
import { questIcon } from "@/lib/brand-assets";
import { buildFirstLines, PURPOSES } from "@/lib/first-line";
import {
  canSaveMiniBingo,
  canSaveMiniGlossary,
  canSaveMiniReaction,
} from "@/lib/quest-input-validation";
import { evidencePhrase, useQuestContext } from "@/lib/quest-context";
import { useQuestStore } from "@/store/quest-store";
import { useResearchStore } from "@/store/research-store";

/**
 * F26 교수님과 친해지기 미니도구.
 *
 * 교수님과의 대화를 자연스럽게 준비하는 가벼운 도구 묶음입니다.
 * 기능명세의 다섯 도구(퀘스트 허브)와는 별개로, 목업의 네 가지를 그대로 둡니다.
 */

type ToolId = "reaction" | "glossary" | "bingo" | "shuffle";

const TOOLS: Array<{ id: ToolId; name: string; description: string; icon: typeof Heart }> = [
  { id: "reaction", name: "논문 한 줄 리액션", description: "논문의 핵심이나 인상 깊은 부분을 한 줄로 정리해요.", icon: Heart },
  { id: "glossary", name: "교수님 용어 번역 카드", description: "논문 속 낯선 용어를 쉽게 이해하고 메모해요.", icon: Languages },
  { id: "bingo", name: "연구 키워드 빙고", description: "연구 주제와 관련된 키워드를 정리하고 연결해요.", icon: Grid3x3 },
  { id: "shuffle", name: "첫 질문 셔플", description: "자연스러운 첫 질문을 만들고 다듬어 보세요.", icon: Sparkles },
];

export function MiniToolsScreen() {
  const router = useRouter();
  const hasHydrated = useResearchStore((state) => state.hasHydrated);
  const { topic, match } = useQuestContext();
  const saveCard = useQuestStore((state) => state.saveCard);

  const [activeTool, setActiveTool] = useState<ToolId>("shuffle");
  const [shuffle, setShuffle] = useState(0);
  const [reaction, setReaction] = useState("");
  const [term, setTerm] = useState("");
  const [termMeaning, setTermMeaning] = useState("");
  const [keyword, setKeyword] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [status, setStatus] = useState("");

  const evidence = evidencePhrase(match);
  const canSaveReaction = canSaveMiniReaction(reaction);
  const canSaveGlossary = canSaveMiniGlossary(term, termMeaning);
  const canSaveBingo = canSaveMiniBingo(keywords);

  /** 셔플은 대표 목적을 하나씩 돌려 문장마다 서로 다른 대화 방향을 제안합니다. */
  const questions = useMemo(() => {
    if (!evidence) return [];
    return PURPOSES.map((purpose, index) => {
      const [first] = buildFirstLines({
        situation: "office-hour",
        purpose: purpose.id,
        evidence,
        shuffle: shuffle + index,
      });
      return first ? { ...first, tag: purpose.label } : null;
    }).filter(Boolean) as Array<{ id: string; text: string; tag: string }>;
  }, [evidence, shuffle]);

  if (!hasHydrated) {
    return (
      <div className="research-loading">
        <LoaderCircle className="spin" />
        <p>미니도구를 준비하고 있어요.</p>
      </div>
    );
  }

  const save = (tool: Parameters<typeof saveCard>[0]["tool"], title: string, body: string) => {
    if (!body.trim()) return;
    saveCard({
      tool,
      title,
      body: body.trim(),
      evidence: evidence ? { label: evidence, page: null, href: null } : null,
      professorId: match?.professor.id ?? null,
      topicId: topic?.id ?? null,
    });
    setStatus("저장한 카드에 담았어요. 퀘스트 허브에서 다시 볼 수 있어요.");
  };

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(questions.map((q, i) => `${i + 1}. ${q.text}`).join("\n\n"));
      setStatus(`목적별 첫 질문 ${questions.length}개를 복사했어요.`);
    } catch {
      setStatus("자동 복사에 실패했어요. 문장을 직접 선택해 복사해 주세요.");
    }
  };

  return (
    <AppShell title="미니도구" backHref="/quest" className="mini-tools-screen">
      <PageHeader
        eyebrow="교수님, 말 걸어도 돼요?"
        title="교수님과 친해지기 미니도구"
        description="진로·연구·프로젝트·멘토링 상황에 맞춰 첫 질문을 준비해요."
      />

      <div className="mini-grid" id="all-tools">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              type="button"
              className={tool.id === activeTool ? "mini-card is-active" : "mini-card"}
              aria-pressed={tool.id === activeTool}
              onClick={() => setActiveTool(tool.id)}
            >
              <span className="mini-card__icon"><Icon size={20} aria-hidden="true" /></span>
              <strong>{tool.name}</strong>
              <p>{tool.description}</p>
              <span className="mini-card__cta">시작하기 <ArrowRight size={14} /></span>
            </button>
          );
        })}
      </div>

      {activeTool === "shuffle" && (
        <Card className="mini-panel" id="shuffle">
          <header>
            <h2><Sparkles size={17} aria-hidden="true" /> 첫 질문 셔플</h2>
            <Image src={questIcon.firstLine} alt="" aria-hidden="true" width={34} height={34} unoptimized />
          </header>
          {questions.length === 0 ? (
            <p className="mini-panel__empty">
              연결 근거가 없어 질문을 만들지 않았어요. 찾다에서 교수님을 먼저 연결하거나,
              첫마디 랜덤박스에서 읽은 논문을 직접 적어 주세요.
            </p>
          ) : (
            <>
              <ol className="mini-questions">
                {questions.map((q, index) => (
                  <li key={q.id}>
                    <span className="mini-questions__no">{index + 1}</span>
                    <div>
                      <p>{q.text}</p>
                      <Tag tone="violet">{q.tag}</Tag>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mini-panel__actions">
                <button type="button" onClick={() => setShuffle((n) => n + 1)}>
                  <Shuffle size={15} /> 다시 섞기
                </button>
                <button type="button" onClick={() => void copyAll()}>
                  <Copy size={15} /> 복사
                </button>
                <button
                  type="button"
                  className="is-primary"
                  onClick={() => save("first-line", "첫 질문 셔플", questions.map((q, i) => `${i + 1}. ${q.text}`).join("\n"))}
                >
                  <Bookmark size={15} /> 대화 시작 카드 저장
                </button>
              </div>
            </>
          )}
        </Card>
      )}

      {activeTool === "reaction" && (
        <Card className="mini-panel">
          <header><h2><Heart size={17} aria-hidden="true" /> 논문 한 줄 리액션</h2></header>
          <label className="mini-field">
            <span>읽고 남은 한 줄</span>
            <textarea
              rows={3}
              value={reaction}
              placeholder="예) 조직 학습을 매개로 본다는 점이 가장 인상 깊었어요."
              onChange={(event) => setReaction(event.target.value)}
            />
          </label>
          <div className="mini-panel__actions">
            <button type="button" className="is-primary" disabled={!canSaveReaction} onClick={() => save("paper-bite", "논문 한 줄 리액션", reaction)}>
              <Bookmark size={15} /> 카드 저장
            </button>
          </div>
        </Card>
      )}

      {activeTool === "glossary" && (
        <Card className="mini-panel">
          <header><h2><Languages size={17} aria-hidden="true" /> 교수님 용어 번역 카드</h2></header>
          <div className="mini-two">
            <label className="mini-field">
              <span>낯선 용어</span>
              <input type="text" value={term} placeholder="예) Knowledge integration" onChange={(e) => setTerm(e.target.value)} />
            </label>
            <label className="mini-field">
              <span>내 말로 옮기면</span>
              <input type="text" value={termMeaning} placeholder="예) 흩어진 지식을 하나로 모으는 과정" onChange={(e) => setTermMeaning(e.target.value)} />
            </label>
          </div>
          <p className="mini-panel__note">뜻을 추정해 채우지 않습니다. 원문에서 확인한 내용만 적어 주세요.</p>
          <div className="mini-panel__actions">
            <button
              type="button"
              className="is-primary"
              disabled={!canSaveGlossary}
              onClick={() => save("paper-bite", `용어: ${term}`, termMeaning)}
            >
              <Bookmark size={15} /> 카드 저장
            </button>
          </div>
        </Card>
      )}

      {activeTool === "bingo" && (
        <Card className="mini-panel">
          <header><h2><Grid3x3 size={17} aria-hidden="true" /> 연구 키워드 빙고</h2></header>
          <label className="mini-field">
            <span>키워드 추가</span>
            <div className="mini-inline">
              <input
                type="text"
                value={keyword}
                placeholder="예) 조직 학습"
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && keyword.trim() && keywords.length < 9) {
                    e.preventDefault();
                    setKeywords((k) => [...k, keyword.trim()]);
                    setKeyword("");
                  }
                }}
              />
              <button
                type="button"
                disabled={!keyword.trim() || keywords.length >= 9}
                onClick={() => { setKeywords((k) => [...k, keyword.trim()]); setKeyword(""); }}
              >
                추가
              </button>
            </div>
          </label>
          <div className="mini-bingo" role="list" aria-label="연구 키워드 빙고 9칸">
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} role="listitem" className={keywords[i] ? "is-filled" : undefined}>
                {keywords[i] ?? ""}
              </span>
            ))}
          </div>
          <div className="mini-panel__actions">
            <button type="button" onClick={() => setKeywords([])}>비우기</button>
            <button
              type="button"
              className="is-primary"
              disabled={!canSaveBingo}
              onClick={() => save("paper-bite", "연구 키워드", keywords.join(" · "))}
            >
              <Bookmark size={15} /> 카드 저장
            </button>
          </div>
        </Card>
      )}

      {status && <p className="first-line-status" role="status">{status}</p>}

      <SectionHeading title="더 준비하기" />
      <button type="button" className="official-courses-link" onClick={() => router.push("/quest")}>
        <Sparkles size={18} aria-hidden="true" />
        <div>
          <strong>교수님 퀘스트로 돌아가기</strong>
          <p>논문 한입·침묵 구조대·메일 점검·다음 만남 씨앗</p>
        </div>
        <ArrowRight size={16} aria-hidden="true" />
      </button>
      <p className="prof-scope-note">실제 연락과 면담은 학생이 직접 진행합니다.</p>
    </AppShell>
  );
}
