# Pascal integration and simple account experience

Decision: use Pascal for execution. Keep the primary experience in dollars,
with email sign-in, Add money, Tail/Fade, confirmation, and Withdraw.
Trading remains simulated. Native Pascal account setup and standard order-signing
utilities are now implemented behind a configuration flag; builder order submission
is blocked by missing published permit encoding. See [implementation status](mobile/PASCAL.md).

## User experience

- Browse and read groups before signing in. Require sign-in to share or trade.
- Sign in with email; create a user-controlled embedded Solana wallet behind
  the account. Verify its Ed25519 signing and recovery support in a spike.
- Explain and authorize trading access during account setup. Register a
  short-lived, revocable Pascal trading key with the wallet owner signature.
- Show Available to trade, In plays, and Pending separately. Display USD
  equivalents, with accessible disclosure that trading collateral is USDC,
  not an insured bank balance. Do not label a pending deposit spendable.
- Add money through an approved payment provider. Display the amount received,
  total fee, and expected availability before payment. Bank/card availability,
  regional eligibility, minimums, refunds, and payout support must be verified;
  these are not established Pascal API features.
- Preserve Tail/Fade -> amount -> review -> explicit confirmation. Review shows
  the exact outcome, total spend including fees, estimated payout including
  stake, maximum loss, and any effect on an existing position.
- Use normal app confirmation for trades after trading authorization; require
  stronger authentication for withdrawals and account recovery.
- Offer Withdraw with a verified payout destination, quote and pending status.
  Cash withdrawal requires a separate off-ramp; Pascal collateral withdrawal
  alone is not a bank payout.

## Architecture

Browser -> application API -> Pascal read/write APIs and account streams.
Embedded wallet handles owner-authorized operations. A payment integration
handles fiat conversion and payouts. Postgres stores social state, wallet
public keys, intents and reconciled provider events, never owner private keys.

Keep Pascal-specific order construction in a provider adapter. Separate
account/signing and payment adapters so provider choices remain replaceable.
Do not assume Pascal's own email login is an embeddable third-party login API.

Proposed application operations:

- GET /api/markets and GET /api/markets/:id
- POST /api/order-quotes (side, budget, current position; expires quickly)
- POST /api/orders (accepted quote and idempotency key)
- GET /api/orders/:id and GET /api/portfolio
- POST /api/funding-sessions and POST /api/withdrawal-quotes
- POST /api/withdrawals (fresh owner authorization)

Quotes are estimates with enforceable execution bounds, not guaranteed fills.
Validate market status, tick/size rules, fee schedule, account authorization,
free collateral and quote freshness before submitting. Never retry an ambiguous
submission blindly: reconcile its client/provider identifier first. Maintain
submitted, open, partially filled, filled, cancelled, rejected and unknown
states; deduplicate fills and restore state from account snapshots after gaps.
Use decimal or fixed-point arithmetic for money and contract quantities.

## Pascal semantics

Pascal uses a single signed position per market, not independent YES/NO tokens.
Buying Yes maps to BID; buying No maps to ASK at the complementary Yes price.
For executable No quotes use the actual Yes bids, adjusted for depth and fees.
Buying the opposing side nets against an existing position. Explain reductions
or reversals before confirming. Selling an existing position uses reduce-only.
Fade always refers to the proposal's specified side and contract; store that
side explicitly rather than inferring it from the displayed team name.

Trading keys can place/cancel orders; wallet signatures authorize withdrawals,
deposit-address registration and trading-key lifecycle. Use a separate trading
key per user/session, expire and revoke it, and keep it out of localStorage,
logs, analytics and ordinary database records. Choose a protected signer design
after validating embedded-wallet support. Application spending limits are not
necessarily enforced by Pascal and must not be presented as protocol guarantees.

## Delivery sequence

1. Verify production sports inventory, book depth at small stakes, venue access
   requirements, embedded-wallet compatibility and fiat provider acceptance.
2. Add a server-side read adapter and live market UI with trading disabled;
   retain clearly separate fictional demo fixtures for prototype review.
3. Add authentication, server-enforced group membership and activity privacy.
4. Validate wallet creation, owner signatures, trading-key registration/revocation,
   account recovery and balance reconciliation in a controlled integration.
5. Add funding/payout provider sessions and verified webhooks; reconcile actual
   Pascal collateral credits rather than relying on payment success alone.
6. Enable bounded, explicitly confirmed orders and reconcile fills/positions.

Acceptance scenarios include expired quotes, insufficient depth/collateral,
duplicate confirmation, timeouts after submission, stream disconnects, expired
keys, opposing-position netting, pending deposits and failed withdrawals.
Keep all funding/auth screens marked as previews until their providers work.

## Source

Verified against https://docs.pascal.trade/ on 2026-10-15, particularly
Architecture, Onboarding, Yes and No Display, Authentication and Request
Authorization, Create A Trading Key, and Request Signing. Provider capabilities
must be checked again during integration.
