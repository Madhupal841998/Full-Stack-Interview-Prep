import { useMemo } from 'react';
import { FileText, SearchX } from 'lucide-react';
import type { DocMeta } from '@/types/study';

interface SearchPanelProps {
  query: string;
  manifest: DocMeta[];
  texts: Record<string, string>;
  onOpen: (file: string) => void;
  onClose: () => void;
}

interface Hit {
  meta: DocMeta;
  snippets: { heading: string; excerpt: string }[];
  count: number;
}

const MAX_HITS = 60;

export default function SearchPanel({ query, manifest, texts, onOpen, onClose }: SearchPanelProps) {
  const q = query.trim().toLowerCase();
  const hits = useMemo<Hit[]>(() => {
    if (q.length < 2) return [];
    const out: Hit[] = [];
    for (const meta of manifest) {
      const text = texts[meta.file];
      if (!text) continue;
      const lines = text.split('\n');
      let heading = meta.title;
      const snippets: Hit['snippets'] = [];
      let count = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const hm = line.match(/^#{1,4}\s+(.+)$/);
        if (hm) heading = hm[1].replace(/[*_`]/g, '');
        if (line.toLowerCase().includes(q)) {
          count++;
          if (snippets.length < 3) {
            const clean = line.trim().slice(0, 160);
            snippets.push({ heading, excerpt: clean });
          }
        }
      }
      if (count > 0) out.push({ meta, snippets, count });
      if (out.length >= MAX_HITS) break;
    }
    return out;
  }, [q, manifest, texts]);

  if (q.length < 2) return null;

  return (
    <div className="absolute inset-y-0 left-72 right-0 z-20 overflow-y-auto bg-background p-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Search results for “{query.trim()}”
            {hits.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {hits.length} document{hits.length === 1 ? '' : 's'}
              </span>
            )}
          </h2>
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
            Close
          </button>
        </div>
        {hits.length === 0 ? (
          <div className="mt-12 flex flex-col items-center gap-3 text-muted-foreground">
            <SearchX className="h-10 w-10" />
            <p>No matches found. Try a different keyword.</p>
          </div>
        ) : (
          <div className="mt-4 divide-y rounded-lg border bg-card">
            {hits.map((h) => (
              <button
                key={h.meta.file}
                onClick={() => onOpen(h.meta.file)}
                className="block w-full px-4 py-3 text-left hover:bg-accent"
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{h.meta.title}</span>
                  <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {h.count} match{h.count === 1 ? '' : 'es'}
                  </span>
                </div>
                <div className="mt-1.5 space-y-1 pl-6">
                  {h.snippets.map((s, i) => (
                    <p key={i} className="truncate text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/70">{s.heading}:</span>{' '}
                      {s.excerpt}
                    </p>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
