# Social Plays for iPhone

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
