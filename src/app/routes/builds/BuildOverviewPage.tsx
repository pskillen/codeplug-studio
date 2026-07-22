import { Badge, Button, Group, Stack, Text, TextInput } from '@mantine/core';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { traitProfileFor } from '@core/models/traits.ts';
import { formatCatalogEntry } from '@core/import-export/registry.ts';
import type { FormatId } from '@core/import-export/types.ts';
import ProfilePicker from '../../components/builds/ProfilePicker.tsx';
import { FormPage, FormSection } from '../../components/ui/index.ts';
import { buildHasLayoutData } from './buildHelpers.ts';
import { capabilityLabel } from '../../lib/buildCapabilityCopy.ts';
import { BuildService } from '../../state/buildService.ts';
import { persistence } from '../../state/persistence.ts';
import { useBuildLayout } from './BuildLayoutContext.tsx';

const buildService = new BuildService(persistence);

function normalizeOptionalVersion(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export default function BuildOverviewPage() {
  const { build } = useBuildLayout();
  const navigate = useNavigate();
  const [name, setName] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [cpsVersion, setCpsVersion] = useState<string | null>(null);
  const [firmwareVersion, setFirmwareVersion] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = name ?? build.name;
  const displayProfileId = profileId ?? build.profileId;
  const displayCpsVersion = cpsVersion ?? build.cpsVersion ?? '';
  const displayFirmwareVersion = firmwareVersion ?? build.firmwareVersion ?? '';
  const profile = traitProfileFor(displayProfileId);
  const formatEntry = formatCatalogEntry(build.formatId as FormatId);
  const profileDirty = profileId != null && profileId !== build.profileId;
  const nameDirty = name != null && name !== build.name;
  const nextCps = normalizeOptionalVersion(displayCpsVersion);
  const nextFirmware = normalizeOptionalVersion(displayFirmwareVersion);
  const versionsDirty =
    (cpsVersion != null && nextCps !== build.cpsVersion) ||
    (firmwareVersion != null && nextFirmware !== build.firmwareVersion);

  async function handleSave() {
    setSaving(true);
    setError(null);
    let row = buildService.withUpdatedName(build, displayName);
    if (profileDirty && profileId) {
      row = buildService.withUpdatedProfile(row, profileId);
    }
    if (versionsDirty) {
      row = {
        ...row,
        cpsVersion: nextCps,
        firmwareVersion: nextFirmware,
      };
    }
    const result = await buildService.putBuild(row, build.revision);
    setSaving(false);
    if (!result.ok) {
      setError(
        result.reason === 'revision_conflict'
          ? 'This build was changed elsewhere. Reload and reapply your edit.'
          : 'Save failed.',
      );
      return;
    }
    setName(null);
    setProfileId(null);
    setCpsVersion(null);
    setFirmwareVersion(null);
  }

  function handleProfileChange(nextProfileId: string) {
    if (nextProfileId === displayProfileId) return;
    if (
      buildHasLayoutData(build) &&
      !window.confirm(
        'This build already has layout or overrides. Changing profile may change wire limits — continue?',
      )
    ) {
      return;
    }
    setProfileId(nextProfileId);
  }

  async function handleDelete() {
    if (!window.confirm(`Delete build "${build.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    await buildService.deleteBuild(build.projectId, build.id);
    setDeleting(false);
    navigate('/builds');
  }

  return (
    <FormPage
      title={build.name}
      description={
        <Link to="/builds" style={{ fontSize: 'var(--mantine-font-size-sm)' }}>
          ← Back to builds
        </Link>
      }
    >
      <Stack gap="lg">
        <FormSection title="Identity">
          <TextInput
            label="Name"
            value={displayName}
            onChange={(e) => setName(e.currentTarget.value)}
          />
          {error ? (
            <Text c="red" size="sm">
              {error}
            </Text>
          ) : null}
          <Group mt="sm">
            <Button
              loading={saving}
              disabled={!nameDirty && !profileDirty && !versionsDirty}
              onClick={() => void handleSave()}
            >
              Save
            </Button>
            <Button
              variant="outline"
              color="red"
              loading={deleting}
              onClick={() => void handleDelete()}
            >
              Delete build
            </Button>
          </Group>
        </FormSection>

        <FormSection title="Target">
          <Stack gap="sm">
            <Text size="sm">
              <Text span fw={600}>
                Format:{' '}
              </Text>
              {formatEntry?.label ?? build.formatId}
            </Text>
            <ProfilePicker
              formatId={build.formatId as FormatId}
              mode="select"
              value={displayProfileId}
              onChange={handleProfileChange}
              label="Radio profile"
              description="Radio profile and export limits for this build"
            />
            <TextInput
              label="CPS version"
              description="Vendor CPS or interchange tool version for file export (optional)."
              placeholder="e.g. CHIRP daily, DM-32 CPS 1.60"
              value={displayCpsVersion}
              onChange={(e) => setCpsVersion(e.currentTarget.value)}
            />
            <TextInput
              label="Firmware version"
              description="Radio firmware for direct-write gates when Web Serial is available (optional)."
              placeholder="e.g. from radio read"
              value={displayFirmwareVersion}
              onChange={(e) => setFirmwareVersion(e.currentTarget.value)}
            />
          </Stack>
        </FormSection>

        <FormSection
          title="How this radio is organised"
          description={
            <Text size="sm" component="span">
              Short labels for this profile. See{' '}
              <Link to={`/builds/${build.id}/characteristics`}>Radio characteristics</Link> for
              limits, power levels, and plain-language explanations.
            </Text>
          }
        >
          <Group gap="xs">
            {(profile?.traits ?? []).map((trait) => (
              <Badge key={trait} variant="light">
                {capabilityLabel(trait)}
              </Badge>
            ))}
          </Group>
        </FormSection>
      </Stack>
    </FormPage>
  );
}
