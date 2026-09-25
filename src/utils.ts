/**
 * Generates session id
 * @param type Session type
 * @returns Session ID with format `${type}_${12 random alphanumeric chars}`
 */
export function genSessionID(type: string = 'xs'): string {
  let r = '';
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 12; i += 1) r += c.charAt(Math.floor(Math.random() * c.length));
  return `${type}_${r}`;
}

/**
 * Generates auth cookie string
 * @param sessionId Session ID cookie value
 * @param signature Signature cookie value
 * @returns Empty string without sessionId; otherwise auth cookies
 */
export function genAuthCookies(sessionId: string = '', signature: string = ''): string {
  if (!sessionId) return '';
  if (!signature) return `sessionid=${sessionId}`;
  return `sessionid=${sessionId};sessionid_sign=${signature}`;
}
