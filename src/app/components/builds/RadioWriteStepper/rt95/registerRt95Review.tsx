/**
 * Registers RT95 Review sections with `reviewSectionsFor`. Import for the side effect; the stepper
 * does. Settings sections appear whenever overrides are in play; MM9PDY mod-data is separate.
 */

import { RT95_MODEL_ID } from '@integrations/radio-io/radios/rt95/constants.ts';
import { registerReviewSectionProvider } from '../reviewSections.tsx';
import { rt95ReviewSections } from './Rt95ReviewSections.tsx';

registerReviewSectionProvider({
  matches: (d) => d.modelIds.includes(RT95_MODEL_ID),
  sections: rt95ReviewSections,
});
