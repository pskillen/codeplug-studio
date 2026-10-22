/** CRC16-XMODEM: poly 0x1021, init 0, MSB first, no xorout. `crc16Xmodem("123456789") === 0x31C3`. */
const TABLE = (() => {
  const t = new Uint16Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i << 8;
    for (let b = 0; b < 8; b++) c = (c & 0x8000 ? (c << 1) ^ 0x1021 : c << 1) & 0xffff;
    t[i] = c;
  }
  return t;
})();

export function crc16Xmodem(data: Uint8Array): number {
  let crc = 0;
  for (const x of data) crc = ((crc << 8) & 0xffff) ^ TABLE[((crc >> 8) ^ x) & 0xff]!;
  return crc;
}
