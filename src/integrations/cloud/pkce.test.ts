import { describe, expect, it } from 'vitest';
import {
  generateCodeChallenge,
  generateCodeVerifier,
  generateOAuthState,
} from './pkce.ts';

describe('pkce', () => {
  it('generates verifier and matching S256 challenge', async () => {
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBeGreaterThan(40);
    const challenge = await generateCodeChallenge(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/u);
    expect(challenge).not.toBe(verifier);
  });

  it('generates unique state values', () => {
    const a = generateOAuthState();
    const b = generateOAuthState();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(16);
  });
});
