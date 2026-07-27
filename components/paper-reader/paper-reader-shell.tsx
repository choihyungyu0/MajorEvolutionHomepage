"use client";

import {
  BookOpen,
  BookText,
  BotMessageSquare,
  FileImage,
  Languages,
  LibraryBig,
  Route,
  ShieldCheck,
  Sparkles,
  UserRoundSearch,
} from "lucide-react";
import {
  AppShell,
  Card,
  LinkButton,
  PageHeader,
  SectionHeading,
  StatusBanner,
} from "@/components/app/primitives";
import {
  PAPER_READER_CAPABILITIES,
  type PaperReaderCapabilityId,
} from "@/lib/paper-reader-contract";

const capabilityIcons = {
  original: BookOpen,
  translation: Languages,
  summary: BookText,
  qa: BotMessageSquare,
  figure: FileImage,
} satisfies Record<PaperReaderCapabilityId, typeof BookOpen>;

const serviceSteps = [
  {
    number: "01",
    title: "교수님 찾기",
    description: "전공·관심사와 공식 연구 근거로 만날 교수를 좁힙니다.",
  },
  {
    number: "02",
    title: "논문 이해하기",
    description: "교수님의 논문을 원문·번역·요약·질문·그림으로 읽습니다.",
  },
  {
    number: "03",
    title: "면담 준비하기",
    description: "읽은 근거를 교수님께 물어볼 질문과 Knock Kit로 옮깁니다.",
  },
  {
    number: "04",
    title: "성장 기록하기",
    description: "면담 피드백과 다음 행동을 Mentor Loop에 남깁니다.",
  },
] as const;

export function PaperReaderShell() {
  return (
    <AppShell title="논문 리더" backHref="/paper">
      <PageHeader
        eyebrow="통합 준비 화면"
        title="교수님의 논문을 내 언어로 읽어요"
        description="팀원이 완성할 논문 리더가 전공진화소 안에서 바로 이어지도록 화면과 데이터 경계를 먼저 준비했습니다."
      />

      <StatusBanner icon={Sparkles} title="현재는 통합 셸 단계" tone="lavender">
        PDF 업로드와 AI 분석은 아직 연결하지 않았습니다. 아래 다섯 기능을 담당 모듈로 교체하면 같은
        주소에서 서비스할 수 있습니다.
      </StatusBanner>

      <SectionHeading title="완성될 논문 작업공간" />
      <div className="paper-reader-capabilities">
        {PAPER_READER_CAPABILITIES.map((capability) => {
          const Icon = capabilityIcons[capability.id];
          return (
            <article key={capability.id}>
              <span><Icon size={20} aria-hidden="true" /></span>
              <div>
                <h2>{capability.label}</h2>
                <p>{capability.description}</p>
              </div>
              <small>담당 개발</small>
            </article>
          );
        })}
      </div>

      <SectionHeading title="서비스 안에서 이어지는 방식" />
      <ol className="paper-reader-flow">
        {serviceSteps.map((step) => (
          <li key={step.number}>
            <span>{step.number}</span>
            <div>
              <h2>{step.title}</h2>
              <p>{step.description}</p>
            </div>
          </li>
        ))}
      </ol>

      <Card className="paper-reader-handoff">
        <Route size={24} aria-hidden="true" />
        <div>
          <h2>팀원이 교체할 경계</h2>
          <p>
            이 페이지의 <code>PaperReaderShell</code>을 실제 작업공간으로 교체하고,
            분석 결과는 공통 <code>PaperReaderInsight</code> 형식으로 돌려줍니다.
          </p>
        </div>
      </Card>

      <div className="paper-reader-actions">
        <LinkButton href="/paper"><LibraryBig size={17} /> 현재 텍스트 분석 사용</LinkButton>
        <LinkButton href="/professors" secondary><UserRoundSearch size={17} /> 교수님 먼저 찾기</LinkButton>
      </div>

      <div className="paper-reader-safety">
        <ShieldCheck size={18} aria-hidden="true" />
        <p>미공개 논문과 개인정보가 포함될 수 있으므로 원문 저장·전송·삭제 정책을 구현 전에 확정해야 합니다.</p>
      </div>
    </AppShell>
  );
}
