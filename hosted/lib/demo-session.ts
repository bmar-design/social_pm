// Demo identity is a random browser session, never an email/wallet ownership claim.
// Existing ChatGPT-owned records are not attached to unverified demo profiles.
export const COOKIE='sg_demo_session';
export const hashToken=async(token:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(n=>n.toString(16).padStart(2,'0')).join('');
export function cookie(token:string,req:Request,maxAge=2592000){return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(req.url).protocol==='https:'?'; Secure':''}`}
function readToken(req:Request){return req.headers.get('Cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||''}
export async function demoUser(req:Request,db:D1Database){const token=readToken(req);if(!/^[a-f0-9]{64}$/.test(token))return null;const s=await db.prepare('SELECT user_id FROM demo_sessions WHERE token_hash=? AND expires>?').bind(await hashToken(token),Date.now()).first<{user_id:string}>();return s?{userId:s.user_id,fullName:null}:null}
export async function revokeSession(req:Request,db:D1Database){const token=readToken(req);if(token)await db.prepare('DELETE FROM demo_sessions WHERE token_hash=?').bind(await hashToken(token)).run()}
export function walletAddress(value:unknown){if(typeof value!=='string'||!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value))return false;const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';let n=BigInt(0);for(const c of value)n=n*BigInt(58)+BigInt(alphabet.indexOf(c));let bytes=0;while(n>0){bytes++;n>>=BigInt(8)}return bytes+(value.match(/^1*/)?.[0].length||0)===32}
