import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: false });

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-') || 'section'
  );
}

export interface TocItem {
  level: number;
  text: string;
  id: string;
}

/** Unique anchor ids for every heading in the document. */
export function headingIds(md: string): Map<string, string> {
  const map = new Map<string, string>();
  const seen = new Map<string, number>();
  for (const line of md.split('\n')) {
    const m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!m) continue;
    const text = m[2].replace(/[*_`]/g, '');
    let id = slugify(text);
    const n = seen.get(id) ?? 0;
    seen.set(id, n + 1);
    if (n > 0) id = `${id}-${n}`;
    map.set(line, id);
  }
  return map;
}

export function extractToc(md: string): TocItem[] {
  const ids = headingIds(md);
  const items: TocItem[] = [];
  for (const line of md.split('\n')) {
    const m = line.match(/^(#{1,3})\s+(.+?)\s*#*\s*$/);
    if (!m) continue;
    const text = m[2].replace(/[*_`]/g, '');
    const id = ids.get(line);
    if (id) items.push({ level: m[1].length, text, id });
  }
  return items;
}

/** Render markdown with unique heading ids injected (source-level transform). */
export function renderMarkdown(md: string): string {
  const ids = headingIds(md);
  const out = md
    .split('\n')
    .map((line) => {
      const id = ids.get(line);
      if (!id) return line;
      return line.replace(/^(#{1,6})\s+/, `$1 <a id="${id}"></a> `);
    })
    .join('\n');
  return marked.parse(out) as string;
}
