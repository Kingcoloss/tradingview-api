import JSZip from 'jszip';
import {
  gunzipSync,
  inflateRawSync,
  inflateSync,
} from 'node:zlib';

export interface TWPacket {
  m?: string;
  p?: unknown[];
}

const cleanerRgx = /~h~/g;
const splitterRgx = /~m~[0-9]{1,}~m~/g;

/** Normalise base64 data received from TradingView. */
function normaliseBase64(data: string): string {
  const normalised = data.replace(/-/g, '+').replace(/_/g, '/');
  return normalised.padEnd(normalised.length + ((4 - (normalised.length % 4)) % 4), '=');
}

/** Parse JSON from a decoded buffer, trying known compression wrappers. */
function parseDecodedCompressed(buffer: Buffer): unknown | undefined {
  const readers = [
    () => buffer,
    () => inflateSync(buffer),
    () => inflateRawSync(buffer),
    () => gunzipSync(buffer),
  ];

  for (const read of readers) {
    try {
      return JSON.parse(read().toString('utf8'));
    } catch {
      // Try the next known TradingView payload format.
    }
  }

  return undefined;
}

/** Parse websocket packet. */
export function parseWSPacket(str: string): TWPacket[] {
  return str.replace(cleanerRgx, '').split(splitterRgx)
    .map((packet) => {
      if (!packet) return false;
      try {
        return JSON.parse(packet) as TWPacket;
      } catch {
        console.warn('Cant parse', packet);
        return false;
      }
    })
    .filter((packet): packet is TWPacket => Boolean(packet));
}

/** Format websocket packet. */
export function formatWSPacket(packet: TWPacket | string | number): string {
  const msg = typeof packet === 'object'
    ? JSON.stringify(packet)
    : packet;
  return `~m~${(msg as string).length}~m~${msg}`;
}

/** Parse compressed TradingView data. */
export async function parseCompressed(data: string): Promise<unknown> {
  const normalised = normaliseBase64(data);
  const zip = new JSZip();

  try {
    const archive = await zip.loadAsync(normalised, { base64: true });
    const file = archive.file('') || archive.file(/.*/)[0];
    if (!file) throw new Error('Compressed payload does not contain a file');
    return JSON.parse(await file.async('text')) as unknown;
  } catch (zipError) {
    const decoded = Buffer.from(normalised, 'base64');
    const parsed = parseDecodedCompressed(decoded);
    if (parsed) return parsed;
    throw zipError;
  }
}
