import { hashToken } from './demo-session.ts';

export async function deleteAccount(db: D1Database, userId: string, appId: string, secret: string) {
  const q = (sql: string, ...values: string[]) => db.prepare(sql).bind(...values);
  // The tombstone and local erasure commit together. Old signed access tokens
  // are denied immediately, even if Privy deletion times out. Retrying this
  // operation is safe; the delete endpoint alone accepts tombstoned identities.
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO deleted_accounts(user_hash,created) VALUES(?,?)').bind(await hashToken(userId), Date.now()),
    q('DELETE FROM responses WHERE user_id=? OR proposal_id IN (SELECT id FROM proposals WHERE author=?)', userId, userId),
    q('DELETE FROM reports WHERE reporter=? OR proposal_id IN (SELECT id FROM proposals WHERE author=?)', userId, userId),
    q('DELETE FROM chat_reactions WHERE user_id=? OR target_id IN (SELECT id FROM chat_messages WHERE author=?) OR target_id IN (SELECT id FROM proposals WHERE author=?)', userId, userId, userId),
    q('DELETE FROM chat_messages WHERE author=?', userId),
    q('DELETE FROM proposals WHERE author=?', userId),
    q('DELETE FROM demo_trades WHERE user_id=?', userId),
    q('DELETE FROM demo_sessions WHERE user_id=?', userId),
    q('DELETE FROM blocks WHERE user_id=? OR blocked_id=?', userId, userId),
    q('DELETE FROM members WHERE user_id=?', userId),
    q("UPDATE groups SET owner=COALESCE((SELECT user_id FROM members WHERE group_id=groups.id ORDER BY joined,user_id LIMIT 1),'deleted'), invite=lower(hex(randomblob(36))) WHERE owner=?", userId),
    q('DELETE FROM profiles WHERE id=?', userId),
  ]);
  const response = await fetch(`https://api.privy.io/v1/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE', headers: { 'privy-app-id': appId, Authorization: `Basic ${btoa(`${appId}:${secret}`)}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok && response.status !== 404) throw Error('Provider deletion pending');
}
