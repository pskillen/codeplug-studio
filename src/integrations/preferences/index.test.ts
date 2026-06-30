import { afterEach, describe, expect, it } from 'vitest';
import { loadActiveProjectId, saveActiveProjectId } from './index.ts';

afterEach(() => {
  localStorage.clear();
});

describe('active project preference', () => {
  it('returns null when nothing is stored', () => {
    expect(loadActiveProjectId()).toBeNull();
  });

  it('round-trips a project id', () => {
    saveActiveProjectId('project-123');
    expect(loadActiveProjectId()).toBe('project-123');
  });

  it('clears the stored id when given null', () => {
    saveActiveProjectId('project-123');
    saveActiveProjectId(null);
    expect(loadActiveProjectId()).toBeNull();
  });
});
