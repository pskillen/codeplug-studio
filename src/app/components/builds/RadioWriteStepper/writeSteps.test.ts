import { describe, expect, it } from 'vitest';
import { demoFlowView, demoShellOptions } from './stepperDemo.ts';
import { writeSteps } from './writeSteps.ts';

describe('writeSteps', () => {
  it('skips Restart & check when the radio does not restart, check, or after-restart keps', () => {
    const steps = writeSteps(
      demoFlowView({ step: 'whatToWrite' }),
      demoShellOptions({ restartAfterEndSeconds: 0, check: { available: false } }),
    );
    const restart = steps.find((s) => s.id === 'restartCheck');
    expect(restart?.status).toBe('skipped');
  });

  it('keeps Restart & check when restartAfterEndSeconds is positive', () => {
    const steps = writeSteps(
      demoFlowView({ step: 'whatToWrite' }),
      demoShellOptions({ restartAfterEndSeconds: 20, check: { available: false } }),
    );
    expect(steps.find((s) => s.id === 'restartCheck')?.status).toBe('pending');
  });

  it('keeps Restart & check when check is available', () => {
    const steps = writeSteps(
      demoFlowView({ step: 'whatToWrite' }),
      demoShellOptions({ restartAfterEndSeconds: 0, check: { available: true } }),
    );
    expect(steps.find((s) => s.id === 'restartCheck')?.status).not.toBe('skipped');
  });

  it('shows Review if needed while the read has not decided', () => {
    const steps = writeSteps(
      demoFlowView({ step: 'connectRead', reviewDecision: 'undecided' }),
      demoShellOptions(),
    );
    expect(steps.find((s) => s.id === 'review')).toMatchObject({
      label: 'Review if needed',
      status: 'pending',
    });
  });

  it('skips Review when the read decides there is nothing to stop for', () => {
    const steps = writeSteps(
      demoFlowView({ step: 'writing', reviewDecision: 'skipped' }),
      demoShellOptions(),
    );
    expect(steps.find((s) => s.id === 'review')).toMatchObject({
      label: 'Review not needed this time',
      status: 'skipped',
    });
  });

  it('counts Review when the read paused for it', () => {
    const steps = writeSteps(
      demoFlowView({ step: 'review', reviewDecision: 'paused' }),
      demoShellOptions(),
    );
    expect(steps.find((s) => s.id === 'review')).toMatchObject({
      label: 'Review',
      status: 'current',
    });
  });

  it('marks the failed step as error when errorOutcome is set', () => {
    const steps = writeSteps(
      demoFlowView({
        step: 'writing',
        reviewDecision: 'skipped',
        errorOutcome: {
          kind: 'error',
          retry: 'rewrite',
          sent: 'nothing-sent',
          message: 'fail',
          debugText: '',
          code: 'timeout',
        },
      }),
      demoShellOptions(),
    );
    expect(steps.find((s) => s.id === 'writing')?.status).toBe('error');
  });
});