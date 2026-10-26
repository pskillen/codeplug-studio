/** MM9PDY TG step-key switch: which targets offer it, and what each one does. */

const D890_MM9PDY = 'anytone-at-d890uv-mm9pdy';
const DM32_MM9PDY = 'baofeng-dm32uv-mm9pdy';

export function isMm9pdyStepKeyTarget(radioTargetId: string | undefined): boolean {
  return radioTargetId === D890_MM9PDY || radioTargetId === DM32_MM9PDY;
}

/**
 * Targets that keep the persisted step-key switch (Export settings and the Write dialog): the
 * DM-32UV MM9PDY target, which has no radio settings page. On the AT-D890UV MM9PDY target the
 * switch is gone (#1393); the Review step offers a nudge that sets ordinary session overrides.
 */
export function hasPersistedStepKeySwitch(radioTargetId: string | undefined): boolean {
  return radioTargetId === DM32_MM9PDY;
}

export function mm9pdyStepKeysDescription(radioTargetId: string | undefined): string {
  if (radioTargetId === DM32_MM9PDY) {
    return "P1 short becomes TG previous and P2 short becomes TG next. Official CPS shows these as Previous Record and Next Record. The radio's own key menu shows TG Prev and TG Next.";
  }
  return "P1 short becomes TG next and P2 short becomes TG previous. Official CPS shows these as item 15 Record and item 14 Record Switch. The radio's own key menu shows the MM9PDY names.";
}
