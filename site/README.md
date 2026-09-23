# The Loose Ends site

Landing page, sign-up, the device-code link page, and the hosted board UI.

```
npm install
npm run dev        # http://localhost:3000
```

Without Clerk or Supabase keys the site still runs: the landing, privacy and
`/app` pages work, and sign-in refuses rather than letting anyone through. In
production the missing keys are a hard error instead of a quiet fallback.

## What Aviv has to create

| Account | What's needed | Where it goes |
|---|---|---|
| **Clerk** | An application with Google + GitHub enabled | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` |
| **Supabase** | A project; run `supabase/schema.sql` in the SQL editor | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Vercel** | Import this repo, root directory `site/` | the env vars above |
| **Domain** | Point it at the Vercel project | `NEXT_PUBLIC_SITE_URL` |
| **PostHog** | A project in the **EU** region | `LOOSE_ENDS_POSTHOG_KEY` in the CLI's environment |

Until the domain exists, `NEXT_PUBLIC_SITE_URL` can be the Vercel preview URL —
it's the only place the domain is written down (and `SITE_URL` in
`cli/src/account.ts` for the CLI side).

## Routes

| Route | What it is |
|---|---|
| `/` | Landing: what it is, the three install steps, the privacy promise |
| `/privacy` | Exactly what is and isn't stored |
| `/app` | The board UI — a copy of `ui/index.html`, fetching from `http://localhost:4747` |
| `/link?code=XXXX-XXXX` | Approve a terminal that ran `board login` |
| `/sign-in`, `/sign-up` | Clerk |
| `POST /api/device/{start,poll,approve}` | The device-code flow |

`/app` is copied from the repo's `ui/index.html` by `scripts/sync-ui.mjs` on
every build — edit the original, never the copy.

## The device-code flow

1. `board login` → `POST /api/device/start` → a short user code plus a secret device code
2. The CLI opens `/link?code=…`; you sign in and approve
3. The CLI polls `POST /api/device/poll` with the *device* code and receives a token once

The token is minted at poll time and only its hash is stored, so the database
never holds anything replayable. The short code can't claim a token on its own.
