import { describe, expect, it } from 'vitest';
import { OPENGD77_FAMILY_LIMITS } from '@core/radios/opengd77/limits.ts';
import { contactSourceHint } from './contactSourceHint.ts';

describe('contactSourceHint', () => {
  it('names the contact bank size when known', () => {
    const hint = contactSourceHint(
      'shared-contact-bank',
      'OpenGD77',
      OPENGD77_FAMILY_LIMITS.CONTACTS_MAX,
    );
    expect(hint).toContain(`${OPENGD77_FAMILY_LIMITS.CONTACTS_MAX}-slot DMR contact bank`);
  });

  it('uses generic bank wording when the size is unknown', () => {
    const hint = contactSourceHint('shared-contact-bank', 'Some radio');
    expect(hint).toContain("the radio's DMR contact bank");
    expect(hint).not.toMatch(/\d+-slot/);
  });
});
