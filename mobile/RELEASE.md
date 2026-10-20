# Beta and live-money release gates

## Implemented in source

- Native navigation and screens with safe areas, scrolling, scalable text and
  minimum 48-point action controls.
- Verified SMS/email and Apple login integration, chosen names and linked recovery
  email. Server-verified identities and existing membership checks.
- Secure pending invitations and explicit join; custom scheme and web fallback.
- Games, current quote review, confirmed practice buys, private history and
  optional multi-group sharing. Request ID remains stable on confirmation retries.
- Post reports, blocking/unblocking and account deletion with provider retry.
- Development-only Solana wallet creation/message-signing diagnostic.
- EAS development, simulator, preview and production build profiles.

## Before the first two-person device test

- Supply public Privy app/client IDs, permanent bundle ID, scheme and API domain.
- Configure backend app ID and deletion secret and apply database migration.
- Verify actual host accepts/forwards Authorization to the Worker and can hold
  server secrets. A separate public API host may be needed if Sites dispatch
  reserves authentication headers; this is not established by local tests.
- Enable SMS/email and Apple in the Privy dashboard. Configure Apple credentials,
  matching app client, country coverage, delivery budgets and provider abuse limits.
- Initialize EAS project, Apple team and signing credentials, or install Xcode.
- Install a development build on two iPhones.

## Two-person acceptance pass

1. Alice verifies her phone, chooses a name, links and verifies a recovery email.
2. Alice creates a group and shares an invitation through Messages.
3. Bob opens the installed-app link, verifies his own account, chooses a name,
   then explicitly joins the pending group. Check cold and warm app launches.
4. Alice reviews and confirms a practice play, then shares to the group. Bob sees
   it and can Tail/Fade without submitting a buy.
5. Simulate a timeout after confirmation. Retry the same request and verify one
   record. Verify expired/changed/unavailable quotes and reconnect behavior.
6. Sign out and reinstall. Sign in with the same verified method; groups and
   history must return. Test recovery through the linked email on another device.
7. Test report, block, unblock, outsider membership rejection and private history.
8. Delete a sacrificial account. Check data removal, ownership transfer, token
   rejection, provider deletion and retry behavior. Never use a funded account.
9. In development, create a Solana wallet, test a message signature and verify
   the same wallet is recovered on the second device. Then separately validate
   Pascal's exact Ed25519 message bytes, key registration, expiry and revocation.

## Before external TestFlight / App Store

- Check smaller and larger iPhones, large Dynamic Type, VoiceOver, keyboard
  overlap, safe areas, unreliable network, background/resume and error recovery.
- Replace provisional app name/bundle ID; supply app icon, launch treatment,
  screenshots, support URL, privacy policy, terms and community rules.
- Add terms/community-rules acceptance before user-generated content is posted;
  assign moderation staff and implement an operator review/removal workflow.
- Complete App Privacy disclosures, age rating, SDK privacy review and Apple
  sign-in/deletion checks, including revocation requirements for Apple tokens.
- Complete Apple's encryption/export-compliance questionnaire for the actual
  wallet SDK configuration; no exemption declaration is prefilled.
- Resolve/review dependency audit: the initial Expo SDK 55 tree reports 34
  advisories (23 high, 11 moderate), largely development/build tooling; compatible
  `npm audit fix` does not resolve them. No forced SDK downgrade was applied.
- Build with `npx eas-cli build --profile production --platform ios`; upload with
  `npx eas-cli submit --platform ios --latest` only after credentials and beta
  metadata are ready. No binary has been built or uploaded in this work.

## Real money remains a separate integration

Follow `../PASCAL_PLAN.md`. Confirm venue/provider eligibility and launch regions,
wallet ownership and recovery, exact Pascal signing, trading-key protection,
funding/payout support, provider webhooks, reconciliation, quote bounds,
idempotency and position netting. Validate product classification and App Store
requirements for the exact launch model. No live-order, deposit or withdrawal
endpoint was introduced. Diagnostic signing is not proof of Pascal compatibility.
