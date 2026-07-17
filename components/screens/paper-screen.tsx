"use client";

import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  Clipboard,
  Copy,
  FileSearch,
  Lightbulb,
  ListChecks,
  LoaderCircle,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import {
  AppShell,
  Card,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  SectionHeading,
  StatusBanner,
  Tag,
  TextButton,
} from "@/components/app/primitives";
import { requestPaperAnalysis } from "@/lib/ai-client";
import type { PaperAnalysisResult } from "@/lib/paper-analysis";

function numberedItems(items: string[]) {
  return items.map((item, index) => <li key={`${index}-${item}`}><span>{index + 1}</span><p>{item}</p></li>);
}

export function PaperScreen() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [result, setResult] = useState<PaperAnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");

  const analyze = async () => {
    const normalized = content.trim();
    if (normalized.length < 80) {
      setError("논문 초록이나 본문 일부를 80자 이상 입력해 주세요.");
      return;
    }
    setError("");
    setCopyStatus("");
    setIsLoading(true);
    try {
      setResult(await requestPaperAnalysis({ title: title.trim(), content: normalized }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "논문 분석을 완료하지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const copySummary = async () => {
    if (!result) return;
    const summary = [
      result.title,
      result.oneLine,
      `연구 질문: ${result.question}`,
      `방법: ${result.methods.join(" / ")}`,
      `핵심 결과: ${result.findings.join(" / ")}`,
      `한계: ${result.limitations.join(" / ")}`,
    ].join("\n\n");
    try {
      await navigator.clipboard.writeText(summary);
      setCopyStatus("분석 요약을 복사했어요.");
    } catch {
      setCopyStatus("복사하지 못했어요. 브라우저 권한을 확인해 주세요.");
    }
  };

  const reset = () => {
    setTitle("");
    setContent("");
    setResult(null);
    setError("");
    setCopyStatus("");
  };

  if (result) {
    return (
      <AppShell
        title="논문 이해"
        backHref="/goal"
        stickyAction={<><SecondaryButton onClick={reset}><RotateCcw size={17} /> 다른 논문</SecondaryButton><PrimaryButton onClick={copySummary}><Copy size={17} /> 요약 복사</PrimaryButton></>}
      >
        <PageHeader eyebrow="AI 논문 도우미" title={result.title} description={result.oneLine} />
        <StatusBanner icon={CheckCircle2} title="입력한 텍스트 분석 완료" tone="success">초록이나 발췌문만 입력했다면 원문 전체의 결론과 다를 수 있어요.</StatusBanner>

        <SectionHeading title="왜 시작한 연구인가요?" />
        <Card className="paper-summary-card"><BookOpenCheck size={22} /><p>{result.background}</p></Card>

        <SectionHeading title="핵심 연구 질문" />
        <Card className="paper-question-card"><Lightbulb size={22} /><strong>{result.question}</strong></Card>

        <SectionHeading title="연구 방법" />
        <ol className="paper-numbered-list">{numberedItems(result.methods)}</ol>

        <SectionHeading title="핵심 결과" />
        <ol className="paper-numbered-list is-findings">{numberedItems(result.findings)}</ol>

        <SectionHeading title="해석할 때 주의할 점" />
        <div className="paper-limitations">{result.limitations.map((item) => <div key={item}><AlertTriangle size={18} /><p>{item}</p></div>)}</div>

        <SectionHeading title="용어 사전" />
        <dl className="paper-glossary">{result.glossary.map((item) => <div key={item.term}><dt><Tag tone="blue">{item.term}</Tag></dt><dd>{item.meaning}</dd></div>)}</dl>

        <SectionHeading title="다음에 확인할 질문" />
        <Card className="paper-next-questions"><ListChecks size={22} /><ul>{result.nextQuestions.map((item) => <li key={item}>{item}</li>)}</ul></Card>
        {copyStatus && <p className="action-feedback" role="status">{copyStatus}</p>}
      </AppShell>
    );
  }

  return (
    <AppShell title="논문 이해" backHref="/goal">
      <PageHeader eyebrow="AI 논문 도우미" title="어려운 논문을 읽는 순서로 풀어드려요" description="초록이나 본문 일부를 붙여 넣으면 질문·방법·결과·한계를 나눠서 설명합니다." />
      <StatusBanner icon={Sparkles} title="원문을 대신하지 않아요" tone="lavender">AI 요약은 읽기 보조 도구예요. 인용과 최종 판단은 반드시 원문에서 확인해 주세요.</StatusBanner>
      <Card className="paper-input-card">
        <label className="field-group" htmlFor="paper-title"><span className="field-label">논문 제목 <small>선택</small></span><input id="paper-title" className="input" value={title} onChange={(event) => setTitle(event.target.value.slice(0, 180))} placeholder="제목을 입력하면 결과에 반영돼요" /></label>
        <label className="field-group" htmlFor="paper-content"><span className="field-label">초록 또는 본문</span><textarea id="paper-content" className="textarea paper-input" value={content} onChange={(event) => setContent(event.target.value.slice(0, 12_000))} placeholder="분석할 논문 초록이나 본문 일부를 붙여 넣어 주세요." /></label>
        <div className="paper-input-meta"><span className={content.trim().length >= 80 ? "is-ready" : ""}>{content.length.toLocaleString()} / 12,000자</span><small>최소 80자</small></div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <PrimaryButton onClick={analyze} disabled={isLoading || content.trim().length < 80}>{isLoading ? <><LoaderCircle size={18} className="spin" /> 논문을 구조화하는 중</> : <><FileSearch size={18} /> 논문 분석하기</>}</PrimaryButton>
      </Card>
      <div className="paper-privacy"><Clipboard size={17} /><p>입력 내용은 분석 요청을 위해 OpenAI API로 전송되며 이 화면의 결과는 별도로 저장하지 않아요.</p></div>
      {content && !isLoading && <div className="context-actions"><TextButton onClick={reset}><RotateCcw size={16} /> 입력 지우기</TextButton></div>}
    </AppShell>
  );
}

