/**
 * Per-build AT-D890UV radio settings page (#1393): read a radio's general settings, show them next
 * to a Keep / Set control per field. Overrides live in the session store, never in the project.
 */

import {
  isAtD890RadioIoProfileId,
  isMm9pdyAtD890RadioIoProfileId,
} from '@core/import-export/formatProfiles.ts';
import AtD890RadioSettingsEditor from '../../components/builds/AtD890RadioSettingsEditor.tsx';
import { StatusBanner } from '../../components/v2/index.ts';
import { findRadioIoEgress } from '../../lib/buildEgressUi.ts';
import { useBuildLayout } from './BuildLayoutContext.tsx';
import classes from './BuildRadioSettingsPage.module.css';

export const RADIO_SETTINGS_ONLY_D890_MESSAGE =
  'Radio settings are only available for the AT-D890UV.';

export default function BuildRadioSettingsPage() {
  const { buildId, egressPaths } = useBuildLayout();
  const egress = findRadioIoEgress(egressPaths);
  const isD890 = Boolean(egress && isAtD890RadioIoProfileId(egress.profileId));
  const isMm9pdy = Boolean(egress && isMm9pdyAtD890RadioIoProfileId(egress.profileId));

  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <h1 className={classes.title}>
          Radio settings — AT-D890UV{isMm9pdy ? ' (MM9PDY firmware)' : ''}
        </h1>
        <p className={classes.subtitle}>
          Read a radio&apos;s general settings and choose, per setting, to keep what the radio has
          or set a value. Changes live in this browser session only; they are not saved in the
          project.
        </p>
      </div>
      {isD890 && egress ? (
        <AtD890RadioSettingsEditor
          buildId={buildId}
          target={isMm9pdy ? 'mm9pdy' : 'stock'}
          egress={egress}
        />
      ) : (
        <StatusBanner tone="info">{RADIO_SETTINGS_ONLY_D890_MESSAGE}</StatusBanner>
      )}
    </div>
  );
}
