/**
 * Safe renderer for the bundled release notes (Studio copies). Supports paragraphs, `- ` bullet lists, `**bold**`
 * and `` `code` ``; everything else is plain text. No HTML passthrough, no links, no raw HTML injection.
 */
import type { ReactNode } from 'react';

import classes from './ReleaseNotes.module.css';
import { parseReleaseNotes, type ReleaseNotesInline } from './releaseNotesParse.ts';

function renderInlines(inlines: readonly ReleaseNotesInline[]): ReactNode[] {
  return inlines.map((inline, i) => {
    switch (inline.kind) {
      case 'bold':
        return <strong key={i}>{inline.text}</strong>;
      case 'code':
        return (
          <code key={i} className={classes.code}>
            {inline.text}
          </code>
        );
      case 'text':
        return <span key={i}>{inline.text}</span>;
    }
  });
}

export default function ReleaseNotes({ text }: { text: string }) {
  const blocks = parseReleaseNotes(text);
  return (
    <div className={classes.root}>
      {blocks.map((block, i) =>
        block.kind === 'paragraph' ? (
          <p key={i} className={classes.paragraph}>
            {renderInlines(block.inlines)}
          </p>
        ) : (
          <ul key={i} className={classes.list}>
            {block.items.map((item, j) => (
              <li key={j}>{renderInlines(item)}</li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}
