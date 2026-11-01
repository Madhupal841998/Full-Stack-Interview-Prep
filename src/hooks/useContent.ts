import { useEffect, useState } from 'react';
import type { DocMeta } from '@/types/study';

export interface ContentState {
  manifest: DocMeta[];
  texts: Record<string, string>;
  loading: boolean;
  error: string | null;
}

export function useContent(): ContentState {
  const [state, setState] = useState<ContentState>({
    manifest: [],
    texts: {},
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('content/manifest.json');
        if (!res.ok) throw new Error('manifest not found');
        const manifest = (await res.json()) as DocMeta[];
        const texts: Record<string, string> = {};
        await Promise.all(
          manifest.map(async (m) => {
            const r = await fetch(`content/${encodeURIComponent(m.file)}`);
            if (r.ok) texts[m.file] = await r.text();
          })
        );
        if (!cancelled) setState({ manifest, texts, loading: false, error: null });
      } catch (e) {
        if (!cancelled)
          setState((s) => ({ ...s, loading: false, error: String(e) }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
