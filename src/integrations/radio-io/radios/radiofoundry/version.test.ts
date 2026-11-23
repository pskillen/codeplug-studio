import { describe, expect, it } from 'vitest';
import { DM32UV_RADIOFOUNDRY_CABLE_BOARD } from './board.ts';
import { isRadioFoundryBoardName, parseRadioFoundryVersionText } from './version.ts';

describe('parseRadioFoundryVersionText', () => {
  it('parses every key of the spec example', () => {
    const v = parseRadioFoundryVersionText(
      'proto=1\ngit=1a2b3c4d\ngit_time=1795365604\nsource=official\nrepo=radiofoundry/radiofoundry\nboard=DM-32UV\nfeatures=P25,NXDN\noff=GPS\npreset=full\ncodec=absent\n',
    );
    expect(v).toEqual({
      proto: 1,
      git: '1a2b3c4d',
      gitTime: 1795365604,
      source: 'official',
      repo: 'radiofoundry/radiofoundry',
      board: 'DM-32UV',
      features: ['P25', 'NXDN'],
      off: ['GPS'],
      preset: 'full',
      codec: 'absent',
    });
  });

  it('ignores unknown keys and lines without =', () => {
    expect(parseRadioFoundryVersionText('future=1\njunk\nboard=dm32\n')).toEqual({
      board: 'dm32',
      features: [],
      off: [],
    });
  });

  it('keeps a value that contains =', () => {
    expect(parseRadioFoundryVersionText('repo=a=b\n').repo).toBe('a=b');
  });

  it('accepts CRLF', () => {
    const v = parseRadioFoundryVersionText('board=DM-32\r\ngit=1a2b3c4d\r\n');
    expect(v.board).toBe('DM-32');
    expect(v.git).toBe('1a2b3c4d');
  });

  it('keeps what came when the last line is cut', () => {
    const v = parseRadioFoundryVersionText('board=DM-32UV\noff=GPS,BLU');
    expect(v.off).toEqual(['GPS', 'BLU']);
  });

  it('gives empty lists for empty features', () => {
    const v = parseRadioFoundryVersionText('features=\n');
    expect(v.features).toEqual([]);
    expect(v.off).toEqual([]);
  });

  it('drops a bad number', () => {
    const v = parseRadioFoundryVersionText('git_time=abc\nproto=x\n');
    expect(v.gitTime).toBeUndefined();
    expect(v.proto).toBeUndefined();
  });
});

describe('isRadioFoundryBoardName', () => {
  it('matches board names ignoring case and spaces', () => {
    const board = DM32UV_RADIOFOUNDRY_CABLE_BOARD;
    expect(isRadioFoundryBoardName(board, ' dm-32uv ')).toBe(true);
    expect(isRadioFoundryBoardName(board, 'DM-32')).toBe(true);
    // Plan said 'DM32' is false, but it also says case is ignored and 'dm32' is a name: case wins.
    expect(isRadioFoundryBoardName(board, 'DM32')).toBe(true);
    expect(isRadioFoundryBoardName(board, 'DM 32')).toBe(false);
    expect(isRadioFoundryBoardName(board, 'dm32')).toBe(true);
    expect(isRadioFoundryBoardName(board, 'MD-9600')).toBe(false);
  });
});
