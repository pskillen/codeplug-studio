import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  countBuildsByTarget,
  radioTargetDisplayLabel,
  radioTargetFor,
} from '@core/radio-targets/index.ts';
import { EgressPathwayPills } from '../../components/builds/EgressPathwayPills.tsx';
import RadioTargetPicker from '../../components/builds/RadioTargetPicker.tsx';
import { Button, TextInput } from '../../components/v2/index.ts';
import { Text } from '@mantine/core';
import { useFormatBuilds } from '../../state/useFormatBuilds.ts';
import classes from './NewBuildPage.module.css';

type Step = 'radio' | 'name';

export default function NewBuildPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { createBuild, builds } = useFormatBuilds();
  const [step, setStep] = useState<Step>('radio');
  const [radioTargetId, setRadioTargetId] = useState<string | null>(() => {
    const preselected = searchParams.get('target');
    return preselected && radioTargetFor(preselected) ? preselected : null;
  });
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildCounts = useMemo(() => countBuildsByTarget(builds ?? []), [builds]);
  const selectedTarget = radioTargetId ? radioTargetFor(radioTargetId) : undefined;
  const selectedLabel = radioTargetId ? radioTargetDisplayLabel(radioTargetId) : '';
  const existingCount = radioTargetId ? (buildCounts.get(radioTargetId) ?? 0) : 0;

  async function handleCreate() {
    if (!radioTargetId) return;
    setCreating(true);
    setError(null);
    const outcome = await createBuild(radioTargetId, name.trim() || undefined);
    setCreating(false);
    if (!outcome.ok) {
      setError(outcome.reason);
      return;
    }
    navigate(`/builds/${outcome.build.id}/export`);
  }

  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <Link to="/builds" className={classes.back}>
          ← Back to builds
        </Link>
        <h1 className={classes.title}>New build</h1>
        <p className={classes.subtitle}>
          Find your radio, then pick the firmware it runs. Builds are cheap — make one per handset
          or per role. Compatible export pathways are seeded automatically; pick the pathway on
          Export.
        </p>
      </div>

      {step === 'radio' ? (
        <div className={classes.section}>
          <h2 className={classes.sectionTitle}>Radio target</h2>
          <RadioTargetPicker
            value={radioTargetId}
            onChange={setRadioTargetId}
            buildCounts={buildCounts}
          />
          <div className={classes.footer} data-testid="new-build-footer">
            <span className={classes.footerSelection}>
              {radioTargetId ? (
                <>
                  <b>{selectedLabel}</b>
                  {existingCount > 0 ? (
                    <span className={classes.footerHint}>
                      {' '}
                      · you have {existingCount} {existingCount === 1 ? 'build' : 'builds'} for this
                      already
                    </span>
                  ) : null}
                </>
              ) : (
                <span className={classes.footerHint}>Choose a radio and firmware</span>
              )}
            </span>
            <Button
              disabled={!radioTargetId}
              onClick={() => {
                if (!radioTargetId) return;
                setName(radioTargetDisplayLabel(radioTargetId));
                setStep('name');
              }}
            >
              Next: name it →
            </Button>
          </div>
        </div>
      ) : null}

      {step === 'name' && selectedTarget ? (
        <div className={classes.section}>
          <h2 className={classes.sectionTitle}>Build name</h2>
          <div className={classes.namePanel}>
            <Text size="sm" c="dimmed">
              Radio: {selectedLabel}
            </Text>
            <EgressPathwayPills egress={selectedTarget.compatibleEgress} />
            <TextInput
              label="Build name"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
            />
            <Text size="xs" c="dimmed">
              Defaults to the radio name — change it when you run several builds for the same radio
              (Team A / Team B, one per handset).
            </Text>
            {error ? (
              <Text c="red" size="sm">
                {error}
              </Text>
            ) : null}
            <div className={classes.actions}>
              <Button loading={creating} onClick={() => void handleCreate()}>
                Create build
              </Button>
              <Button variant="ghost" onClick={() => setStep('radio')}>
                Change radio
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
