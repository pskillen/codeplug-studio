import { describe, expect, it, vi } from 'vitest';
import { runEntityDeleteFlow } from './entityDeleteFlow.ts';

describe('runEntityDeleteFlow', () => {
  it('formats blocked delete when an RX group list still references the talk group', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const deleteEntity = vi.fn().mockResolvedValue({
      ok: false,
      references: [
        {
          fromKind: 'rxGroupList',
          fromId: 'list-1',
          fromName: 'Wide area',
          relationship: 'RX group list member',
        },
      ],
    });

    const result = await runEntityDeleteFlow({
      kind: 'talkGroup',
      entityId: 'tg-1',
      label: 'World',
      deleteEntity,
    });

    expect(result).toEqual({
      status: 'blocked',
      message: 'Delete blocked — Wide area (RX group list member)',
    });
    confirm.mockRestore();
  });
});
