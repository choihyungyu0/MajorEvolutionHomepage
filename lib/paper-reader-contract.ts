export const PAPER_READER_SCHEMA_VERSION = "1.0" as const;

export const PAPER_READER_CAPABILITIES = [
  {
    id: "original",
    label: "원문",
    description: "PDF 페이지와 문단 위치를 유지해 원문을 확인합니다.",
  },
  {
    id: "translation",
    label: "전체 번역",
    description: "페이지 또는 절 단위로 한국어 번역을 이어서 읽습니다.",
  },
  {
    id: "summary",
    label: "쉬운 요약",
    description: "배경·질문·방법·결과·한계를 같은 순서로 정리합니다.",
  },
  {
    id: "qa",
    label: "질의응답",
    description: "답변마다 근거가 된 페이지와 문단을 함께 표시합니다.",
  },
  {
    id: "figure",
    label: "그림 해설",
    description: "선택한 표와 그림의 축·범례·핵심 메시지를 설명합니다.",
  },
] as const;

export type PaperReaderCapabilityId = (typeof PAPER_READER_CAPABILITIES)[number]["id"];

export type PaperReaderSource = {
  paperId: string;
  title: string;
  authors: string[];
  publishedYear?: number;
  professorId?: string;
  professorName?: string;
  doi?: string;
  officialSourceUrl?: string;
};

export type PaperReaderCitation = {
  page: number;
  section?: string;
  quote?: string;
};

export type PaperReaderInsight = {
  schemaVersion: typeof PAPER_READER_SCHEMA_VERSION;
  paper: PaperReaderSource;
  summary: {
    oneLine: string;
    background: string;
    researchQuestion: string;
    methods: string[];
    findings: string[];
    limitations: string[];
  };
  professorBrief: {
    relevanceNote: string;
    keywords: string[];
    meetingQuestions: string[];
  };
  citations: PaperReaderCitation[];
  generatedAt: string;
};

export type PaperReaderModuleProps = {
  source?: PaperReaderSource;
  onInsightSave?: (insight: PaperReaderInsight) => void | Promise<void>;
  onClose?: () => void;
};
