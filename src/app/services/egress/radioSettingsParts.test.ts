import { describe, expect, it } from 'vitest';
import {
  clearRadioSettingsRegistrations,
  radioSettingsPartFor,
  registerRadioSettingsPart,
  type RadioSettingsPart,
} from './radioSettingsParts.ts';

const stubPart = (profileIds: string[]): RadioSettingsPart => ({
  matches: (id) => profileIds.includes(id),
  pendingChangeCount: () => 0,
  takeRestoredTicks: () => undefined,
  saveTicks: () => undefined,
  uploadOptions: () => ({}),
  writeSettingsOnly: async () => ({}),
  createReviewController: () => null,
  reviewSectionBindings: () => ({}),
  pauseResult: () => 'keep',
  settingsWillBeWritten: () => false,
  changedCount: () => 0,
});

describe('radioSettingsParts registry', () => {
  it('finds the registered part by profile', () => {
    clearRadioSettingsRegistrations();
    registerRadioSettingsPart(stubPart(['radio-io-at-d890uv']));
    expect(radioSettingsPartFor('radio-io-at-d890uv')).toBeDefined();
    expect(radioSettingsPartFor('radio-io-rt95')).toBeUndefined();
  });

  it('unregister removes it', () => {
    clearRadioSettingsRegistrations();
    const unregister = registerRadioSettingsPart(stubPart(['radio-io-rt95']));
    expect(radioSettingsPartFor('radio-io-rt95')).toBeDefined();
    unregister();
    expect(radioSettingsPartFor('radio-io-rt95')).toBeUndefined();
  });
});