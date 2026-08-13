/**
 * Clone-summary tables for Web Serial radio images.
 * Backup / Restore uses `variant="inspect"` (on-image occupancy). Write-coverage
 * tables on Export stay in `AtD890WriteCoverageTable` and siblings; pass
 * `variant="write-coverage"` only if this view must show Written / Kept sections.
 */

import { Accordion, Code, List, Stack, Table, Text } from '@mantine/core';
import { type RadioCloneHydrationBag } from '@core/models/radioCloneHydration.ts';
import {
  summariseUv5rMiniClone,
  UV5R_MINI_MODEL_ID,
  type Uv5rMiniCloneSummary,
} from '@integrations/radio-io/radios/uv5r-mini/index.ts';
import {
  summariseUv21ProV2Clone,
  UV21_PRO_V2_MODEL_ID,
} from '@integrations/radio-io/radios/uv21-pro-v2/index.ts';
import {
  summariseDm32uvClone,
  DM32UV_MODEL_ID,
  type Dm32uvCloneSummary,
} from '@integrations/radio-io/radios/dm32uv/index.ts';
import {
  summariseAtD890uvClone,
  AT_D890UV_MODEL_ID,
  type AtD890uvCloneSummary,
} from '@integrations/radio-io/radios/at-d890uv/index.ts';
import {
  summariseOpenGd77Clone,
  OPENGD77_DM1701_MODEL_ID,
  OPENGD77_MD9600_MODEL_ID,
  type OpenGd77CloneSummary,
} from '@integrations/radio-io/radios/opengd77/index.ts';
import {
  summariseRt95Clone,
  RT95_MODEL_ID,
  type Rt95CloneSummary,
} from '@integrations/radio-io/radios/rt95/index.ts';
import type { CloneInspectNamedItem } from '@integrations/radio-io/cloneInspect.ts';
import { FormSection } from '../ui/index.ts';

export type RadioCloneSummaryVariant = 'inspect' | 'write-coverage';

function hexOffset(n: number): string {
  return `0x${n.toString(16).toUpperCase()}`;
}

function occupancyCopy(variant: RadioCloneSummaryVariant): { title: string; description: string } {
  if (variant === 'inspect') {
    return {
      title: 'On this image',
      description: 'Decoded from this backup — what is stored here, not your build layout.',
    };
  }
  return {
    title: 'On the radio',
    description: 'Counts decoded from the stored image — not your build layout.',
  };
}

function InspectNamedLists({
  lists,
}: {
  lists: readonly { id: string; title: string; rows: readonly CloneInspectNamedItem[] }[];
}) {
  const nonempty = lists.filter((list) => list.rows.length > 0);
  if (nonempty.length === 0) return null;
  return (
    <FormSection
      title="Names on this image"
      description="Expand a list to see slot names decoded from this backup."
    >
      <Accordion multiple variant="separated" defaultValue={[]}>
        {nonempty.map((list) => (
          <Accordion.Item key={list.id} value={list.id}>
            <Accordion.Control>
              {list.title} ({list.rows.length})
            </Accordion.Control>
            <Accordion.Panel>
              <List size="sm" spacing={4}>
                {list.rows.map((row) => (
                  <List.Item key={`${list.id}-${row.slotIndex}`}>
                    {row.slotIndex}. {row.name || '(unnamed)'}
                  </List.Item>
                ))}
              </List>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </FormSection>
  );
}

function summariseUv17ProFamilyClone(bag: RadioCloneHydrationBag): Uv5rMiniCloneSummary | null {
  const modelId = bag.retain.radioModelId;
  if (modelId === UV5R_MINI_MODEL_ID) return summariseUv5rMiniClone(bag);
  if (modelId === UV21_PRO_V2_MODEL_ID) return summariseUv21ProV2Clone(bag);
  return null;
}

function isUv17ProFamilyModel(modelId: string | undefined): boolean {
  return modelId === UV5R_MINI_MODEL_ID || modelId === UV21_PRO_V2_MODEL_ID;
}

function Dm32OnRadioSection({
  summary,
  variant,
}: {
  summary: Dm32uvCloneSummary;
  variant: RadioCloneSummaryVariant;
}) {
  const c = summary.onRadioCounts;
  const occupancy = occupancyCopy(variant);
  return (
    <FormSection title={occupancy.title} description={occupancy.description}>
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

function Uv5rOnRadioSection({
  summary,
  variant,
}: {
  summary: Uv5rMiniCloneSummary;
  variant: RadioCloneSummaryVariant;
}) {
  const c = summary.onRadioCounts;
  const occupancy = occupancyCopy(variant);
  return (
    <FormSection title={occupancy.title} description={occupancy.description}>
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
  variant,
}: {
  summary: Uv5rMiniCloneSummary;
  bag: RadioCloneHydrationBag;
  variant: RadioCloneSummaryVariant;
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

      <Uv5rOnRadioSection summary={summary} variant={variant} />
      {variant === 'inspect' ? (
        <InspectNamedLists lists={[{ id: 'channels', title: 'Channels', rows: summary.inspectChannels }]} />
      ) : null}
      {variant === 'write-coverage' ? (
        <>
          <Uv5rWrittenFromBuildSection summary={summary} />
          <Uv5rKeptOnWriteSection summary={summary} />
        </>
      ) : null}
      <Uv5rSettingsRetainSection summary={summary} />
      <Uv5rAncillaryRetainSection summary={summary} />
    </>
  );
}

function OpenGd77OnRadioSection({
  summary,
  variant,
}: {
  summary: OpenGd77CloneSummary;
  variant: RadioCloneSummaryVariant;
}) {
  const c = summary.onRadioCounts;
  const occupancy = occupancyCopy(variant);
  return (
    <FormSection title={occupancy.title} description={occupancy.description}>
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
  variant,
}: {
  summary: OpenGd77CloneSummary;
  bag: RadioCloneHydrationBag;
  variant: RadioCloneSummaryVariant;
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

      <OpenGd77OnRadioSection summary={summary} variant={variant} />
      {variant === 'inspect' ? (
        <InspectNamedLists
          lists={[
            { id: 'channels', title: 'Channels', rows: summary.inspectChannels },
            { id: 'zones', title: 'Zones', rows: summary.inspectZones },
            { id: 'contacts', title: 'DMR contacts', rows: summary.inspectContacts },
            { id: 'rx-groups', title: 'RX group lists', rows: summary.inspectRxGroups },
          ]}
        />
      ) : null}
      {variant === 'write-coverage' ? (
        <>
          <OpenGd77WrittenFromBuildSection summary={summary} />
          <OpenGd77KeptOnWriteSection summary={summary} />
        </>
      ) : null}
      <OpenGd77SettingsRetainSection summary={summary} />
      <OpenGd77AncillaryRetainSection summary={summary} />
    </>
  );
}

function Dm32RadioImageSections({
  summary,
  bag,
  variant,
}: {
  summary: Dm32uvCloneSummary;
  bag: RadioCloneHydrationBag;
  variant: RadioCloneSummaryVariant;
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

      <Dm32OnRadioSection summary={summary} variant={variant} />
      {variant === 'inspect' ? (
        <InspectNamedLists lists={[{ id: 'channels', title: 'Channels', rows: summary.inspectChannels }]} />
      ) : null}
      {variant === 'write-coverage' ? (
        <>
          <Dm32WrittenFromBuildSection summary={summary} />
          <Dm32KeptOnWriteSection summary={summary} />
        </>
      ) : null}
      <Dm32SettingsRetainSection summary={summary} />
      <Dm32AncillaryRetainSection summary={summary} />
      <Dm32RequiredBlocksSection summary={summary} />
    </>
  );
}

function Rt95OnRadioSection({
  summary,
  variant,
}: {
  summary: Rt95CloneSummary;
  variant: RadioCloneSummaryVariant;
}) {
  const occupancy = occupancyCopy(variant);
  return (
    <FormSection title={occupancy.title} description={occupancy.description}>
      <Table.ScrollContainer minWidth={360}>
        <Table withTableBorder withColumnBorders>
          <Table.Tbody>
            <Table.Tr>
              <Table.Td fw={600}>Channels</Table.Td>
              <Table.Td>
                {summary.occupiedChannelCount} occupied · {summary.emptyChannelCount} empty slots
              </Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </FormSection>
  );
}

function Rt95WrittenFromBuildSection({ summary }: { summary: Rt95CloneSummary }) {
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

function Rt95KeptOnWriteSection({ summary }: { summary: Rt95CloneSummary }) {
  return (
    <FormSection
      title="Kept on Write"
      description="These regions stay as they were on the radio when you Write from your build."
    >
      {summary.retainGroups.length === 0 ? (
        <Text size="sm">No retained regions in this capture.</Text>
      ) : (
        <Table.ScrollContainer minWidth={360}>
          <Table withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Region</Table.Th>
                <Table.Th>On Write</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {summary.retainGroups.map((group) => (
                <Table.Tr key={group.label}>
                  <Table.Td>{group.label}</Table.Td>
                  <Table.Td>{group.role}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </FormSection>
  );
}

function Rt95SettingsRetainSection({ summary }: { summary: Rt95CloneSummary }) {
  return (
    <FormSection title="Radio settings (retain-only)">
      {summary.settingsRetain.length === 0 ? (
        <Text size="sm" c="dimmed">
          No radio settings block in the stored image.
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={360}>
          <Table withTableBorder withColumnBorders>
            <Table.Tbody>
              {summary.settingsRetain.map((row) => (
                <Table.Tr key={row.label}>
                  <Table.Td fw={600}>{row.label}</Table.Td>
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

function Rt95RadioImageSections({
  summary,
  bag,
  variant,
}: {
  summary: Rt95CloneSummary;
  bag: RadioCloneHydrationBag;
  variant: RadioCloneSummaryVariant;
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

      <Rt95OnRadioSection summary={summary} variant={variant} />
      {variant === 'inspect' ? (
        <InspectNamedLists lists={[{ id: 'channels', title: 'Channels', rows: summary.inspectChannels }]} />
      ) : null}
      {variant === 'write-coverage' ? (
        <>
          <Rt95WrittenFromBuildSection summary={summary} />
          <Rt95KeptOnWriteSection summary={summary} />
        </>
      ) : null}
      <Rt95SettingsRetainSection summary={summary} />
    </>
  );
}

function AtD890RadioImageSections({
  summary,
  bag,
  variant,
}: {
  summary: AtD890uvCloneSummary;
  bag: RadioCloneHydrationBag;
  variant: RadioCloneSummaryVariant;
}) {
  const occupancy = occupancyCopy(variant);
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
                <Table.Td fw={600}>Sparse payload</Table.Td>
                <Table.Td>
                  {summary.imageByteLength} bytes ({hexOffset(summary.imageByteLength)})
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={600}>16-byte chunks</Table.Td>
                <Table.Td>{summary.blockCount}</Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </FormSection>

      <FormSection title={occupancy.title} description={occupancy.description}>
        <Table.ScrollContainer minWidth={360}>
          <Table withTableBorder withColumnBorders>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td fw={600}>Channels</Table.Td>
                <Table.Td>{summary.channelCount}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={600}>Zones</Table.Td>
                <Table.Td>{summary.zoneCount}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={600}>Scan lists</Table.Td>
                <Table.Td>{summary.scanListCount}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={600}>Talk groups</Table.Td>
                <Table.Td>{summary.talkGroupCount}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={600}>RX group lists</Table.Td>
                <Table.Td>{summary.rxGroupCount}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={600}>Operator radio IDs</Table.Td>
                <Table.Td>{summary.radioIdCount}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={600}>AM airband channels</Table.Td>
                <Table.Td>{summary.amAirCount}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={600}>AM airband zones</Table.Td>
                <Table.Td>{summary.amZoneCount}</Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </FormSection>

      {variant === 'inspect' ? (
        <InspectNamedLists
          lists={[
            { id: 'channels', title: 'Channels', rows: summary.inspectChannels },
            { id: 'zones', title: 'Zones', rows: summary.inspectZones },
            { id: 'scan-lists', title: 'Scan lists', rows: summary.inspectScanLists },
            { id: 'talk-groups', title: 'Talk groups', rows: summary.inspectTalkGroups },
          ]}
        />
      ) : null}

      {variant === 'write-coverage' ? (
        <>
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
              {summary.digitalContactsWriteGap}
            </Text>
          </FormSection>

          <FormSection
            title="Kept on Write"
            description="Not re-derived from your build. Local info is still uploaded verbatim from this Read cache."
          >
            {summary.retainGroups.length === 0 ? (
              <Text size="sm">No retained regions in this capture.</Text>
            ) : (
              <Table.ScrollContainer minWidth={480}>
                <Table withTableBorder withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Region</Table.Th>
                      <Table.Th>Address range</Table.Th>
                      <Table.Th>Chunks</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {summary.retainGroups.map((g) => (
                      <Table.Tr key={g.label}>
                        <Table.Td>{g.label}</Table.Td>
                        <Table.Td>
                          <Code>{g.addressRange}</Code>
                        </Table.Td>
                        <Table.Td>{g.blockCount}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </FormSection>
        </>
      ) : null}

      <FormSection
        title="Forensics"
        description="Read-only decode from this image. These regions are not restore targets."
      >
        <Accordion multiple variant="separated" defaultValue={[]}>
          <Accordion.Item value="local-info">
            <Accordion.Control>Local info (Expert options)</Accordion.Control>
            <Accordion.Panel>
              <Text size="sm" c="dimmed" mb="sm">
                {variant === 'inspect'
                  ? 'Restore will not write Local info.'
                  : 'Decoded fields from LocalInfo @ 0x4f80000 — Read for forensics; not serial-written on Studio Write.'}
              </Text>
        {summary.settingsRetain.length === 0 ? (
          <Text size="sm" c="dimmed">
            No LocalInfo block in this capture.
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={560}>
            <Table withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Address</Table.Th>
                  <Table.Th>Offset</Table.Th>
                  <Table.Th>Field</Table.Th>
                  <Table.Th>Value</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {summary.settingsRetain.map((row) => (
                  <Table.Tr key={`${row.offset}-${row.label}`}>
                    <Table.Td>
                      <Code>{row.address}</Code>
                    </Table.Td>
                    <Table.Td>
                      <Code>{row.offset}</Code>
                    </Table.Td>
                    <Table.Td>{row.label}</Table.Td>
                    <Table.Td>{row.value}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="optional-settings">
            <Accordion.Control>Optional settings</Accordion.Control>
            <Accordion.Panel>
              <Text size="sm" c="dimmed" mb="sm">
                {variant === 'inspect'
                  ? 'Restore will not write optional settings.'
                  : 'Decoded from optional settings @ 0x3500000 / 0x3500900 — never serial-written. CPS language here is separate from Chinese UI in Local info above.'}
              </Text>
        {summary.optionalSettingsRetain.length === 0 ? (
          <Text size="sm" c="dimmed">
            No optional settings blocks in this capture.
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={560}>
            <Table withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Address</Table.Th>
                  <Table.Th>Offset</Table.Th>
                  <Table.Th>Field</Table.Th>
                  <Table.Th>Value</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {summary.optionalSettingsRetain.map((row) => (
                  <Table.Tr key={`${row.offset}-${row.label}`}>
                    <Table.Td>
                      <Code>{row.address}</Code>
                    </Table.Td>
                    <Table.Td>
                      <Code>{row.offset}</Code>
                    </Table.Td>
                    <Table.Td>{row.label}</Table.Td>
                    <Table.Td>{row.value}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
            </Accordion.Panel>
          </Accordion.Item>

          {summary.optionalSettingsAprs.length > 0 ? (
            <Accordion.Item value="optional-aprs">
              <Accordion.Control>Optional settings (APRS)</Accordion.Control>
              <Accordion.Panel>
                <Text size="sm" c="dimmed" mb="sm">
                  {variant === 'inspect'
                    ? 'Read-only hex preview from this image.'
                    : 'Raw hex from 0x3501280 — not decoded in Studio v1.'}
                </Text>
          <Table.ScrollContainer minWidth={560}>
            <Table withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Address</Table.Th>
                  <Table.Th>Offset</Table.Th>
                  <Table.Th>Field</Table.Th>
                  <Table.Th>Value</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {summary.optionalSettingsAprs.map((row) => (
                  <Table.Tr key={`${row.offset}-${row.label}`}>
                    <Table.Td>
                      <Code>{row.address}</Code>
                    </Table.Td>
                    <Table.Td>
                      <Code>{row.offset}</Code>
                    </Table.Td>
                    <Table.Td>{row.label}</Table.Td>
                    <Table.Td>{row.value}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
              </Accordion.Panel>
            </Accordion.Item>
          ) : null}

          <Accordion.Item value="alarm">
            <Accordion.Control>Alarm</Accordion.Control>
            <Accordion.Panel>
              <Text size="sm" c="dimmed" mb="sm">
                {variant === 'inspect'
                  ? 'Restore will not write alarm memory.'
                  : 'Light decode from alarm @ 0x3482e00 / 0x3483000 and man-down flags in optional main — Read/stash only; never serial-written.'}
              </Text>
        {summary.alarmRetain.length === 0 ? (
          <Text size="sm" c="dimmed">
            No alarm blocks in this capture.
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={560}>
            <Table withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Address</Table.Th>
                  <Table.Th>Offset</Table.Th>
                  <Table.Th>Field</Table.Th>
                  <Table.Th>Value</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {summary.alarmRetain.map((row) => (
                  <Table.Tr key={`${row.address}-${row.label}`}>
                    <Table.Td>
                      <Code>{row.address}</Code>
                    </Table.Td>
                    <Table.Td>
                      <Code>{row.offset}</Code>
                    </Table.Td>
                    <Table.Td>{row.label}</Table.Td>
                    <Table.Td>{row.value}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="local-info-registers">
            <Accordion.Control>Local info registers</Accordion.Control>
            <Accordion.Panel>
              <Text size="sm" c="dimmed" mb="sm">
                Every 16-byte serial chunk in LocalInfo (0x100 bytes). Notes map known ExpertOptions
                fields onto each chunk.
              </Text>
        {summary.localInfoRegisters.length === 0 ? (
          <Text size="sm" c="dimmed">
            No LocalInfo registers in this capture.
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={720}>
            <Table withTableBorder withColumnBorders fz="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Address</Table.Th>
                  <Table.Th>Offset</Table.Th>
                  <Table.Th>Hex (16 bytes)</Table.Th>
                  <Table.Th>ASCII</Table.Th>
                  <Table.Th>Known fields</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {summary.localInfoRegisters.map((row) => (
                  <Table.Tr key={row.address}>
                    <Table.Td>
                      <Code>{row.address}</Code>
                    </Table.Td>
                    <Table.Td>
                      <Code>{row.offset}</Code>
                    </Table.Td>
                    <Table.Td>
                      <Code style={{ whiteSpace: 'nowrap' }}>{row.hex}</Code>
                    </Table.Td>
                    <Table.Td>
                      <Code>{row.ascii}</Code>
                    </Table.Td>
                    <Table.Td>{row.notes}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </FormSection>

      <FormSection
        title="Not in this capture"
        description="Documented on the radio but Studio does not Read these in v1 — absent from the bag and never serial-written."
      >
        <Table.ScrollContainer minWidth={480}>
          <Table withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Address</Table.Th>
                <Table.Th>Region</Table.Th>
                <Table.Th>Note</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {summary.notInCapture.map((row) => (
                <Table.Tr key={`${row.address}-${row.label}`}>
                  <Table.Td>
                    <Code>{row.address}</Code>
                  </Table.Td>
                  <Table.Td>{row.label}</Table.Td>
                  <Table.Td>{row.note}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </FormSection>
    </>
  );
}

export interface RadioCloneSummaryViewProps {
  bag: RadioCloneHydrationBag;
  /** Backup / Restore defaults to on-image inspect. */
  variant?: RadioCloneSummaryVariant;
}

export default function RadioCloneSummaryView({
  bag,
  variant = 'inspect',
}: RadioCloneSummaryViewProps) {
  const isUv17ProFamily = isUv17ProFamilyModel(bag.retain.radioModelId);
  const isDm32 =
    bag.retain.radioModelId === DM32UV_MODEL_ID || bag.retain.radioModelId === 'DP570UV';
  const isAtD890 =
    bag.retain.radioModelId === AT_D890UV_MODEL_ID || bag.retain.radioModelId === 'ID890UV';
  const isOpenGd77 =
    bag.retain.radioModelId === OPENGD77_DM1701_MODEL_ID ||
    bag.retain.radioModelId === OPENGD77_MD9600_MODEL_ID ||
    bag.retain.radioModelId === 'DM-1701' ||
    bag.retain.radioModelId === 'RT-84' ||
    bag.retain.radioModelId === 'MD-9600' ||
    bag.retain.radioModelId === 'RT-90';
  const isRt95 = bag.retain.radioModelId === RT95_MODEL_ID;
  const uv17ProSummary = isUv17ProFamily ? summariseUv17ProFamilyClone(bag) : null;
  const dm32Summary = isDm32 ? summariseDm32uvClone(bag) : null;
  const atD890Summary = isAtD890 ? summariseAtD890uvClone(bag) : null;
  const openGd77Summary = isOpenGd77 ? summariseOpenGd77Clone(bag) : null;
  const rt95Summary = isRt95 ? summariseRt95Clone(bag) : null;

  if (!uv17ProSummary && !dm32Summary && !atD890Summary && !openGd77Summary && !rt95Summary) {
    return (
      <FormSection title="Image summary">
        <Text size="sm">
          Model {bag.retain.radioModelId}, {bag.retain.imageByteLength} bytes — no labelled summary
          for this profile yet.
        </Text>
      </FormSection>
    );
  }

  return (
    <Stack gap="lg">
      {dm32Summary ? (
        <Dm32RadioImageSections summary={dm32Summary} bag={bag} variant={variant} />
      ) : atD890Summary ? (
        <AtD890RadioImageSections summary={atD890Summary} bag={bag} variant={variant} />
      ) : openGd77Summary ? (
        <OpenGd77RadioImageSections summary={openGd77Summary} bag={bag} variant={variant} />
      ) : rt95Summary ? (
        <Rt95RadioImageSections summary={rt95Summary} bag={bag} variant={variant} />
      ) : uv17ProSummary ? (
        <Uv5rRadioImageSections summary={uv17ProSummary} bag={bag} variant={variant} />
      ) : null}
    </Stack>
  );
}
