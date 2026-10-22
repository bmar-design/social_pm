# Social Groups — hosted MVP

The hosted application is the source in `hosted/`. The parent Python/static app
is the earlier prototype. Do not use the earlier localhost app to create groups.

The current release uses demo-only email or Solana wallet entry. No ChatGPT
sign-in is required. Email is format-checked but not verified or stored. Wallet
entry calls an injected Solana wallet's connect method and requests its public
address only; it does not request a signature or prove address ownership.
Neither label is used to recover or access someone else's account.

Every entry creates a random browser-scoped demo identity and a 30-day HttpOnly,
SameSite=Lax session cookie (Secure on HTTPS). Only the token hash is stored in
D1. Leaving the demo revokes that session. Re-entering the same email/wallet,
clearing cookies, or switching browsers starts a fresh profile; there is no
account recovery. Original ChatGPT-owned records remain isolated and are never
attached to unverified demo identities. Do not use this flow for real trading.

Public visitors can browse markets. Group reads and writes still enforce
membership for the demo session. Display names are visible to fellow members.

The D1 schema and generated SQL migrations are in `db/` and `drizzle/`.
Group data is shared and durable across browsers. Invite links allow their
holders to join, so send them only to intended members. Tail/Fade is an opinion,
not a trade. No wallet, deposit, withdrawal, or execution is implemented.

The public deployment uses the Sites manifest in `.openai/hosting.json`.
No fixture accounts, test groups, or local database files are uploaded.

Validation:
- `node node_modules/typescript/bin/tsc --noEmit`
- Sites build helper
- `node tests/groups.mjs` against the built local Worker on port 5190,
  after applying the local D1 migration. The test creates demo email and wallet sessions for synthetic users. It also
  verifies same-email isolation, session revocation and rejection of forged
  identity headers.

Tested: authentication rejection, membership enforcement, invite join, repeat
join, cross-user persistence, sharing a real Pascal market, request idempotency,
response changes/removal, invalid input and cross-origin write rejection.
Browser visual QA was not available in the authoring environment.

## College-football market pages

The catalog and share validation are restricted server-side to markets tagged
NCAA Football. Browse moneylines, spreads, totals and season markets, sorted by
24-hour contract volume. No unrelated markets are substituted if unavailable.

Market detail reads Pascal mark-price candles, public trades and top five book
levels in parallel; a failed section is marked unavailable independently. Range
controls use 1m, 5m, 1h and 1d candles for 1H, 1D, 1W and All (up to 500 days).
Samples are sorted, deduplicated and range-checked; missing points are never
invented. Large gaps are dashed. Change across chart samples is distinguished
from the provider's rolling 24-hour change. Public trades are shown without
wallet identifiers; group ideas are visible only through shared memberships.
Market detail refreshes every 20 seconds while visible, with a 10-second server
cache. The catalog cache lasts 15 seconds. These are snapshots, not streaming
execution quotes. Data source: https://docs.pascal.trade/

Additional validation: `node --experimental-strip-types tests/markets.mts`.
The group integration test verifies college-football scope, all four chart
periods, live candle/trade/book responses and membership-filtered market ideas.

## Game-first demo flow

The default landing page is now a chronological game list. All moneyline, spread
and total contracts with the same Pascal game ID are grouped into one matchup.
Game cards show indicative moneyline prices where available and summed 24-hour
contract volume, without double-counting sides. Team initials use decorative
colors rather than official logos. The game page has a market selector, two-sided
price chart, actual public activity and a demo buy ticket.

Demo buys require an explicit sizing/review/confirm sequence and a demo session.
They are recorded in D1, use a live asking-price snapshot and whole contracts,
round cost up to cents within the budget, and assume immediate full fills with
zero demo fees. There is no real balance, settlement, custody or exchange order.
Opposing demo buys are independent practice records, not Pascal net positions.
Records are retrievable from Your account -> Your demo plays.

After the simulated fill, sharing is optional. Select one to ten joined groups;
the share endpoint validates membership for every recipient and inserts all posts
in one batch. Posts reference the same simulated trade, have deterministic IDs
per trade/group, and are safe to retry. No group post is created by placing a
trade alone, and sharing never submits another trade. Existing demo sessions and
groups remain available.

Checked with `tests/game-flow.mts` (grouping and sizing), `tests/render.tsx`
(server-rendered cards/ticket), and `tests/groups.mjs` (complete trade/share flow,
private history, idempotency and membership). Native visual QA was blocked by
missing computer-use permissions; no browser visual check is claimed.

## Public-feed fallback

The hosted relay can receive errors even while Pascal's public endpoint is
reachable from visitors' browsers. Public market reads now fall back to Pascal's
CORS-enabled public APIs directly, with credentials omitted, bounded timeouts,
college-football filtering and the same normalization. Auth, groups and history
continue to use the app API. No proxy service or alternate data source is used.

For zero-money demo buys only, if server-side Pascal reads fail, the server may
use a validated, recent browser snapshot from that demo ticket. This snapshot is
client-supplied and is not a trusted or independently verified execution quote.
It must never be used for real trading, custody, financial balances or payouts.
The simulated trade, integer sizing and access checks still happen server-side.
Tickets require a current detail quote before enabling a demo buy. No stale or
fixture market catalog is silently substituted.

`tests/feed-fallback.mts` forces the hosted relay to fail and verifies public
CORS fallback, all detail sections, scope filtering and rejected stale snapshots.
