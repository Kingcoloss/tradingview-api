import {
  deflateRawSync,
  deflateSync,
  gzipSync,
} from 'node:zlib';
import JSZip from 'jszip';
import { describe, it, expect } from '../utils';
import { parseWSPacket, formatWSPacket, parseCompressed } from '../../src/protocol';

const toTradingViewBase64 = (data: Buffer) => (
  data.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
);

describe('protocol', () => {
  it('formatWSPacket wraps JSON with length prefix', () => {
    const out = formatWSPacket({ m: 'ping', p: [1] });
    const body = JSON.stringify({ m: 'ping', p: [1] });
    expect(out).toBe(`~m~${body.length}~m~${body}`);
  });

  it('formatWSPacket passes string through', () => {
    expect(formatWSPacket('~h~5')).toBe('~m~4~m~~h~5');
  });

  it('parseWSPacket splits framed JSON and heartbeat packets', () => {
    const body = JSON.stringify({ m: 'quote_completed', p: ['qs_abc', 'key'] });
    const frame = `~m~${body.length}~m~${body}~m~4~m~~h~1`;
    expect(parseWSPacket(frame) as unknown).toEqual([
      { m: 'quote_completed', p: ['qs_abc', 'key'] },
      1,
    ]);
  });

  it('parseCompressed decodes a zip archive', async () => {
    const payload = { ok: true, format: 'zip' };
    const zip = new JSZip();
    zip.file('payload.json', JSON.stringify(payload));
    const encoded = await zip.generateAsync({ type: 'base64' });
    expect(await parseCompressed(encoded)).toEqual(payload);
  });

  for (const [name, encode] of [
    ['identity', (data: Buffer) => data],
    ['zlib', deflateSync],
    ['raw deflate', deflateRawSync],
    ['gzip', gzipSync],
  ] as const) {
    it(`parseCompressed decodes ${name} payload`, async () => {
      const payload = { ok: true, format: name };
      const encoded = encode(Buffer.from(JSON.stringify(payload)));
      expect(await parseCompressed(toTradingViewBase64(encoded))).toEqual(payload);
    });
  }
});
