# Working hosted group app

The shared application is now in [hosted/](hosted/), with platform sign-in,
D1-backed private groups, invite links, Pascal market proposals and Tail/Fade
responses. The root Python app below is the earlier prototype; it does not
provide shared groups. See [hosted/GROUPS_README.md](hosted/GROUPS_README.md).

# Social Groups — mobile MVP concept

Run locally from this directory:

```sh
python3 server.py
```

Open http://127.0.0.1:5173. Python 3.10+ and Node (for optional checks) are sufficient; no packages or build are required. Use this server instead of a static file server: it provides the live Pascal API. Optional web fonts fall back to system fonts.

## New: live markets and simple account preview

Home now loads unresolved Pascal markets through a read-only server adapter. Sports is the default filter; search and category filters work across the fetched catalog. Open a market to see indicative prices, separate prices for each direction, settlement rules, and a fetch timestamp. Data refreshes every 30 seconds while the page is visible and you are not typing. The server caches reads for 15 seconds. Missing quotes stay unavailable. Refresh failures retain the previous snapshot with an explicit warning; no fictional fallback is presented as live data. Prices do not check executable size or include fees.

Your plays and Your account preview a dollar-based experience with available, in-play and pending balances, email onboarding, Add money, and Withdraw. These balances are illustrative. The preview does not collect email, create accounts, register wallets, accept deposits, or place live orders. Authentication, embedded wallets, funding, payouts and real execution require provider integration. The API rejects all writes.

Use **Group demo** on Home or the Groups tab for the original fictional social experience. Demo orders and their localStorage remain separate from live markets and the preview balances.

The server binds only to 127.0.0.1 and serves an explicit public-file allowlist. It is a local development server, not a production deployment. It requires outbound HTTPS access to data.pascal.trade. If an older static server uses localhost on IPv6, use the explicit 127.0.0.1 URL.

## Checks

```sh
python3 -m unittest discover -s tests -v
node tests/ui-smoke.cjs
node --check app.js
node --check live.js
```

The UI smoke check executes render logic with a minimal DOM stub; it is not a browser or visual layout test.

See [PASCAL_PLAN.md](PASCAL_PLAN.md) for the wallet, authorization and payment integration sequence.

## Original fictional group demo

## Review path
1. Open 928 Oakland from Groups.
2. Swipe right to Tail or left to Fade Alex’s proposal (or use the buttons). Set your own dollar unit size, choose ½u / 1u / 2u or a custom amount, then review and simulate a buy.
3. Open market activity; inspect mock friends’ buys/sells.
4. Share the market into one or more groups, optionally adding a note.
5. Return to the group; check Your archive and restore a proposal.
6. In You, toggle activity sharing; inspect Activity for simulated fills.

## Priorities
- P0: messaging-style group list; proposals; personal archive/restore; market sharing; independent Tail/Fade order review and simulated execution.
- P1: opt-in friend activity, illustrative price history, personal order history.
- Deferred: live chat, creation/invites/discovery, authentication, moderation, ranking, live pricing, real execution and backend.

## Assumptions
Existing membership and friendships are seeded. All people, fixtures, prices and activity are fictional. Tail buys the proposed outcome; Fade buys the opposing outcome. Binary contracts pay $1 if they win. Whole contracts are rounded down to stay within the selected budget; review shows actual simulated cost and total potential payout. Fixed prices, zero mock fees and immediate full fills simplify this prototype. Real markets can have spreads, fees, slippage and partial fills.

Executing or manually archiving a proposal affects only the current demo user. Pending proposals remain active until dismissed. Sharing a proposal never submits a trade. The opt-in setting controls market activity visibility, not visibility of group proposals. Friends’ activity is seeded, historical context; it does not imply live prices or recommendations.

Browser localStorage persists simulated orders, shares, archive, privacy choice and user-selected unit size. Swipes only open sizing review; they never execute an order. Unit size is optional and can be edited from a group, order review or profile. Reset demo clears them. The group demo makes no trading requests; Home makes read-only market requests. No real trades are made. Independent concept prototype.
