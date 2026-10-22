import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { mobileUser } from '../lib/mobile-auth.ts';

test('Privy authentication validates signatures and claims and fails closed', async () => {
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const other = await generateKeyPair('ES256');
  const jwk = { ...await exportJWK(publicKey), kid: 'test-key', alg: 'ES256', use: 'sig' };
  const original = globalThis.fetch;
  globalThis.fetch = async input => {
    assert.equal(String(input), 'https://auth.privy.io/api/v1/apps/mobile-test/jwks.json');
    return Response.json({ keys: [jwk] });
  };
  const now = Math.floor(Date.now() / 1000);
  const token = (claims: Record<string, unknown> = {}, key = privateKey) => new SignJWT({ sub: 'did:privy:alice', iss: 'privy.io', aud: 'mobile-test', iat: now, exp: now + 3600, ...claims }).setProtectedHeader({ alg: 'ES256', kid: 'test-key' }).sign(key);
  const request = (value: string) => new Request('https://app.example/api/me', { headers: { Authorization: `Bearer ${value}`, Cookie: 'sg_demo_session=' + 'a'.repeat(64) } });
  try {
    assert.equal(await mobileUser(new Request('https://app.example/api/me'), 'mobile-test'), null);
    assert.equal((await mobileUser(request(await token()), 'mobile-test'))?.userId, 'did:privy:alice');
    for (const claims of [{ aud: 'another-app' }, { iss: 'attacker.example' }, { exp: now - 1 }, { sub: 'demo:alice' }, { exp: undefined }]) {
      await assert.rejects(mobileUser(request(await token(claims)), 'mobile-test'), { status: 401 });
    }
    await assert.rejects(mobileUser(request(await token({}, other.privateKey)), 'mobile-test'), { status: 401 });
    await assert.rejects(mobileUser(request('forged'), 'mobile-test'), { status: 401 });
    await assert.rejects(mobileUser(request(await token())), { status: 503 });
  } finally { globalThis.fetch = original; }
});
