import { describe, expect, it } from '../utils';
import { createFakeTransport } from '../fake-transport';

describe('fake transport', () => {
  it('records sends and forwards lifecycle events without network', () => {
    const fake = createFakeTransport();
    const received: string[] = [];
    const transport = fake.factory(
      { url: 'wss://example.invalid', headers: {} },
      {
        onOpen() { received.push('open'); },
        onClose() { received.push('close'); },
        onError(message) { received.push(`error:${message}`); },
        onMessage(data) { received.push(`message:${data}`); },
      },
    );

    expect(fake.state).toBe('connecting');
    fake.open();
    transport.send('frame');
    fake.deliver('reply');
    fake.error('broken');
    transport.close();

    expect(fake.sent).toEqual(['frame']);
    expect(received).toEqual(['open', 'message:reply', 'error:broken', 'close']);
    expect(fake.state).toBe('closed');
  });
});
