import { useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, ListTree } from 'lucide-react';
import type { DocMeta, ProgressMap } from '@/types/study';
import { extractToc, renderMarkdown } from '@/lib/markdown';
import { getProgress, readingMinutes } from '@/lib/store';
import { phaseLabel } from '@/lib/groups';

interface ReaderProps {
  meta: DocMeta;
  text: string;
  progress: ProgressMap;
  prev: DocMeta | null;
  next: DocMeta | null;
  onOpen: (file: string) => void;
  onToggleDone: (file: string) => void;
}

export default function Reader({ meta, text, progress, prev, next, onOpen, onToggleDone }: ReaderProps) {
  const html = useMemo(() => renderMarkdown(text), [text]);
  const toc = useMemo(() => extractToc(text).slice(0, 80), [text]);
  const done = getProgress(progress, meta.file).done;
  const scrollBox = useRef<HTMLDivElement>(null);

  // scroll to top on doc change
  useEffect(() => {
    scrollBox.current?.scrollTo({ top: 0 });
  }, [meta.file]);

  return (
    <div className="flex h-full min-h-0 flex-1">
      <div ref={scrollBox} className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span>{phaseLabel(meta)}</span>
            <span>·</span>
            <span>{readingMinutes(meta.words)} min read</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold leading-tight">{meta.title}</h1>
          <div className="mt-4 border-b pb-4">
            <button
              onClick={() => onToggleDone(meta.file)}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors ${
                done
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'hover:bg-accent'
              }`}
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
              {done ? 'Marked as studied' : 'Mark as studied'}
            </button>
          </div>
          <article
            className="md-body mt-6"
            dangerouslySetInnerHTML={{ __html: html }}
          />
          <div className="mt-10 flex items-center justify-between gap-4 border-t pt-6 text-sm">
            {prev ? (
              <button onClick={() => onOpen(prev.file)} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
                <span className="max-w-[180px] truncate">{prev.title}</span>
              </button>
            ) : (
              <span />
            )}
            {next ? (
              <button onClick={() => onOpen(next.file)} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                <span className="max-w-[180px] truncate">{next.title}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <span />
            )}
          </div>
        </div>
      </div>

      {toc.length > 2 && (
        <div className="hidden w-64 shrink-0 overflow-y-auto border-l p-4 lg:block">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <ListTree className="h-4 w-4" /> On this page
          </div>
          <ul className="mt-3 space-y-1">
            {toc.map((t) => (
              <li key={t.id}>
                <a
                  href={`#/doc/${encodeURIComponent(meta.file)}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document
                      .getElementById(t.id)
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className={`block truncate rounded px-2 py-1 text-xs hover:bg-accent ${
                    t.level === 1
                      ? 'font-semibold'
                      : t.level === 2
                        ? 'pl-4'
                        : 'pl-6 text-muted-foreground'
                  }`}
                >
                  {t.text}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
