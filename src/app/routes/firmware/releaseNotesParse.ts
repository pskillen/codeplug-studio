/**
 * Pure parser for the bundled release notes (Studio copies). Supports paragraphs, `- ` bullet lists, `**bold**` and
 * `` `code` ``; everything else is plain text.
 */
export type ReleaseNotesInline =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'bold'; readonly text: string }
  | { readonly kind: 'code'; readonly text: string };

export type ReleaseNotesBlock =
  | { readonly kind: 'paragraph'; readonly inlines: readonly ReleaseNotesInline[] }
  | { readonly kind: 'list'; readonly items: readonly (readonly ReleaseNotesInline[])[] };

/** `**bold**` and `` `code` ``; unmatched markers stay as text. */
export function parseReleaseNotesInline(text: string): ReleaseNotesInline[] {
  const out: ReleaseNotesInline[] = [];
  const pattern = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ kind: 'text', text: text.slice(last, at) });
    if (m[1] !== undefined) out.push({ kind: 'bold', text: m[1] });
    else out.push({ kind: 'code', text: m[2]! });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
  return out;
}

/** Pure: notes text → blocks. Blank lines separate blocks; indented lines continue the previous list item. */
export function parseReleaseNotes(text: string): ReleaseNotesBlock[] {
  const blocks: ReleaseNotesBlock[] = [];
  let paragraph: string[] | null = null;
  let list: string[] | null = null;

  const flush = () => {
    if (paragraph) {
      blocks.push({ kind: 'paragraph', inlines: parseReleaseNotesInline(paragraph.join(' ')) });
    }
    if (list) {
      blocks.push({ kind: 'list', items: list.map((item) => parseReleaseNotesInline(item)) });
    }
    paragraph = null;
    list = null;
  };

  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    if (line.trim() === '') {
      flush();
      continue;
    }
    const bullet = /^\s*- (.*)$/.exec(line);
    if (bullet) {
      if (paragraph) flush();
      list ??= [];
      list.push(bullet[1]!.trim());
      continue;
    }
    const current: string[] | null = list;
    if (current && /^\s+/.test(line)) {
      current[current.length - 1] = `${current[current.length - 1]} ${line.trim()}`;
      continue;
    }
    if (list) flush();
    paragraph ??= [];
    paragraph.push(line.trim());
  }
  flush();
  return blocks;
}
