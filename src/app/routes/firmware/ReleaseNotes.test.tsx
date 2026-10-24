import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ReleaseNotes from './ReleaseNotes.tsx';
import { parseReleaseNotes } from './releaseNotesParse.ts';

/** The shape the firmware project's release notes take (pskillen/mm9pdy-firmware `releases/*.md` bodies). */
const SAMPLE_NOTES = `The first full release. It applies to stock **V1.05** only.

**What's in it**

- **Talk-group keys:** step through the RX group list with TG Previous / TG Next. A \`TS1\` or
  \`TS2\` suffix sets the timeslot.
- **Zone scan:** scans the whole zone.

**Checking it worked:** Device Info > Version shows \`1.0.0\`.
`;

describe('ReleaseNotes', () => {
  it('renders release notes as published', () => {
    const { container } = render(<ReleaseNotes text={SAMPLE_NOTES} />);
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
