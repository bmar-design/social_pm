# Social Groups — mobile MVP concept

Run locally from this directory:

```sh
python3 -m http.server 5173
```

Open http://localhost:5173. No install or build required. All application files are local; optional web fonts fall back to system fonts if offline.

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

Browser localStorage persists simulated orders, shares, archive, privacy choice and user-selected unit size. Swipes only open sizing review; they never execute an order. Unit size is optional and can be edited from a group, order review or profile. Reset demo clears them. No API requests or real trades are made. Independent concept prototype.
