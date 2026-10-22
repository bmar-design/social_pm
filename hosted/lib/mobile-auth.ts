import { createRemoteJWKSet, jwtVerify } from 'jose';

const keysets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export class MobileAuthError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

// Bearer credentials take precedence: never fall back to a demo cookie after
// an invalid token, and never trust identity fields supplied by the client.
export async function mobileUser(req: Request, appId?: string) {
  const authorization = req.headers.get('Authorization');
  if (!authorization) return null;
  if (!appId) throw new MobileAuthError(503, 'Mobile authentication is not configured.');
  if (!/^Bearer [^\s]+$/.test(authorization) || authorization.length > 8192)
    throw new MobileAuthError(401, 'Please sign in again.');
  let keys = keysets.get(appId);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`https://auth.privy.io/api/v1/apps/${encodeURIComponent(appId)}/jwks.json`));
    keysets.set(appId, keys);
  }
  try {
    const { payload } = await jwtVerify(authorization.slice(7), keys, {
      issuer: 'privy.io', audience: appId, algorithms: ['ES256'],
      requiredClaims: ['sub', 'exp', 'iat'],
    });
    if (!payload.sub?.startsWith('did:privy:')) throw Error('Invalid subject');
    return { userId: payload.sub, fullName: null };
  } catch { throw new MobileAuthError(401, 'Your session expired. Please sign in again.'); }
}
