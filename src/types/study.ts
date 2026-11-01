export interface DocMeta {
  id: number;
  file: string;
  title: string;
  phase: number; // -1 = roadmap
  words: number;
  size: number;
}

export interface DocProgress {
  done: boolean;
  scroll: number;
  visitedAt: number;
}

export type ProgressMap = Record<string, DocProgress>;
