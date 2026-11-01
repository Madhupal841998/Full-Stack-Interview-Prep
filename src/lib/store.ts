import type { ProgressMap, DocProgress } from '@/types/study';

const KEY = 'study-progress-v1';

export function loadProgress(): ProgressMap {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ProgressMap) : {};
  } catch {
    return {};
  }
}

export function saveProgress(map: ProgressMap) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // storage full / private mode — ignore
  }
}

export function getProgress(map: ProgressMap, file: string): DocProgress {
  return map[file] ?? { done: false, scroll: 0, visitedAt: 0 };
}

export function readingMinutes(words: number): number {
  return Math.max(1, Math.round(words / 200));
}

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + ' MB';
  return Math.round(n / 1024) + ' KB';
}
