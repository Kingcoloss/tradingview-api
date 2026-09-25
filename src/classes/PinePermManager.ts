import axios from 'axios';
import { genAuthCookies } from '../utils';

export interface AuthorizationUser {
  id: string | number;
  username: string;
  userpic: string;
  expiration: string;
  created: string;
}

type UserOrder = 'user__username' | '-user__username' | 'created' | '-created'
  | 'expiration,user__username' | '-expiration,user__username';

export default class PinePermManager {
  sessionId: string;

  signature: string;

  pineId: string;

  constructor(sessionId: string, signature: string, pineId: string) {
    if (!sessionId) throw new Error('Please provide a SessionID');
    if (!signature) throw new Error('Please provide a Signature');
    if (!pineId) throw new Error('Please provide a PineID');
    this.sessionId = sessionId;
    this.signature = signature;
    this.pineId = pineId;
  }

  async getUsers(limit = 10, order: UserOrder = '-created'): Promise<AuthorizationUser[]> {
    try {
      const { data } = await axios.post(
        `https://www.tradingview.com/pine_perm/list_users/?limit=${limit}&order_by=${order}`,
        `pine_id=${this.pineId.replace(/;/g, '%3B')}`,
        {
          headers: {
            origin: 'https://www.tradingview.com',
            'Content-Type': 'application/x-www-form-urlencoded',
            cookie: genAuthCookies(this.sessionId, this.signature),
          },
        },
      );

      return data.results;
    } catch (e: any) {
      throw new Error(e.response.data.detail || 'Wrong credentials or pineId');
    }
  }

  async addUser(username: string, expiration: Date | null = null): Promise<'ok' | 'exists' | null> {
    try {
      const { data } = await axios.post(
        'https://www.tradingview.com/pine_perm/add/',
        `pine_id=${
          this.pineId.replace(/;/g, '%3B')
        }&username_recip=${
          username
        }${
          expiration && expiration instanceof Date
            ? `&expiration=${expiration.toISOString()}`
            : ''
        }`,
        {
          headers: {
            origin: 'https://www.tradingview.com',
            'Content-Type': 'application/x-www-form-urlencoded',
            cookie: genAuthCookies(this.sessionId, this.signature),
          },
        },
      );

      return data.status;
    } catch (e: any) {
      throw new Error(e.response.data.detail || 'Wrong credentials or pineId');
    }
  }

  async modifyExpiration(username: string, expiration: Date | null = null): Promise<'ok' | null> {
    try {
      const { data } = await axios.post(
        'https://www.tradingview.com/pine_perm/modify_user_expiration/',
        `pine_id=${
          this.pineId.replace(/;/g, '%3B')
        }&username_recip=${
          username
        }${
          expiration && expiration instanceof Date
            ? `&expiration=${expiration.toISOString()}`
            : ''
        }`,
        {
          headers: {
            origin: 'https://www.tradingview.com',
            'Content-Type': 'application/x-www-form-urlencoded',
            cookie: genAuthCookies(this.sessionId, this.signature),
          },
        },
      );

      return data.status;
    } catch (e: any) {
      throw new Error(e.response.data.detail || 'Wrong credentials or pineId');
    }
  }

  async removeUser(username: string): Promise<'ok' | null> {
    try {
      const { data } = await axios.post(
        'https://www.tradingview.com/pine_perm/remove/',
        `pine_id=${this.pineId.replace(/;/g, '%3B')}&username_recip=${username}`,
        {
          headers: {
            origin: 'https://www.tradingview.com',
            'Content-Type': 'application/x-www-form-urlencoded',
            cookie: genAuthCookies(this.sessionId, this.signature),
          },
        },
      );

      return data.status;
    } catch (e: any) {
      throw new Error(e.response.data.detail || 'Wrong credentials or pineId');
    }
  }
}
