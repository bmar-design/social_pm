# Social Plays for iPhone

## Just preview the screens on your phone

Run `npm run preview`, keep the Mac and iPhone on the same Wi-Fi, then open
`http://<your-Mac-Wi-Fi-IP>:8083` in iPhone Safari. This renders the actual React
Native screens through React Native Web with fictional games, groups and plays.
It starts signed in as a sample profile. No backend, Privy setup, Apple account
or native build is needed. Changes reset when the preview server/page reloads.

The preview command enables a dedicated mock API and Metro aliases for auth and
storage. Normal `npm start`, iOS exports and production builds retain real Privy
authentication. Keep `EXPO_PUBLIC_UI_PREVIEW` out of production environments.

The mobile layout has Home, Groups and Profile icon tabs. Home is restricted to
NCAA Football and shows team logos and both market percentages. Market detail
shows two-sided probability history with period controls. Preview histories are
illustrative; connected mode uses API candles and displays an unavailable state
when history is missing. Posts have a streamlined Tail/Fade layout without visible
block/report buttons. Those backend endpoints remain available. Play history is
under Profile; account settings expand separately.

Native Expo/React Native application using the existing `hosted/` API. This is a
practice-trading beta foundation, not a live-money release. The native UI includes
games, private groups, opinions, practice buy/review/confirm, optional sharing,
history, verified login, recovery email, post reporting, blocking and deletion.
The wallet diagnostic appears only in development builds.

## Configure and run

1. Copy `.env.example` to `.env` and enter the HTTPS backend URL, public Privy app
   ID and **mobile** client ID. Choose your permanent bundle ID and URL scheme.
   Public variables are bundled into the app. Never put an app secret here.
2. In Privy, enable SMS and email login, configure Apple login and create an iOS
   app client matching the bundle ID and redirect scheme. Configure SMS delivery,
   supported countries and abuse limits. Use the same Privy application for all
   clients that should share accounts. SDK sessions use Expo SecureStore.
3. Configure `PRIVY_APP_ID` on the backend and `PRIVY_APP_SECRET` as a server-only
   secret. The secret is required only for account deletion. Apply the D1 migration
   `0003_tough_adam_destine.sql` using the deployment host's supported workflow.
   The API must be publicly reachable by native clients; an owner-private Sites
   login page cannot be bypassed with a Privy token. Do not embed a Sites service
   token in the app. Hosted external-auth/header forwarding and secret bindings
   still need verification on the actual deployment before release.
4. Run `npm ci`, then `npm start`. Use a development build, not Expo Go.
5. With Xcode installed, `npm run ios` builds locally. Alternatively, initialize
   an Expo EAS project and run `npx eas-cli build --profile development --platform
   ios`. Physical-device distribution needs an Apple Developer membership and
   registered devices. EAS project/team setup and signing have not been performed.

The repository uses Expo SDK 55 with its matched native package versions and
Privy's documented Metro resolver settings. `metro.config.js` watches the existing
pure TypeScript market models under `hosted/lib`; include both directories when
building from CI. Do not upload only the mobile subdirectory without those files.

## Invites and accounts

`socialplays://invite/<token>` opens a group invitation. The app also accepts
`https://<api-domain>/?invite=<token>` pasted into Groups. The pending token is
stored in SecureStore through login and name setup; joining requires an explicit
tap. Sharing includes the web fallback and app link. Automatic HTTPS universal
links are **not configured**: they need a permanent domain, Apple team ID,
associated-domains entitlement and a hosted AASA file.

The backend verifies ES256 JWT signature, issuer, audience, expiry and subject
using Privy's JWKS. Verified Privy DIDs form a distinct account namespace. Existing
browser demo accounts are not automatically migrated or attached by email.
Link a recovery email while signed in; separately logging in with an unlinked
method can create another account. Apple linking and account merges need an
explicit product flow before adding more sign-in providers.

Deletion removes the local profile, posts, responses, reports, blocks, memberships
and practice plays, transfers group ownership to a remaining member and rotates
owned-group invites. A SHA-256 identity tombstone prevents old JWTs from restoring
deleted data. It then deletes the Privy user. Provider failures show a retry;
the delete endpoint remains available to the signed-in deleted identity for this
purpose. Operators must handle unresolved deletion requests. Privy archives
disassociated wallet data; deletion does not erase blockchain records. Do not
fund diagnostic wallets. Funded accounts require export/withdrawal and fresh
authentication design before enabling real money.

Reports are stored in D1 `reports`. Blocking filters the blocked author's posts
on the server and can be reversed in You. Before external beta, assign a moderator,
review reports regularly, provide a real support contact and implement the
operator's removal/escalation workflow. These controls alone do not establish
complete App Store moderation compliance.

## Validation

```sh
npm test
npm run typecheck
npm run export:ios
```

Backend checks from `hosted/`:

```sh
node node_modules/typescript/bin/tsc --noEmit
node --experimental-strip-types --test tests/mobile-auth.mts tests/account-deletion.mts
npm run build
```

`hosted/tests/mobile-api.mjs` also verifies membership enforcement, reporting,
block/unblock filtering, cross-origin cookie-write rejection and invalid bearer
rejection against an isolated built Worker on port 5192. Apply all migrations to
`.wrangler/mobile-test`, start that Worker with the same persistence directory,
then run `node --import ./scripts/sites-env.mjs tests/mobile-api.mjs`.

Verified locally on 2026-10-20: mobile and backend TypeScript, iOS JavaScript
export, invite parsing tests, cryptographic authentication tests, account deletion
tests, backend production build and the isolated API integration test all passed.

An iOS JS export is not a signed native build or device test. No simulator,
physical iPhone, live SMS/Apple login, recovery, or live Pascal signing acceptance
has been verified in this environment. See [release checklist](RELEASE.md).

## Provider references

- [Privy Expo installation and Metro configuration](https://docs.privy.io/basics/react-native/installation)
- [Privy mobile setup](https://docs.privy.io/basics/react-native/setup)
- [Privy access tokens](https://docs.privy.io/authentication/user-authentication/access-tokens)
- [Privy user deletion behavior](https://docs.privy.io/user-management/users/managing-users/deleting-users)
- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)

## Group chat

Chat supports text messages and 👍 ❤️ 😂 🔥 👀 👎 reactions on messages and proposals.
Messages and proposals appear together chronologically; tapping a proposal opens
its Positions detail. Proposal sharing stays in the post-trade prompt. Open chats
refresh every four seconds. The API returns the latest 100 messages and proposals.

Apply `hosted/drizzle/0004_group_chat.sql` before running connected chat against
a backend. The UI preview uses in-memory sample messages and reactions; reload
resets them.

## Profile performance

Profile includes P&L, Positions, and History tabs. Unrealized P&L uses available
market marks and actual purchase cost; unpriced holdings retain their cost and
are excluded from priced totals. All records are practice buys. Realized P&L and
win rate remain unavailable until sells and settlement records are supported.
The capital chart displays purchase cost, not historical P&L. History loads all
backend pages (200 trades per page), supports filtering and receipts, and exports
CSV through a web download or native sharing. Deploy the updated history API
with the mobile changes to load more than the previous 100-trade limit.

## Glass navigation

The floating navigation, Chat/Positions switch, and chat composer use native
`expo-glass-effect` on supported iOS builds, with a solid fallback for older
platforms and Reduce Transparency. Safari preview uses CSS backdrop blur with
an opaque fallback. Rebuild the native development client after installing the
new module (`npm run ios`); restarting Metro alone does not add native modules.
