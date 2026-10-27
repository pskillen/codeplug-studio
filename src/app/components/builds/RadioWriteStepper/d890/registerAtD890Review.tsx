/**
 * Registers the AT-D890UV Review sections with `reviewSectionsFor` (#1393). Import for the side
 * effect; the stepper does.
 */

import { AT_D890UV_MODEL_IDS } from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import { registerReviewSectionProvider } from '../reviewSections.tsx';
import {
  AtD890MasterIdNote,
  AtD890NxdnOwnIdNote,
  AtD890ReceiveOnlyNote,
  atD890ReviewSections,
} from './AtD890ReviewSections.tsx';

registerReviewSectionProvider({
  matches: (d) => AT_D890UV_MODEL_IDS.some((id) => d.modelIds.includes(id)),
  identityRows: (ctx) => (ctx.atD890 ? [['Frequency range', ctx.atD890.init.range.summary]] : []),
  channelNotes: (ctx) =>
    ctx.atD890
      ? [
          <AtD890ReceiveOnlyNote key="rx-only" controller={ctx.atD890} />,
          <AtD890MasterIdNote key="master-id" controller={ctx.atD890} />,
          <AtD890NxdnOwnIdNote key="nxdn-own-id" controller={ctx.atD890} />,
        ]
      : [],
  sections: atD890ReviewSections,
});
