/** Retevis RT95 VOX PROGRAM→QX clone constants (CHIRP anytone778uv facts). */

export const RT95_MODEL_ID = 'retevis-rt95';
export const RT95_BAUD_RATE = 9600;
export const RT95_IMAGE_SIZE = 0x32a0;
export const RT95_BLOCK_SIZE = 0x10;
export const RT95_BLOCK_ADDR_START = 0x0000;
export const RT95_BLOCK_ADDR_END = 0x3290;
export const RT95_CHANNEL_COUNT = 200;
export const RT95_CHANNEL_RECORD_SIZE = 32;
export const RT95_CHANNEL_SPAN = RT95_CHANNEL_COUNT * RT95_CHANNEL_RECORD_SIZE;
export const RT95_NAME_LENGTH = 6;

export const RT95_OCCUPIED_BITFIELD_OFFSET = 0x1940;
export const RT95_SCAN_BITFIELD_OFFSET = 0x1960;
export const RT95_BITFIELD_BYTES = 32;
export const RT95_BANDLIMIT_OFFSET = 0x326d;
export const RT95_UPLOAD_PRIME_ADDR = 0x3b10;

export const RT95_ALLOWED_MODEL = 'RT95-P';
export const RT95_ALLOWED_VERSION = 'V100';

export const RT95_IO_TIMEOUT_MS = 500;
export const RT95_BLOCK_COUNT = (RT95_BLOCK_ADDR_END - RT95_BLOCK_ADDR_START) / RT95_BLOCK_SIZE + 1;
