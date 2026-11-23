# MongoDB migrations

Run pending migrations explicitly before deploying code that depends on their data changes:

```powershell
npm run migrate
```

The command reads `MONGO_URI` from the backend environment and records completed versions in
the `schema_migrations` collection. It does not run automatically during API startup. The
existing Sprint 4 migration and Sprint 6–10 financial/index migration are available through
`npm run migrate`; the Sprint 4 migration is also available through `npm run migrate:sprint4`.

Add future migrations as `src/migrations/NNN-short-description.js` modules that export a
stable `version` and an idempotent `up({ Campaign })` function. Apply and verify a migration
against a backup or isolated database before production; do not point test suites at a
production URI.

## Creator payment detail encryption

Creator payment details require a 32-byte AES-256-GCM key encoded as Base64. Configure either:

- `PAYMENT_DETAILS_ENCRYPTION_KEY` for a single-key installation; or
- `PAYMENT_DETAILS_ENCRYPTION_KEYS` as a JSON object of key versions to Base64 keys, plus
  `PAYMENT_DETAILS_ACTIVE_KEY_VERSION` for the version used for new records.

Retain older encryption key versions while records still use them. Set a separate stable
32-byte Base64 `PAYMENT_DETAILS_FINGERPRINT_KEY` before rotating/retiring encryption keys so
duplicate payment-method detection stays consistent. Never commit these secrets or print them
in logs. Missing or invalid encryption configuration makes payment-method creation and admin
decryption unavailable; the API returns a service error instead of storing plaintext.

`MIN_CREATOR_WITHDRAWAL_USD` defaults to 10. `CREATOR_COMMISSION_RATE` defaults to 0 until the
business commission is explicitly configured. `MAX_VERIFIED_VIEWS_PER_HOUR` is optional; when
unset, rapid-growth fraud flags are not generated because the source specification gives no
numeric threshold.
