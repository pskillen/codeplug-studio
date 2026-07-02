import { Button, Group, Stack, Text, TextInput } from '@mantine/core';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { traitProfileFor } from '@core/models/traits.ts';
import { formatCatalogEntry } from '@core/import-export/registry.ts';
import type { FormatId } from '@core/import-export/types.ts';
import ProfilePicker from '../../components/builds/ProfilePicker.tsx';
import { FormPage, FormSection } from '../../components/ui/index.ts';
import { buildHasLayoutData, TRAIT_LABELS } from './buildHelpers.ts';
import { BuildService } from '../../state/buildService.ts';
import { persistence } from '../../state/persistence.ts';
import { useBuildLayout } from './BuildLayoutContext.tsx';
import { Badge } from '@mantine/core';

const buildService = new BuildService(persistence);

export default function BuildOverviewPage() {
  const { build } = useBuildLayout();
  const navigate = useNavigate();
  const [name, setName] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = name ?? build.name;
  const displayProfileId = profileId ?? build.profileId;
  const profile = traitProfileFor(displayProfileId);
  const formatEntry = formatCatalogEntry(build.formatId as FormatId);
  const profileDirty = profileId != null && profileId !== build.profileId;
  const nameDirty = name != null && name !== build.name;

  async function handleSave() {
    setSaving(true);
    setError(null);
    let row = buildService.withUpdatedName(build, displayName);
    if (profileDirty && profileId) {
      row = buildService.withUpdatedProfile(row, profileId);
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
              disabled={!nameDirty && !profileDirty}
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
              description="Trait profile and wire limits for this build"
            />
          </Stack>
        </FormSection>

        <FormSection title="Capability traits">
          <Group gap="xs">
            {(profile?.traits ?? []).map((trait) => (
              <Badge key={trait} variant="light">
                {TRAIT_LABELS[trait] ?? trait}
              </Badge>
            ))}
          </Group>
        </FormSection>
      </Stack>
    </FormPage>
  );
}
