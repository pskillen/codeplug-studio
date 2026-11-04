import { describe, expect, it } from 'vitest';
import { emptyLibrary, newTalkGroup } from '@core/domain/factories.ts';
import { modeProfileFacts } from './modeProfileFacts.ts';

const projectId = '11111111-1111-4111-8111-111111111111';

describe('modeProfileFacts', () => {
  it('collapses matching analog tones and hides unset fields', () => {
    const facts = modeProfileFacts(
      { mode: 'fm', rxTone: '110.9', txTone: '110.9', squelch: null, bandwidthKHz: 12.5 },
      emptyLibrary(),
    );
    expect(facts).toEqual([
      { label: 'Tone', value: '110.9', mono: true },
      { label: 'Bandwidth', value: '12.5 kHz' },
    ]);
  });

  it('shows TX before RX when tones differ, and nothing for no tones', () => {
    expect(
      modeProfileFacts(
        { mode: 'fm', rxTone: 'none', txTone: '77.0', squelch: null, bandwidthKHz: null },
        emptyLibrary(),
      ),
    ).toEqual([{ label: 'TX tone', value: '77.0', mono: true }]);
    expect(
      modeProfileFacts(
        { mode: 'fm', rxTone: 'none', txTone: 'none', squelch: null, bandwidthKHz: null },
        emptyLibrary(),
      ),
    ).toEqual([]);
  });

  it('resolves the DMR talk group by id', () => {
    const library = emptyLibrary();
    const tg = newTalkGroup(projectId, 'Scotland', 2355);
    library.talkGroups.push(tg);
    const facts = modeProfileFacts(
      {
        mode: 'dmr',
        colourCode: 1,
        timeslot: 2,
        ownDigitalIdId: null,
        contactRef: { kind: 'talkGroup', id: tg.id },
        rxGroupListId: null,
      },
      library,
    );
    expect(facts).toEqual([
      { label: 'Colour code', value: '1', mono: true },
      { label: 'Timeslot', value: 'TS2' },
      { label: 'Talk group', value: 'Scotland' },
    ]);
  });
});
