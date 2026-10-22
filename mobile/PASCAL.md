# Pascal integration status

Implemented on 2026-10-22 from Pascal's public documentation. This is an account
integration and verified standard-order signer, not completed live-money trading.

## Enable native account setup

Set `EXPO_PUBLIC_PASCAL_ENABLED=true` in the mobile environment, then rebuild.
Profile → Account settings → Pascal account provides wallet creation, account
snapshots, deposit-address registration, and 24-hour trading-key creation/revocation.
The feature is disabled by default and excluded from web/UI preview.

Set `EXPO_PUBLIC_PASCAL_BUILDER_PUBLIC_KEY` and
`EXPO_PUBLIC_PASCAL_BUILDER_FEE_RATE` for the operator's public builder account.
The fee rate is a decimal (0.010000 = 1%), applied to
`contracts × price × (1 − price)`, not directly to stake. No fee is selected by
default. Pascal requires the registered builder to have $100 free collateral;
self-attribution is rejected. No operator wallet or funding has been created.

Private trading seeds are generated with Expo Crypto and stored per owner in
native SecureStore with device-only, unlocked accessibility. They never enter
public environment variables, app API requests, logs, analytics or localStorage.
The owner wallet signs the exact JSON message; its signature is locally verified
before submission. The nonce is persisted before signing. Lost device keys expire;
wallet recovery and revocation from a second device still need acceptance testing.

Each request goes directly to Pascal's production hosts, retaining venue account
and geographic restrictions. Writes are never automatically retried. An ambiguous
key registration retains the saved key for reconciliation/revocation. Canceling a
wallet prompt before submission removes the prepared local key.

## Builder signing blocker

The REST API documents `builder_info` as signed order data, but the published
binary Place Order signing table does not specify how to encode it. It labels
bytes 120–151 and 184–187 reserved/zero and says the offchain digest is a constant.
The official Python quickstart also has no builder parameter or builder vector.
The public web bundle inspected on this date did not expose a builder request
encoder. Do not infer layout from reserved bytes or attach a fee after signing.

`orderMessage` deliberately rejects any builder-bearing order. Standard no-builder
IOC limit-order signing is implemented and tested, but is not connected to the
practice trade controls. **No live order submission UI has been enabled.**

To finish: obtain an authoritative builder permit encoding and test vector, then
add executable depth/fee quotes, builder eligibility checks, explicit order review,
submission and durable order-ID reconciliation, real fills/position history,
position-netting disclosures, withdrawal/recovery and account-deletion protection.
Bank/card funding requires a separate provider. Lays remain practice-only.

## Verification

`npm run typecheck`, `npm test`, and `npm run export:ios` pass locally.
The tests match Pascal's published create/revoke/referral-deposit messages and
Ed25519 signatures. The IOC test compares against the official binary vector with
only the intended IOC/no-replace/no-expiry/no-flags differences. Tests cover
complementary No prices, decimal precision, invalid inputs, fee caps, blocked
builder signing, geographic errors and no retry after an ambiguous submission.

No live keys, deposits or trades were submitted, and no physical-device signing,
wallet recovery or withdrawal acceptance has been performed. Keep setup wallets
unfunded until those checks and funded-account deletion safeguards are complete.

Sources:
- https://docs.pascal.trade/#builder-codes
- https://docs.pascal.trade/llms/request-signing.txt
- https://docs.pascal.trade/llms/api.txt
- https://github.com/Pascal-Research-Inc/pascal-python-quickstart/blob/main/pascal_quickstart/signing.py
