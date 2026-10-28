/**
 * Registers the RT95 MM9PDY Review sections with `reviewSectionsFor`. Import for the side effect;
 * the stepper does. Nothing shows for the stock RT95 target (its context carries no `rt95`).
 */

import { Text } from '@mantine/core';
import { RT95_MODEL_ID } from '@integrations/radio-io/radios/rt95/constants.ts';
import { registerReviewSectionProvider } from '../reviewSections.tsx';
import { Section } from '../reviewSectionParts.tsx';

registerReviewSectionProvider({
  matches: (d) => d.modelIds.includes(RT95_MODEL_ID),
  sections: (ctx) =>
    ctx.rt95
      ? [
          <Section key="rt95-mmd1" title="Zones and descriptions">
            <Text size="sm">Radio memory: 32 KiB, zones and descriptions can be written.</Text>
            <Text size="sm">
              {ctx.rt95.zones === 1 ? '1 zone' : `${ctx.rt95.zones} zones`} and{' '}
              {ctx.rt95.descriptions === 1
                ? '1 channel description'
                : `${ctx.rt95.descriptions} channel descriptions`}{' '}
              will be written.
            </Text>
          </Section>,
        ]
      : [],
});
