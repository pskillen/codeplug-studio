/**
 * Step 1: what to write (#1393). One tick per part; options only under ticked parts; rows a radio
 * does not support are not shown. Primary button: Connect & read.
 */

import { Link } from 'react-router-dom';
import { Anchor, Switch, Text } from '@mantine/core';
import type { DigitalContactsWriteSource } from '@core/domain/digitalIdDirectoryProjection.ts';
import KepsLastUpdated from '../../../library/KepsLastUpdated.tsx';
import { Button, FormField, SegmentedControl } from '../../../v2/index.ts';
import WritePartRow from '../WritePartRow.tsx';
import classes from '../RadioWriteStepper.module.css';
import type { WriteFlowActions, WriteFlowView, WriteStepperConfig } from '../types.ts';
import { changesLabel } from '../../../../lib/atD890RadioSettingsText.ts';
import { tickedPartCount } from '../writeParts.ts';

const CONTACT_SOURCE_OPTIONS: {
  value: Exclude<DigitalContactsWriteSource, 'none'>;
  label: string;
}[] = [
  { value: 'library', label: 'Contacts' },
  { value: 'directory', label: 'ID directory' },
  { value: 'both', label: 'Both' },
];

/** AT-D890: contacts ride with the codeplug; the part fills the ID database. */
const AT_D890_CONTACTS_HINT =
  "Contacts always go to the radio's Contacts list with the codeplug, after talk groups, so channels and RX group lists can call them. This part writes the radio's ID database, which names incoming calls: your contacts, the ID directory, or both. ID directory rows for a DMR ID that is already a contact are skipped, so the radio shows your name for it. Unticked leaves the ID database as it is. Without Codeplug, the AT-D890UV still re-sends the codeplug image.";

interface StepProps {
  config: WriteStepperConfig;
  view: WriteFlowView;
  actions: WriteFlowActions;
}

export function WhatToWriteBody({ config, view, actions }: StepProps) {
  const { parts } = view;
  const { support } = config;
  const set = (patch: Partial<typeof parts>) => actions.onPartsChange({ ...parts, ...patch });

  return (
    <div className={classes.stack}>
      <div>
        <WritePartRow
          title="Codeplug"
          summary={
            config.codeplugSummary ??
            'Channels, zones, scan lists and the other modelled lists from this build'
          }
          checked={parts.codeplug}
          onCheckedChange={(codeplug) => set({ codeplug })}
        >
          {config.channelLocationNote ? (
            <Text size="xs" c="dimmed" data-testid="write-radio-channel-location-note">
              {config.channelLocationNote}
            </Text>
          ) : null}
          {config.stepKeys ? (
            <Switch
              label="Assign TG previous and TG next"
              description={`${config.stepKeys.description} Saved with this build.`.trim()}
              checked={config.stepKeys.checked}
              onChange={(event) => config.stepKeys?.onChange(event.currentTarget.checked)}
            />
          ) : null}
        </WritePartRow>

        {support.settings && config.radioSettings ? (
          <WritePartRow
            title="Radio settings"
            summary={
              <span data-testid="write-radio-settings-summary">
                {config.radioSettings.count > 0
                  ? changesLabel(config.radioSettings.count)
                  : 'No changes set'}{' '}
                ·{' '}
                <Anchor component="button" type="button" size="xs" onClick={actions.onEditSettings}>
                  {config.radioSettings.count > 0 ? 'Edit' : 'Set up…'}
                </Anchor>
              </span>
            }
            checked={parts.settings && config.radioSettings.count > 0}
            disabled={config.radioSettings.count === 0}
            onCheckedChange={(settings) => set({ settings })}
          >
            <Text size="xs" c="dimmed" data-testid="write-radio-settings-words">
              {config.radioSettings.words.join(' · ')}
            </Text>
          </WritePartRow>
        ) : null}

        {support.contacts ? (
          <WritePartRow
            title="Digital contacts"
            summary="Replaces the radio's contact list"
            checked={parts.contacts}
            onCheckedChange={(contacts) => set({ contacts })}
          >
            <FormField
              label="Contact source"
              hint={
                config.sharedContactBankNote
                  ? 'Talk groups and contacts use the 1024-slot DMR contact bank. ID directory writes the firmware User Database for incoming-call lookup. ID directory does not fill the 1024 contact bank; ID directory alone leaves prior FLASH contacts. Contacts or Both replaces talk groups and contacts in that bank.'
                  : config.sharedAddressBookNote
                    ? 'Contacts and the ID directory share one address book. ID directory or Both replaces that book. Duplicate DMR IDs: contacts win. Operator radio IDs come from channel DMR IDs when the codeplug is written; contacts alone do not rewrite them.'
                    : config.separateLookupDatabaseNote
                      ? AT_D890_CONTACTS_HINT
                      : 'Contacts are the ones you curate and call. The ID directory is bulk lookup-only data. Both: contacts win on duplicate DMR ID.'
              }
            >
              <SegmentedControl
                size="sm"
                value={view.contactSource}
                onChange={actions.onContactSourceChange}
                aria-label="Contact source"
                options={CONTACT_SOURCE_OPTIONS}
              />
            </FormField>
          </WritePartRow>
        ) : null}

        {support.keps ? (
          <WritePartRow
            title="Satellite keps"
            summary={
              <>
                {config.kepsSummary ? <span>{config.kepsSummary} · </span> : null}
                <Anchor component={Link} to={`/builds/${config.buildId}/satellite-keps`} size="xs">
                  Preview on the Satellite keps tab
                </Anchor>
              </>
            }
            checked={parts.keps}
            onCheckedChange={(keps) => set({ keps })}
          >
            <Text size="xs" c="dimmed" component="div">
              Writes enabled library satellites only.{' '}
              <KepsLastUpdated
                iso={config.kepsLastUpdatedIso}
                libraryHref="/library/satellite-keps"
              />
            </Text>
          </WritePartRow>
        ) : null}
      </div>
      <Text size="sm" c="dimmed">
        Anything not ticked stays as it is on the radio.
      </Text>
    </div>
  );
}

export function WhatToWriteFooter({ config, view, actions }: StepProps) {
  const disabled =
    !config.serialOk || config.writeHidden || tickedPartCount(view.parts) === 0 || view.busy;
  return (
    <>
      <Button variant="secondary" size="sm" onClick={actions.onClose}>
        Cancel
      </Button>
      <Button variant="primary" size="sm" disabled={disabled} onClick={actions.onConnectAndRead}>
        Connect &amp; read
      </Button>
    </>
  );
}
