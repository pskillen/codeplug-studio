/**
 * Read-only view of Web Serial radio-clone hydration on the Direct radio egress.
 * Sibling to NeonPlug settings — unmodelled retain for write-back, not library fields.
 */

import { Link, Navigate } from 'react-router-dom';
import { List, Stack, Table, Text } from '@mantine/core';
import {
  isRadioCloneHydrationBag,
  type RadioCloneHydrationBag,
} from '@core/models/radioCloneHydration.ts';
import {
  summariseUv5rMiniClone,
  UV5R_MINI_MODEL_ID,
  type Uv5rMiniCloneSummary,
} from '@integrations/radio-io/radios/uv5r-mini/index.ts';
import {
  summariseDm32uvClone,
  DM32UV_MODEL_ID,
  type Dm32uvCloneSummary,
} from '@integrations/radio-io/radios/dm32uv/index.ts';
import {
  summariseOpenGd77Clone,
  OPENGD77_DM1701_MODEL_ID,
  type OpenGd77CloneSummary,
} from '@integrations/radio-io/radios/opengd77/index.ts';
import { findEgressByFormatId } from '../../lib/buildEgressUi.ts';
import { FormPage, FormSection } from '../../components/ui/index.ts';
import { useBuildLayout } from './BuildLayoutContext.tsx';

function hexOffset(n: number): string {
  return `0x${n.toString(16).toUpperCase()}`;
}

function Dm32OnRadioSection({ summary }: { summary: Dm32uvCloneSummary }) {
  const c = summary.onRadioCounts;
  return (
    <FormSection
      title="On the radio"
      description="Counts decoded from the stored image — not your build layout."
    >
      <Table.ScrollContainer minWidth={360}>
        <Table withTableBorder withColumnBorders>
          <Table.Tbody>
            <Table.Tr>
              <Table.Td fw={600}>Channels</Table.Td>
              <Table.Td>
                {c.occupiedChannels} occupied · {c.emptyChannelSlots} empty slots
              </Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td fw={600}>Zones</Table.Td>
              <Table.Td>{c.zoneCount}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td fw={600}>Scan lists</Table.Td>
              <Table.Td>{c.scanListCount}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td fw={600}>Talk groups</Table.Td>
              <Table.Td>{c.talkGroupCount}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td fw={600}>RX group lists</Table.Td>
              <Table.Td>{c.rxGroupCount}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td fw={600}>Operator radio IDs</Table.Td>
              <Table.Td>{c.radioIdCount}</Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </FormSection>
  );
}

function Dm32WrittenFromBuildSection({ summary }: { summary: Dm32uvCloneSummary }) {
  return (
    <FormSection
      title="Written from your build"
      description="When you Write to radio, Studio updates these from your build."
    >
      <List size="sm" spacing="xs">
        {summary.writtenFromBuild.map((item) => (
          <List.Item key={item}>{item}</List.Item>
        ))}
      </List>
      {summary.analogContactsWriteGap ? (
        <Text size="sm" c="dimmed" mt="sm">
          {summary.analogContactsWriteGap}
        </Text>
      ) : null}
    </FormSection>
  );
}

function Dm32KeptOnWriteSection({ summary }: { summary: Dm32uvCloneSummary }) {
  return (
    <FormSection
      title="Kept on Write"
      description="Everything below stays as it was on Read from radio — Studio does not change it when you write from your build."
    >
      {summary.retainGroups.length === 0 ? (
        <Text size="sm" c="dimmed">
          No retained regions identified in the stored image.
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={360}>
          <Table withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Region</Table.Th>
                <Table.Th>Regions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {summary.retainGroups.map((group) => (
                <Table.Tr key={group.label}>
                  <Table.Td>{group.label}</Table.Td>
                  <Table.Td>{group.blockCount}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </FormSection>
  );
}

function Dm32SettingsRetainSection({ summary }: { summary: Dm32uvCloneSummary }) {
  return (
    <FormSection title="Radio settings">
      {summary.settingsRetain.length === 0 ? (
        <Text size="sm" c="dimmed">
          No general radio settings block in the stored image (APRS settings are written from your
          build separately).
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={360}>
          <Table withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Setting</Table.Th>
                <Table.Th>Value</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {summary.settingsRetain.map((row) => (
                <Table.Tr key={row.label}>
                  <Table.Td>{row.label}</Table.Td>
                  <Table.Td>{row.value}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </FormSection>
  );
}

function Dm32AncillaryRetainSection({ summary }: { summary: Dm32uvCloneSummary }) {
  const a = summary.ancillaryRetain;
  return (
    <FormSection title="Other retained features">
      <Table.ScrollContainer minWidth={360}>
        <Table withTableBorder withColumnBorders>
          <Table.Tbody>
            <Table.Tr>
              <Table.Td fw={600}>Quick text messages</Table.Td>
              <Table.Td>{a.quickMessageCount}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td fw={600}>Digital emergencies</Table.Td>
              <Table.Td>{a.digitalEmergencyCount}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td fw={600}>Analog emergencies</Table.Td>
              <Table.Td>{a.analogEmergencyCount}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td fw={600}>Encryption keys</Table.Td>
              <Table.Td>
                {a.encryptionKeyCount === 0
                  ? 'None'
                  : `${a.encryptionKeyCount} key${a.encryptionKeyCount === 1 ? '' : 's'} present`}
              </Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td fw={600}>Operator radio IDs</Table.Td>
              <Table.Td>{a.radioIdCount}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td fw={600}>Calibration data</Table.Td>
              <Table.Td>{a.hasCalibration ? 'Present' : 'None'}</Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </FormSection>
  );
}

function Dm32RequiredBlocksSection({ summary }: { summary: Dm32uvCloneSummary }) {
  const missing = summary.requiredBlocks.filter((b) => !b.present);
  return (
    <FormSection
      title="Required regions"
      description={
        missing.length === 0
          ? 'All expected regions were captured on Read from radio.'
          : 'Some expected regions were not captured — Write may be limited until you read again.'
      }
    >
      <Table.ScrollContainer minWidth={360}>
        <Table withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Region</Table.Th>
              <Table.Th>Captured</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {summary.requiredBlocks.map((row) => (
              <Table.Tr key={row.label}>
                <Table.Td>{row.label}</Table.Td>
                <Table.Td>{row.present ? 'Yes' : 'No'}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </FormSection>
  );
}

function Uv5rOnRadioSection({ summary }: { summary: Uv5rMiniCloneSummary }) {
  const c = summary.onRadioCounts;
  return (
    <FormSection
      title="On the radio"
      description="Counts decoded from the stored image — not your build layout."
    >
      <Table.ScrollContainer minWidth={360}>
        <Table withTableBorder withColumnBorders>
          <Table.Tbody>
            <Table.Tr>
              <Table.Td fw={600}>Channels</Table.Td>
              <Table.Td>
                {c.occupiedChannels} occupied · {c.emptyChannelSlots} empty slots
              </Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </FormSection>
  );
}

function Uv5rWrittenFromBuildSection({ summary }: { summary: Uv5rMiniCloneSummary }) {
  return (
    <FormSection
      title="Written from your build"
      description="When you Write to radio, Studio updates these from your build."
    >
      <List size="sm" spacing="xs">
        {summary.writtenFromBuild.map((item) => (
          <List.Item key={item}>{item}</List.Item>
        ))}
      </List>
    </FormSection>
  );
}

function Uv5rKeptOnWriteSection({ summary }: { summary: Uv5rMiniCloneSummary }) {
  return (
    <FormSection
      title="Kept on Write"
      description="Everything below stays as it was on Read from radio — Studio does not change it when you write from your build."
    >
      {summary.retainGroups.length === 0 ? (
        <Text size="sm" c="dimmed">
          No retained regions identified in the stored image.
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={360}>
          <Table withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Region</Table.Th>
                <Table.Th>Regions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {summary.retainGroups.map((group) => (
                <Table.Tr key={group.label}>
                  <Table.Td>{group.label}</Table.Td>
                  <Table.Td>{group.regionCount}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </FormSection>
  );
}

function Uv5rSettingsRetainSection({ summary }: { summary: Uv5rMiniCloneSummary }) {
  return (
    <FormSection title="Radio settings">
      {summary.settingsRetain.length === 0 ? (
        <Text size="sm" c="dimmed">
          No radio settings block in the stored image.
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={360}>
          <Table withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Setting</Table.Th>
                <Table.Th>Value</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {summary.settingsRetain.map((row) => (
                <Table.Tr key={row.label}>
                  <Table.Td>{row.label}</Table.Td>
                  <Table.Td>{row.value}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </FormSection>
  );
}

function Uv5rAncillaryRetainSection({ summary }: { summary: Uv5rMiniCloneSummary }) {
  return (
    <FormSection title="Other retained features">
      <Table.ScrollContainer minWidth={360}>
        <Table withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Feature</Table.Th>
              <Table.Th>Value</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {summary.ancillaryRetain.rows.map((row) => (
              <Table.Tr key={row.label}>
                <Table.Td>{row.label}</Table.Td>
                <Table.Td>{row.value}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </FormSection>
  );
}

function Uv5rRadioImageSections({
  summary,
  bag,
}: {
  summary: Uv5rMiniCloneSummary;
  bag: RadioCloneHydrationBag;
}) {
  return (
    <>
      <FormSection title="Capture">
        <Table.ScrollContainer minWidth={360}>
          <Table withTableBorder withColumnBorders>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td fw={600}>Source</Table.Td>
                <Table.Td>{bag.sourceFileName ?? '—'}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={600}>Captured</Table.Td>
                <Table.Td>{new Date(bag.capturedAt).toLocaleString()}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={600}>Via</Table.Td>
                <Table.Td>{summary.capturedVia}</Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </FormSection>

      <FormSection title="Radio info">
        <Table.ScrollContainer minWidth={360}>
          <Table withTableBorder withColumnBorders>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td fw={600}>Model</Table.Td>
                <Table.Td>{summary.radioModelId}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={600}>Firmware</Table.Td>
                <Table.Td>{summary.firmware?.trim() || '—'}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={600}>Image size</Table.Td>
                <Table.Td>
                  {summary.imageByteLength} bytes ({hexOffset(summary.imageByteLength)})
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </FormSection>

      <Uv5rOnRadioSection summary={summary} />
      <Uv5rWrittenFromBuildSection summary={summary} />
      <Uv5rKeptOnWriteSection summary={summary} />
      <Uv5rSettingsRetainSection summary={summary} />
      <Uv5rAncillaryRetainSection summary={summary} />
    </>
  );
}

function OpenGd77OnRadioSection({ summary }: { summary: OpenGd77CloneSummary }) {
  const c = summary.onRadioCounts;
  return (
    <FormSection
      title="On the radio"
      description="Counts decoded from the stored image — not your build layout."
    >
      <Table.ScrollContainer minWidth={360}>
        <Table withTableBorder withColumnBorders>
          <Table.Tbody>
            <Table.Tr>
              <Table.Td fw={600}>Channels</Table.Td>
              <Table.Td>
                {c.occupiedChannels} occupied · {c.emptyChannelSlots} empty slots
              </Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td fw={600}>Zones</Table.Td>
              <Table.Td>{c.zoneCount}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td fw={600}>DMR contacts</Table.Td>
              <Table.Td>{c.contactCount}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td fw={600}>RX group lists</Table.Td>
              <Table.Td>{c.rxGroupCount}</Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </FormSection>
  );
}

function OpenGd77WrittenFromBuildSection({ summary }: { summary: OpenGd77CloneSummary }) {
  return (
    <FormSection
      title="Written from your build"
      description="When you Write to radio, Studio updates these from your build."
    >
      <List size="sm" spacing="xs">
        {summary.writtenFromBuild.map((item) => (
          <List.Item key={item}>{item}</List.Item>
        ))}
      </List>
      <Text size="sm" c="dimmed" mt="sm">
        {summary.dtmfContactsWriteGap}
      </Text>
      <Text size="sm" c="dimmed" mt="xs">
        {summary.aprsWriteGap}
      </Text>
    </FormSection>
  );
}

function OpenGd77KeptOnWriteSection({ summary }: { summary: OpenGd77CloneSummary }) {
  return (
    <FormSection
      title="Kept on Write"
      description="Everything below stays as it was on Read from radio — Studio does not change it when you write from your build."
    >
      {summary.retainGroups.length === 0 ? (
        <Text size="sm" c="dimmed">
          No retained regions identified in the stored image.
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={360}>
          <Table withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Region</Table.Th>
                <Table.Th>Regions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {summary.retainGroups.map((group) => (
                <Table.Tr key={group.label}>
                  <Table.Td>{group.label}</Table.Td>
                  <Table.Td>{group.regionCount}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </FormSection>
  );
}

function OpenGd77SettingsRetainSection({ summary }: { summary: OpenGd77CloneSummary }) {
  return (
    <FormSection title="Radio settings">
      {summary.settingsRetain.length === 0 ? (
        <Text size="sm" c="dimmed">
          No decoded general settings in the stored image.
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={360}>
          <Table withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Setting</Table.Th>
                <Table.Th>Value</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {summary.settingsRetain.map((row) => (
                <Table.Tr key={row.label}>
                  <Table.Td>{row.label}</Table.Td>
                  <Table.Td>{row.value}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </FormSection>
  );
}

function OpenGd77AncillaryRetainSection({ summary }: { summary: OpenGd77CloneSummary }) {
  return (
    <FormSection title="Other retained features">
      <Table.ScrollContainer minWidth={360}>
        <Table withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Feature</Table.Th>
              <Table.Th>Value</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {summary.ancillaryRetain.rows.map((row) => (
              <Table.Tr key={row.label}>
                <Table.Td>{row.label}</Table.Td>
                <Table.Td>{row.value}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </FormSection>
  );
}

function OpenGd77RadioImageSections({
  summary,
  bag,
}: {
  summary: OpenGd77CloneSummary;
  bag: RadioCloneHydrationBag;
}) {
  return (
    <>
      <FormSection title="Capture">
        <Table.ScrollContainer minWidth={360}>
          <Table withTableBorder withColumnBorders>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td fw={600}>Source</Table.Td>
                <Table.Td>{bag.sourceFileName ?? '—'}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={600}>Captured</Table.Td>
                <Table.Td>{new Date(bag.capturedAt).toLocaleString()}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={600}>Via</Table.Td>
                <Table.Td>{summary.capturedVia}</Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </FormSection>

      <FormSection title="Radio info">
        <Table.ScrollContainer minWidth={360}>
          <Table withTableBorder withColumnBorders>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td fw={600}>Model</Table.Td>
                <Table.Td>{summary.radioModelId}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={600}>Firmware</Table.Td>
                <Table.Td>{summary.firmware?.trim() || '—'}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={600}>Image size</Table.Td>
                <Table.Td>
                  {summary.imageByteLength} bytes ({hexOffset(summary.imageByteLength)})
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </FormSection>

      <OpenGd77OnRadioSection summary={summary} />
      <OpenGd77WrittenFromBuildSection summary={summary} />
      <OpenGd77KeptOnWriteSection summary={summary} />
      <OpenGd77SettingsRetainSection summary={summary} />
      <OpenGd77AncillaryRetainSection summary={summary} />
    </>
  );
}

function Dm32RadioImageSections({
  summary,
  bag,
}: {
  summary: Dm32uvCloneSummary;
  bag: RadioCloneHydrationBag;
}) {
  return (
    <>
      <FormSection title="Capture">
        <Table.ScrollContainer minWidth={360}>
          <Table withTableBorder withColumnBorders>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td fw={600}>Source</Table.Td>
                <Table.Td>{bag.sourceFileName ?? '—'}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={600}>Captured</Table.Td>
                <Table.Td>{new Date(bag.capturedAt).toLocaleString()}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={600}>Via</Table.Td>
                <Table.Td>{summary.capturedVia}</Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </FormSection>

      <FormSection title="Radio info">
        <Table.ScrollContainer minWidth={360}>
          <Table withTableBorder withColumnBorders>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td fw={600}>Model</Table.Td>
                <Table.Td>{summary.radioModelId}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={600}>Firmware</Table.Td>
                <Table.Td>{summary.firmware?.trim() || '—'}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={600}>Image size</Table.Td>
                <Table.Td>
                  {summary.imageByteLength} bytes ({hexOffset(summary.imageByteLength)})
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={600}>Regions captured</Table.Td>
                <Table.Td>{summary.blockCount}</Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </FormSection>

      <Dm32OnRadioSection summary={summary} />
      <Dm32WrittenFromBuildSection summary={summary} />
      <Dm32KeptOnWriteSection summary={summary} />
      <Dm32SettingsRetainSection summary={summary} />
      <Dm32AncillaryRetainSection summary={summary} />
      <Dm32RequiredBlocksSection summary={summary} />
    </>
  );
}

export default function BuildRadioImageSettingsPage() {
  const { build, egressPaths } = useBuildLayout();
  const radioEgress = findEgressByFormatId(egressPaths, 'radio-io');

  if (!radioEgress) {
    return <Navigate to={`/builds/${build.id}/export`} replace />;
  }

  const bag = isRadioCloneHydrationBag(radioEgress.hydration) ? radioEgress.hydration : null;
  const isUv5rMini = bag?.retain.radioModelId === UV5R_MINI_MODEL_ID;
  const isDm32 =
    bag?.retain.radioModelId === DM32UV_MODEL_ID || bag?.retain.radioModelId === 'DP570UV';
  const isOpenGd77 =
    bag?.retain.radioModelId === OPENGD77_DM1701_MODEL_ID ||
    bag?.retain.radioModelId === 'DM-1701' ||
    bag?.retain.radioModelId === 'RT-84';
  const uv5rSummary = bag && isUv5rMini ? summariseUv5rMiniClone(bag) : null;
  const dm32Summary = bag && isDm32 ? summariseDm32uvClone(bag) : null;
  const openGd77Summary = bag && isOpenGd77 ? summariseOpenGd77Clone(bag) : null;

  return (
    <FormPage
      title="Radio image"
      description={
        <Text size="sm" component="span">
          Read-only view of the clone image stored on this build’s Web Serial egress pathway after{' '}
          <Link to={`/builds/${build.id}/export`}>Read from radio</Link>. Available whenever a Read
          has stored an image — the Export pathway switcher need not be on Direct radio.{' '}
          {isDm32
            ? 'Counts show what is on the radio; retained settings are what Studio keeps when you write channels and other build data from your library.'
            : isOpenGd77
              ? 'Counts show what is on the radio; retained settings, VFO, DTMF, and APRS regions are what Studio keeps when you write channels, zones, and contacts from your library.'
              : isUv5rMini
                ? 'Counts show what is on the radio; retained settings are what Studio keeps when you write channels from your library.'
                : 'Unmodelled regions (VFO, settings, ANI) are retained for Write so they survive channel updates from the library. Settings are not editable in Studio.'}
        </Text>
      }
    >
      <Stack gap="lg">
        {!bag ? (
          <FormSection title="No radio image stored">
            <Text size="sm">
              Use <strong>Read from radio</strong> on the{' '}
              <Link to={`/builds/${build.id}/export`}>Export</Link> page to download a clone image
              into this build. Write stays blocked until a Read succeeds.
            </Text>
          </FormSection>
        ) : !uv5rSummary && !dm32Summary && !openGd77Summary ? (
          <FormSection title="Stored image">
            <Text size="sm">
              A radio-clone image is stored (model {bag.retain.radioModelId},{' '}
              {bag.retain.imageByteLength} bytes), but this build profile has no labelled summary
              yet. The opaque image is still used on Write.
            </Text>
          </FormSection>
        ) : dm32Summary && bag ? (
          <Dm32RadioImageSections summary={dm32Summary} bag={bag} />
        ) : openGd77Summary && bag ? (
          <OpenGd77RadioImageSections summary={openGd77Summary} bag={bag} />
        ) : uv5rSummary && bag ? (
          <Uv5rRadioImageSections summary={uv5rSummary} bag={bag} />
        ) : null}
      </Stack>
    </FormPage>
  );
}
