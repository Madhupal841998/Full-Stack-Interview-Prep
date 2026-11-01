import { useMemo } from 'react';
import { BookOpen, CheckCircle2, Clock, PlayCircle } from 'lucide-react';
import type { DocMeta, ProgressMap } from '@/types/study';
import { groupDocs, phaseLabel } from '@/lib/groups';
import { getProgress, readingMinutes, formatBytes } from '@/lib/store';

interface DashboardProps {
  manifest: DocMeta[];
  progress: ProgressMap;
  onOpen: (file: string) => void;
}

export default function Dashboard({ manifest, progress, onOpen }: DashboardProps) {
  const groups = useMemo(() => groupDocs(manifest), [manifest]);

  const total = manifest.length;
  const done = manifest.filter((m) => getProgress(progress, m.file).done).length;
  const totalWords = manifest.reduce((a, m) => a + m.words, 0);
  const lastVisited = manifest
    .map((m) => ({ m, p: getProgress(progress, m.file) }))
    .filter((x) => x.p.visitedAt > 0)
    .sort((a, b) => b.p.visitedAt - a.p.visitedAt)
    .slice(0, 5);
  const nextUp = manifest.find((m) => !getProgress(progress, m.file).done);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-bold">Backend Engineering — Zero to Expert</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {total} documents · {readingMinutes(totalWords)} min of reading ·{' '}
        {formatBytes(manifest.reduce((a, m) => a + m.size, 0))} of study material
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<BookOpen className="h-5 w-5" />}
          label="Documents"
          value={`${done} / ${total} complete`}
          pct={total ? Math.round((done / total) * 100) : 0}
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="Total reading time"
          value={`${readingMinutes(totalWords)} min`}
          pct={null}
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Progress"
          value={`${total ? Math.round((done / total) * 100) : 0}%`}
          pct={total ? Math.round((done / total) * 100) : 0}
        />
      </div>

      {nextUp && (
        <button
          onClick={() => onOpen(nextUp.file)}
          className="mt-6 flex w-full items-center gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent"
        >
          <PlayCircle className="h-8 w-8 shrink-0 text-primary" />
          <span>
            <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Continue with
            </span>
            <span className="block font-medium">{nextUp.title}</span>
            <span className="block text-xs text-muted-foreground">
              {phaseLabel(nextUp)} · {readingMinutes(nextUp.words)} min read
            </span>
          </span>
        </button>
      )}

      {lastVisited.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Recently studied
          </h2>
          <div className="mt-2 divide-y rounded-lg border bg-card">
            {lastVisited.map(({ m, p }) => (
              <button
                key={m.file}
                onClick={() => onOpen(m.file)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-accent"
              >
                <span className="truncate">{m.title}</span>
                <span className="ml-4 flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  {p.done && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                  {new Date(p.visitedAt).toLocaleDateString()}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Learning tracks
        </h2>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {groups.map((g) => {
            const gd = g.docs.filter((d) => getProgress(progress, d.file).done).length;
            return (
              <div key={g.name} className="rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{g.name}</h3>
                  <span className="text-xs text-muted-foreground">
                    {gd}/{g.docs.length}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{g.blurb}</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${g.docs.length ? (gd / g.docs.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  pct,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  pct: number | null;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-2 text-lg font-bold">{value}</p>
      {pct !== null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}
