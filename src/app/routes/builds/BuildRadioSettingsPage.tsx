/**
 * Per-build radio settings page (#1393, #1476): read a radio's general settings and choose Keep / Set
 * per field. Overrides live in the session store, never in the project.
 */

import {
  isAtD890RadioIoProfileId,
  isMm9pdyAtD890RadioIoProfileId,
  isMm9pdyRt95RadioIoProfileId,
  isRt95RadioIoProfileId,
} from '@core/import-export/formatProfiles.ts';
import AtD890RadioSettingsEditor from '../../components/builds/AtD890RadioSettingsEditor.tsx';
import Rt95RadioSettingsEditor from '../../components/builds/Rt95RadioSettingsEditor.tsx';
import { StatusBanner } from '../../components/v2/index.ts';
import { findRadioIoEgress } from '../../lib/buildEgressUi.ts';
import { radioIoProfileSupportsRadioSettings } from '../../lib/radioIoRadioSettingsSupport.ts';
import { listOfferedDangerZoneTools } from '../../services/dangerZone/gate.ts';
import { useBuildLayout } from './BuildLayoutContext.tsx';
import classes from './BuildRadioSettingsPage.module.css';

export const RADIO_SETTINGS_UNSUPPORTED_MESSAGE =
  'Radio settings are only available for the AT-D890UV and RT95 on Web Serial.';

export default function BuildRadioSettingsPage() {
  const { build, buildId, egressPaths } = useBuildLayout();
  const egress = findRadioIoEgress(egressPaths);
  const supported = Boolean(egress && radioIoProfileSupportsRadioSettings(egress.profileId));
  const isD890 = Boolean(egress && isAtD890RadioIoProfileId(egress.profileId));
  const isRt95 = Boolean(egress && isRt95RadioIoProfileId(egress.profileId));
  const isMm9pdyD890 = Boolean(egress && isMm9pdyAtD890RadioIoProfileId(egress.profileId));
  const isMm9pdyRt95 = Boolean(egress && isMm9pdyRt95RadioIoProfileId(egress.profileId));

  const title = isD890
    ? `Radio settings — AT-D890UV${isMm9pdyD890 ? ' (MM9PDY firmware)' : ''}`
    : isRt95
      ? `Radio settings — RT95${isMm9pdyRt95 ? ' (MM9PDY firmware)' : ''}`
      : 'Radio settings';

  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <h1 className={classes.title}>{title}</h1>
        <p className={classes.subtitle}>
          Read a radio&apos;s general settings and choose, per setting, to keep what the radio has
          or set a value. Changes live in this browser session only; they are not saved in the
          project.
        </p>
      </div>
      {supported && egress ? (
        isD890 ? (
          <AtD890RadioSettingsEditor
            buildId={buildId}
            target={isMm9pdyD890 ? 'mm9pdy' : 'stock'}
            egress={egress}
            dangerZoneOffered={listOfferedDangerZoneTools(build.radioTargetId).length > 0}
          />
        ) : (
          <Rt95RadioSettingsEditor buildId={buildId} egress={egress} />
        )
      ) : (
        <StatusBanner tone="info">{RADIO_SETTINGS_UNSUPPORTED_MESSAGE}</StatusBanner>
      )}
    </div>
  );
}
