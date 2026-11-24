import type { DebugFirmwareFamily } from './debugView/firmware.ts';
import { RadioWrongIdentError } from './kit/errors.ts';
import type { RadioBackupCapturedVia } from './backup/types.ts';
import type { BytePipe } from './types.ts';

export interface DebugOpenPort {
  pipe: BytePipe;
  capturedVia: RadioBackupCapturedVia;
  baudRate: number;
  close(): Promise<void>;
}

export function debugOpenPort(
  pipe: BytePipe,
  capturedVia: RadioBackupCapturedVia,
  baudRate: number,
): DebugOpenPort {
  let closed = false;
  return {
    pipe,
    capturedVia,
    baudRate,
    async close() {
      if (closed) return;
      closed = true;
      await pipe.close();
    },
  };
}

export class DebugWrongFirmwareError extends RadioWrongIdentError {
  constructor(
    readonly found: DebugFirmwareFamily | 'unknown',
    message: string,
    readonly port?: DebugOpenPort,
    readonly received?: Uint8Array,
  ) {
    super(message);
    this.name = 'DebugWrongFirmwareError';
  }
}
