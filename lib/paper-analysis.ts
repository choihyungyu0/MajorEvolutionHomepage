export type PaperGlossaryItem = {
  term: string;
  meaning: string;
};

export type PaperAnalysisResult = {
  title: string;
  oneLine: string;
  background: string;
  question: string;
  methods: string[];
  findings: string[];
  limitations: string[];
  glossary: PaperGlossaryItem[];
  nextQuestions: string[];
  generatedAt: string;
  model: string;
};

export type PaperAnalysisRequest = {
  title: string;
  content: string;
};

