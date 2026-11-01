import { useMemo, useState } from 'react';
import { CheckCircle2, Circle, Search, X } from 'lucide-react';
import type { DocMeta, ProgressMap } from '@/types/study';
import { groupDocs, phaseLabel } from '@/lib/groups';
import { readingMinutes, getProgress } from '@/lib/store';

interface SidebarProps {
  manifest: DocMeta[];
  progress: ProgressMap;
  current: string | null;
  onOpen: (file: string) => void;
  query: string;
  onQuery: (q: string) => void;
}

export default function Sidebar({ manifest, progress, current, onOpen, query, onQuery }: SidebarProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const groups = useMemo(() => groupDocs(manifest), [manifest]);

  const toggle = (name: string) =>
    setCollapsed((c) => ({ ...c, [name]: !c[name] }));

  return (
    <aside className="flex h-full w-72 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="border-b p-4">
        <button
          onClick={() => (location.hash = '#/')}
          className="text-left text-sm font-bold tracking-wide"
        >
          Backend Study Portal
        </button>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Zero to Expert · {manifest.length} documents
        </p>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search all material…"
            className="w-full rounded-md border bg-background py-1.5 pl-8 pr-7 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          {query && (
            <button
              onClick={() => onQuery('')}
              className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {groups.map((g) => {
          const doneCount = g.docs.filter((d) => getProgress(progress, d.file).done).length;
          const isCollapsed = collapsed[g.name] ?? false;
          return (
            <div key={g.name} className="mb-2">
              <button
                onClick={() => toggle(g.name)}
                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                <span>{g.name}</span>
                <span className="flex items-center gap-1.5 normal-case tracking-normal">
                  <span className="text-[10px]">
                    {doneCount}/{g.docs.length}
                  </span>
                  <span className="text-xs">{isCollapsed ? '▸' : '▾'}</span>
                </span>
              </button>
              {!isCollapsed &&
                g.docs.map((d) => {
                  const p = getProgress(progress, d.file);
                  const active = current === d.file;
                  return (
                    <button
                      key={d.file}
                      onClick={() => onOpen(d.file)}
                      className={`group flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${
                        active
                          ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                          : 'hover:bg-sidebar-accent/60'
                      }`}
                    >
                      <span className="mt-0.5 shrink-0">
                        {p.done ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground/40" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate">{d.title}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {phaseLabel(d)} · {readingMinutes(d.words)} min read
                        </span>
                      </span>
                    </button>
                  );
                })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
