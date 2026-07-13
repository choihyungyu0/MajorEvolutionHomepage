export type AiCoachTask = "simplify-trend" | "major-focus" | "interview-question" | "idea-summary";

export type AiCoachRequest = {
  task: AiCoachTask;
  context: Record<string, unknown>;
};

export type AiCoachResult = {
  content: string;
  generatedAt: string;
  model: string;
};

