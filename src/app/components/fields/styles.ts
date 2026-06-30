import type { CSSProperties } from 'react';

export const controlStyle: CSSProperties = {
  padding: '0.4rem 0.55rem',
  border: '1px solid #cbd2d9',
  borderRadius: 6,
  fontSize: '0.9rem',
  minWidth: 220,
};

export const primaryButtonStyle: CSSProperties = {
  padding: '0.45rem 0.9rem',
  border: 'none',
  borderRadius: 6,
  background: '#2f6f4f',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
};

export const secondaryButtonStyle: CSSProperties = {
  padding: '0.4rem 0.8rem',
  border: '1px solid #cbd2d9',
  borderRadius: 6,
  background: '#fff',
  color: '#1f2933',
  cursor: 'pointer',
};

export const dangerButtonStyle: CSSProperties = {
  ...secondaryButtonStyle,
  color: '#b91c1c',
  borderColor: '#f1c0c0',
};
