# ZZWS operations and security update

The frontend is reviewed locally at http://127.0.0.1:8080/ and /admin/. The public legacy main branch is a maintenance page; its current XLSX copies were removed. The protected frontend remains on security/server-auth-admin (draft PR #1). Do not re-publish legacy workbooks. Removing current files does not erase Git history, forks, downloads or caches. Restrict the legacy repository/history and rotate any still-used exposed credentials separately.

## Invariants verified

Existing user IDs, logins, active flags, complete profiles (including all organisation/address/contact variants) and persisted pricing rules were unchanged. Existing admins retain owner-equivalent access until an owner explicitly assigns another scope. No business user was reset or enrolled in MFA by the update. KP/Dealers selection and calculations are unchanged.

## Authentication

New/reset accounts require an unpredictable 48-hour single-use invitation. Only its SHA-256 hash is stored, bound to the user. Setup-only sessions expire in 10 minutes, carry the invitation hash, and cannot read catalogue/order APIs. Password setup validates the invitation again, serializes claims, revokes sessions, consumes the invitation, and preserves verified MFA requirements. Existing passwords continue to work.

Supabase TOTP enrollment is initiated by the administrator in the dashboard after password verification. The administrator must scan the QR code and verify the code themselves. Enrolled administrators must complete MFA on login. Five-minute pending Auth sessions are AES-GCM encrypted using a key derived from the server secret; challenge tokens are hashed, limited to five verification attempts and consumed on success. Enrollment revokes older application sessions. No plaintext Auth tokens or MFA secrets are written to user profiles or audit records. Lost MFA requires the established Supabase administrative recovery procedure; login-only fallback is deliberately unavailable.

Sensitive mutations require current-password confirmation valid for five minutes and bound to the current application session. The existing login throttle also covers this confirmation. Roles are enforced by the API, independently of hidden navigation. Owner, order manager, price operator and read-only scopes are stored separately from business profiles.

## Backups on this computer

Windows task: `ZZWS encrypted application backup`. Runs daily at 20:00 and at logon, with missed-start handling and retries. The computer must be on, online and signed into the Windows account that installed the task. Executable and script paths must remain valid. The scoped read-only backup credential expires on 2027-10-27; renew it before expiration. Its raw value is protected with Windows DPAPI in private-data/backup-config/key.dpapi and is never committed.

Archives: backups/server/*.zzwsbackup. Entire application snapshots are encrypted with CurrentUser DPAPI. last-status.json records success/failure and encrypted-file checksum. `server/backup-application.ps1 -VerifyLatest` decrypts and validates the latest archive without printing its contents. Archives are not automatically deleted. Preserve the Windows profile/recovery material: another computer/account cannot simply decrypt these archives.

This is an atomic application-data snapshot, not a full PostgreSQL disaster-recovery dump. It contains profiles, original/current orders, events, price versions, rules, carts, favourites and audit. It excludes Supabase Auth password hashes, MFA secrets, active sessions and infrastructure configuration. Auth recovery/re-creation and ID mapping require a separate controlled procedure; a native database dump is still required for full Auth recovery. Do not claim the full server was restore-tested. Local encrypted archive round-trip and scheduled execution were verified. Perform restoration into a separate project first.

## Frontend and help

Payment method was removed from current cart/order controls, new order payloads, server-normalized lines, confirmation template, comparison tables and exports. Old order JSON is retained; obsolete payment columns in imported files are ignored. Order prices and quantities still reconcile against the permitted current catalogue. Repeat-order uses currently available products and current prices.

The administrator dashboard, server-side order search/date filters, price-difference preview and optional catalogue columns are implemented. The guide is help/user-guide.html; contextual `?` links point to the corresponding section in both interfaces. No client backup/transfer controls were reintroduced.

Runtime Tailwind CDN was replaced with compiled Tailwind 3.4.17 CSS. SheetJS 0.20.3 is local and its SHA-384 integrity was checked. Licences are included. CSP allows local scripts and hashes for the existing inline scripts/handlers, blocks arbitrary inline scripts/eval, restricts connections to the API, and forbids objects/frames. Meta CSP cannot set frame-ancestors; configure that as an HTTP header when publishing on suitable hosting.

Rebuild CSS using the official Tailwind 3.4.17 CLI with scripts/tailwind.config.cjs and scripts/tailwind-input.css. Run scripts/build-csp.py after changing inline HTML scripts or handlers, then run browser checks. Never publish work/, private-data/, backups/, source XLSX or local credentials.

## Validation

79 automated tests, JavaScript syntax checks, mocked browser checks of cart/reorder/help/CSP/dashboard/admin/scoped navigation, live unauthenticated API denial checks and local encrypted backup verification. Actual TOTP activation must be completed by each administrator. Supabase leaked-password checking remains a plan/configuration limitation; MFA is not automatically activated for existing accounts.


## Post-review corrections (5.1)

- Confirmation previews are bound to an immutable order ID and revision. Switching/closing during a mutation is blocked; obsolete responses are discarded after reset. The API rejects drafts applied with another/missing order context. A successful bound apply is covered by both route and browser regression tests.
- Search and detail requests use generation guards, so older responses cannot replace a newer query or selected order.
- Viewer controls stay disabled after row rendering, deletion controls are absent, and handlers additionally reject read-only mutations. Server scope enforcement remains in place.
- Notification acknowledgement requires the displayed revision and only marks events up to that revision. Later concurrent events stay unread.
- Normal MFA login preserves other devices' opaque sessions and removes only its own successful login-gate attempt. MFA enrollment still revokes older sessions. Invitation/password reset protections are unchanged.
- Legacy brand identity normalization retains Unicode letters and numbers. This corrects Cyrillic brand isolation without modifying group price selection or stored policies/profiles.
- Native request and ZIP parser failures are converted into Armenian public messages. ZIP directory entry bounds are checked before creating typed arrays. Price-source and delivery-field labels in previews are Armenian.

Validation: 79 Node tests, including MFA/session/throttle behavior, Cyrillic brand isolation, notification revision races, bound confirmation routes, malformed archives and public error localization. Browser regression scenarios cover delayed searches/details, preview switching/reset, successful confirmation apply, viewer controls and Armenian labels. Run `node --test supabase/tests/*.test.mjs`. Run `node tests/ui/order-races.cjs` with Playwright installed, or set ZZWS_PLAYWRIGHT to the Playwright module path; ZZWS_TEST_URL defaults to the local preview. All fixtures use invented users and orders; business records are not modified by these tests.


## Receipt confirmation (5.2)

Client confirmation requires the dispatched (`completed`) status, current revision and an explicit intact/complete acknowledgement. It atomically stores the immutable Armenian statement, customer snapshot, timestamp, revision event, audit and one administrator notice, and closes the order as `received`. Closed orders cannot be edited through manual/file routes or the underlying update RPC. Each administrator acknowledges their own notice only after viewing the proof; polling refreshes the open interface every 15 seconds (no operating-system push).

The service-side gate serializes concurrent submissions for the customer and latches at three outstanding orders. One or two confirmations do not reopen it; all outstanding orders must be settled. Rejected orders are settled. An existing request ID is returned before checking the quota, so a lost response cannot create a duplicate or prevent retrying the same order. Owner-only global and per-client controls support indefinite or timed exemptions; global off dominates, expiration is automatic, and restoring control enforces the existing cycle. Controls are stored separately from user profiles. Receipt controls, proofs and notices are included in the encrypted application snapshot.

Client category is derived from existing group pricing sources, never written into the profile and never used to change prices. Wholesale-only maps to Dealers, KP sources map to KP. Existing user profiles, organization/address/contact variants and group price policies retain their baseline checksums.

Validation: 84 Node tests plus transactional SQL integration scenarios in `supabase/tests/receipt-integration.sql` (test records and sequence RESTART roll back). New browser scenarios in `tests/ui/receipts.cjs` use synthetic customers/orders and no real confirmations. Contextual Armenian help covers receipt, exemptions and client category. Deploy `receipt-confirmation.sql` then `receipt-backup.sql` before deploying the matching Edge API and frontend. The frontend remains in the draft protected-site branch; publication is separate.
