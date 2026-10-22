import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ReleaseNotes from './ReleaseNotes.tsx';
import { parseReleaseNotes } from './releaseNotesParse.ts';

const releasesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../core/firmware/releases',
);

describe('ReleaseNotes', () => {
  it.each(['baofeng-dm32uv', 'anytone-at-d890uv'])('renders the shipped %s notes', (radio) => {
    const text = readFileSync(join(releasesDir, radio, '1.0.0.release-notes.md'), 'utf8');
    const { container } = render(<ReleaseNotes text={text} />);
    expect(container.querySelector('ul')).not.toBeNull();
    expect(screen.getByText("What's in it").tagName).toBe('STRONG');
  });

  it('parses paragraphs, bullets with continuation lines, bold and code', () => {
    const blocks = parseReleaseNotes(
      'Intro line\nstill intro.\n\n**Head**\n\n- one `x`\n  continued\n- two\n\nTail',
    );
    expect(blocks).toEqual([
      { kind: 'paragraph', inlines: [{ kind: 'text', text: 'Intro line still intro.' }] },
      { kind: 'paragraph', inlines: [{ kind: 'bold', text: 'Head' }] },
      {
        kind: 'list',
        items: [
          [
            { kind: 'text', text: 'one ' },
            { kind: 'code', text: 'x' },
            { kind: 'text', text: ' continued' },
          ],
          [{ kind: 'text', text: 'two' }],
        ],
      },
      { kind: 'paragraph', inlines: [{ kind: 'text', text: 'Tail' }] },
    ]);
  });

  it('renders HTML as text', () => {
    const { container } = render(
      <ReleaseNotes text={'<script>alert(1)</script> and <b>x</b> [link](https://e.invalid)'} />,
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('<script>alert(1)</script>');
  });
});
