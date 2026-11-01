import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Dashboard from '@/components/Dashboard';
import Reader from '@/components/Reader';
import SearchPanel from '@/components/SearchPanel';
import { useContent } from '@/hooks/useContent';
import { loadProgress, saveProgress, getProgress } from '@/lib/store';

function parseHash(): { file: string | null } {
  const m = location.hash.match(/^#\/doc\/(.+)$/);
  return { file: m ? decodeURIComponent(m[1]) : null };
}

export default function App() {
  const { manifest, texts, loading, error } = useContent();
  const [progress, setProgress] = useState(() => loadProgress());
  const [route, setRoute] = useState(parseHash);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const open = useCallback((file: string) => {
    location.hash = `#/doc/${encodeURIComponent(file)}`;
    setQuery('');
    setProgress((p) => {
      const next = {
        ...p,
        [file]: { ...getProgress(p, file), visitedAt: Date.now() },
      };
      saveProgress(next);
      return next;
    });
  }, []);

  const toggleDone = useCallback((file: string) => {
    setProgress((p) => {
      const cur = getProgress(p, file);
      const next = {
        ...p,
        [file]: { ...cur, done: !cur.done, visitedAt: Date.now() },
      };
      saveProgress(next);
      return next;
    });
  }, []);

  const current = route.file;
  const currentMeta = useMemo(
    () => manifest.find((m) => m.file === current) ?? null,
    [manifest, current]
  );
  const idx = currentMeta ? manifest.indexOf(currentMeta) : -1;
  const prev = idx > 0 ? manifest[idx - 1] : null;
  const next = idx >= 0 && idx < manifest.length - 1 ? manifest[idx + 1] : null;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading study material…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Failed to load content: {error}
      </div>
    );
  }

  const searching = query.trim().length >= 2;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        manifest={manifest}
        progress={progress}
        current={currentMeta?.file ?? null}
        onOpen={open}
        query={query}
        onQuery={setQuery}
      />
      <main className="relative min-w-0 flex-1 overflow-hidden">
        {searching ? (
          <SearchPanel
            query={query}
            manifest={manifest}
            texts={texts}
            onOpen={open}
            onClose={() => setQuery('')}
          />
        ) : currentMeta ? (
          <Reader
            key={currentMeta.file}
            meta={currentMeta}
            text={texts[currentMeta.file] ?? ''}
            progress={progress}
            prev={prev}
            next={next}
            onOpen={open}
            onToggleDone={toggleDone}
          />
        ) : (
          <div className="h-full overflow-y-auto">
            <Dashboard manifest={manifest} progress={progress} onOpen={open} />
          </div>
        )}
      </main>
    </div>
  );
}
