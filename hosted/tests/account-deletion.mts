import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { deleteAccount } from '../lib/account-deletion.ts';
import { hashToken } from '../lib/demo-session.ts';

test('deletion removes only the account data, transfers ownership, and retries provider failure', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  for (const name of readdirSync('drizzle').filter(name => name.endsWith('.sql')).sort()) sqlite.exec(readFileSync(`drizzle/${name}`, 'utf8'));
  const uid = 'did:privy:alice';
  sqlite.prepare('INSERT INTO profiles VALUES (?,?)').run(uid, 'Alice');
  sqlite.prepare('INSERT INTO profiles VALUES (?,?)').run('bob', 'Bob');
  sqlite.prepare('INSERT INTO groups VALUES (?,?,?,?,?)').run('g', 'Friends', uid, 'old-invite', 1);
  for (const id of [uid, 'bob']) sqlite.prepare('INSERT INTO members VALUES (?,?,?)').run('g', id, 1);
  sqlite.prepare('INSERT INTO proposals(id,group_id,author,symbol,event,title,opposite,side,note,created) VALUES(?,?,?,?,?,?,?,?,?,?)').run('post', 'g', uid, 'X', 'Game', 'Yes', 'No', 'yes', 'Note', 1);
  sqlite.prepare('INSERT INTO responses VALUES (?,?,?,?)').run('post', 'bob', 'tail', 1);
  sqlite.prepare('INSERT INTO reports VALUES (?,?,?,?,?)').run('report', 'bob', 'post', 'Test', 1);
  sqlite.prepare('INSERT INTO chat_messages VALUES (?,?,?,?,?)').run('msg','g',uid,'Hello',1);
  sqlite.prepare('INSERT INTO chat_reactions VALUES (?,?,?,?,?)').run('g','msg','bob','👍',1);
  sqlite.prepare('INSERT INTO chat_reactions VALUES (?,?,?,?,?)').run('g','post',uid,'🔥',1);
  const db = {
    prepare(sql: string) { return { bind(...values: any[]) { return { execute: () => sqlite.prepare(sql).run(...values) }; } }; },
    async batch(statements: any[]) {
      sqlite.exec('BEGIN');
      try { statements.forEach(s => s.execute()); sqlite.exec('COMMIT'); } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  } as unknown as D1Database;
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), `https://api.privy.io/v1/users/${encodeURIComponent(uid)}`);
    assert.equal(init?.method, 'DELETE');
    return new Response(null, { status: ++calls === 1 ? 503 : 404 });
  };
  try {
    await assert.rejects(deleteAccount(db, uid, 'test-app', 'test-secret'));
    assert(sqlite.prepare('SELECT 1 FROM deleted_accounts WHERE user_hash=?').get(await hashToken(uid)));
    for (const table of ['proposals', 'responses', 'reports', 'chat_messages', 'chat_reactions']) assert.equal(sqlite.prepare(`SELECT count(*) as n FROM ${table}`).get()?.n, 0);
    assert.equal(sqlite.prepare('SELECT name FROM profiles WHERE id=?').get('bob')?.name, 'Bob');
    assert.equal(sqlite.prepare('SELECT owner FROM groups WHERE id=?').get('g')?.owner, 'bob');
    assert.notEqual(sqlite.prepare('SELECT invite FROM groups WHERE id=?').get('g')?.invite, 'old-invite');
    await deleteAccount(db, uid, 'test-app', 'test-secret');
    assert.equal(calls, 2);
  } finally { globalThis.fetch = original; sqlite.close(); }
});
