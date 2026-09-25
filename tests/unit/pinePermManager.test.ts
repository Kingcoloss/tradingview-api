import axios from 'axios';
import { describe, expect, it } from '../utils';
import PinePermManager from '../../src/classes/PinePermManager';

describe('PinePermManager', () => {
  it('throws exact constructor validation messages', () => {
    expect(() => new PinePermManager('', 'sig', 'PUB;ID')).toThrow('Please provide a SessionID');
    expect(() => new PinePermManager('session', '', 'PUB;ID')).toThrow('Please provide a Signature');
    expect(() => new PinePermManager('session', 'sig', '')).toThrow('Please provide a PineID');
  });

  it('preserves cookie header and encoded request bodies without network', async () => {
    const originalPost = axios.post;
    const calls: unknown[][] = [];
    axios.post = (async (...args: unknown[]) => {
      calls.push(args);
      const url = String(args[0]);
      return { data: url.includes('list_users') ? { results: ['user'] } : { status: 'ok' } };
    }) as typeof axios.post;
    try {
      const manager = new PinePermManager('session', 'signature', 'PUB;ABC');
      const expiration = new Date('2026-10-01T00:00:00.000Z');
      expect(await manager.getUsers(2, 'created')).toEqual(['user']);
      expect(await manager.addUser('alice', expiration)).toBe('ok');
      expect(await manager.modifyExpiration('alice')).toBe('ok');
      expect(await manager.removeUser('alice')).toBe('ok');
    } finally {
      axios.post = originalPost;
    }

    const headers = {
      origin: 'https://www.tradingview.com',
      'Content-Type': 'application/x-www-form-urlencoded',
      cookie: 'sessionid=session;sessionid_sign=signature',
    };
    expect(calls).toEqual([
      [
        'https://www.tradingview.com/pine_perm/list_users/?limit=2&order_by=created',
        'pine_id=PUB%3BABC',
        { headers },
      ],
      [
        'https://www.tradingview.com/pine_perm/add/',
        'pine_id=PUB%3BABC&username_recip=alice&expiration=2026-10-01T00:00:00.000Z',
        { headers },
      ],
      [
        'https://www.tradingview.com/pine_perm/modify_user_expiration/',
        'pine_id=PUB%3BABC&username_recip=alice',
        { headers },
      ],
      [
        'https://www.tradingview.com/pine_perm/remove/',
        'pine_id=PUB%3BABC&username_recip=alice',
        { headers },
      ],
    ]);
  });
});
