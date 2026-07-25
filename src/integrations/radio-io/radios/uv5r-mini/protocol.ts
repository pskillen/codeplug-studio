/**
 * UV-5R Mini CloneImageRadio — thin wrapper over uv17pro-family.
 */

import type { CloneImageRadio } from '../../types.ts';
import { UV5R_MINI_LAYOUT } from '../uv17pro-family/layout.ts';
import {
  createUv17ProProtocol,
  Uv17ProProtocol,
  type Uv17ProConnectOptions,
} from '../uv17pro-family/protocol.ts';

export type Uv5rMiniConnectOptions = Uv17ProConnectOptions;

export class Uv5rMiniProtocol extends Uv17ProProtocol {
  constructor() {
    super(UV5R_MINI_LAYOUT);
  }
}

export function createUv5rMiniProtocol(): CloneImageRadio {
  return createUv17ProProtocol(UV5R_MINI_LAYOUT);
}
