import type { DocMeta } from '@/types/study';

export interface Group {
  name: string;
  blurb: string;
  docs: DocMeta[];
}

export function groupDocs(manifest: DocMeta[]): Group[] {
  const inRange = (lo: number, hi: number) =>
    manifest.filter((m) => m.phase >= lo && m.phase <= hi);
  const roadmap = manifest.filter((m) => m.phase === -1);
  return [
    {
      name: 'Master Roadmap',
      blurb: 'How the whole program fits together',
      docs: roadmap,
    },
    {
      name: 'Foundations',
      blurb: 'JavaScript, TypeScript, data structures, Node.js, Express',
      docs: inRange(0, 5),
    },
    {
      name: 'Data & Backend Core',
      blurb: 'MySQL, ORMs, auth & security, backend architecture',
      docs: inRange(6, 9),
    },
    {
      name: 'System Design',
      blurb: 'Low-level design, high-level design, API design',
      docs: inRange(10, 12),
    },
    {
      name: 'Production at Scale',
      blurb: 'Errors, caching, jobs, files, distributed systems, testing',
      docs: inRange(13, 20),
    },
    {
      name: 'Career & Mastery',
      blurb: 'Performance, advanced topics, portfolio, interviews',
      docs: inRange(22, 25),
    },
  ].filter((g) => g.docs.length > 0);
}

export function phaseLabel(m: DocMeta): string {
  if (m.phase === -1) return 'ROADMAP';
  return `PHASE ${m.phase}`;
}
