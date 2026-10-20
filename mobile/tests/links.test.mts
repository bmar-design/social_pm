import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inviteFromUrl } from '../src/links.ts';

test('invites only accept our app scheme or HTTPS origin and valid tokens', () => {
  const token = '12345678-1234-1234-1234-123456789abc'.repeat(2);
  assert.equal(inviteFromUrl(`socialplays://invite/${token}`, 'https://app.example'), token);
  assert.equal(inviteFromUrl(`https://app.example/?invite=${token}`, 'https://app.example'), token);
  for (const url of [`https://evil.example/?invite=${token}`, `http://app.example/?invite=${token}`, `https://app.example.evil.example/?invite=${token}`, 'socialplays://invite/bad', `anotherapp://invite/${token}`, 'not a link']) assert.equal(inviteFromUrl(url, 'https://app.example'), null);
});
