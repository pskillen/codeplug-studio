import { Anchor, Button, Checkbox, Stepper, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import classes from './StorageClaim.module.css';
import { COPY, STEP_LABELS, STORAGE_CLAIM_STEPS } from './storageClaimCopy.ts';
import type { StorageClaimActions, StorageClaimStep, StorageClaimView } from './types.ts';

function stepIndex(step: StorageClaimStep): number {
  if (step === 'done') return STORAGE_CLAIM_STEPS.length;
  return STORAGE_CLAIM_STEPS.indexOf(step as (typeof STORAGE_CLAIM_STEPS)[number]);
}

export interface StorageClaimScreenProps {
  view: StorageClaimView;
  actions: StorageClaimActions;
}

export default function StorageClaimScreen({ view, actions }: StorageClaimScreenProps) {
  const idx = stepIndex(view.step);
  const steps = STORAGE_CLAIM_STEPS.map((id, i) => ({
    id,
    label: STEP_LABELS[id],
    status:
      view.step === 'done'
        ? ('done' as const)
        : i < idx
          ? 'done'
          : i === idx
            ? 'current'
            : 'pending',
  }));

  return (
    <div className={classes.page} data-testid="storage-claim-page">
      <div className={classes.header}>
        <h1 className={classes.title}>{COPY.title}</h1>
        <p className={classes.strap}>{COPY.strap}</p>
      </div>
      {view.step !== 'done' ? (
        <Stepper active={idx} size="sm">
          {steps.map((s) => (
            <Stepper.Step key={s.id} label={s.label} />
          ))}
        </Stepper>
      ) : null}
      <div className={classes.shell}>
        {view.notice ? <div className={classes.notice}>{view.notice}</div> : null}
        {view.step === 'check' ? (
          <>
            <Text size="sm">Connect the radio and read its storage layout.</Text>
            <Button
              loading={view.busy}
              onClick={actions.onConnectCheck}
              data-testid="storage-claim-check"
            >
              Connect and check
            </Button>
          </>
        ) : null}
        {view.step === 'backup' && view.check ? (
          <>
            <Text size="sm">
              Board {view.check.boardReported}, firmware {view.check.firmwareGit}. Region foreign.
            </Text>
            <Text size="sm">{COPY.noRestore}</Text>
            <div className={classes.actions}>
              <Button
                loading={view.busy}
                onClick={actions.onBackup}
                data-testid="storage-claim-backup"
              >
                Back up and download
              </Button>
            </div>
            {view.tokenHex ? (
              <Text size="sm" data-testid="storage-claim-token">
                Token: {view.tokenHex}
              </Text>
            ) : null}
            {view.backupFileName ? <Text size="sm">Saved: {view.backupFileName}</Text> : null}
            <Checkbox
              label={COPY.backupTick}
              checked={view.backupSaved}
              onChange={(e) => actions.onSaveTick(e.currentTarget.checked)}
            />
            <Button disabled={!view.backupSaved} onClick={actions.onBackupNext}>
              Next
            </Button>
          </>
        ) : null}
        {view.step === 'confirm' ? (
          <>
            <Text size="sm">{COPY.cost}</Text>
            <Checkbox
              label={COPY.backupTick}
              checked={view.confirmTick}
              onChange={(e) => actions.onConfirmTick(e.currentTarget.checked)}
            />
            <Button
              color="red"
              disabled={!view.confirmTick}
              loading={view.busy}
              onClick={actions.onUnlock}
              data-testid="storage-claim-unlock"
            >
              {COPY.unlockLabel}
            </Button>
          </>
        ) : null}
        {view.step === 'unlock' ? (
          <Text size="sm">
            {view.pollPending ? 'Waiting for the radio to finish erasing…' : 'Sending claim…'}
          </Text>
        ) : null}
        {view.step === 'done' ? (
          <>
            <Text size="sm">{view.notice ?? COPY.oursDone}</Text>
            <div className={classes.actions}>
              <Anchor
                component={Link}
                to={`/builds/${view.buildId}/export`}
                onClick={actions.onWriteLink}
              >
                Write the radio
              </Anchor>
              {view.layout?.region !== 'ours' ? (
                <Button variant="default" loading={view.busy} onClick={actions.onCheckAgain}>
                  {COPY.checkAgain}
                </Button>
              ) : null}
              <Button variant="subtle" onClick={actions.onBackToExport}>
                Back to Export
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
