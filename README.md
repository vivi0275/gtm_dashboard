# Tandem — Outbound Dashboard (self-hosted, always live)

A shareable dashboard for the outbound campaigns. Anyone with the URL sees it, no
Cowork and no link-sharing each time. Your lemlist API key stays on the server and
is never sent to the browser.

## How it works

- `index.html` — the dashboard. It calls `/api/stats` only. No secrets in the page.
- `api/stats.js` — a serverless function that calls the lemlist API with your key
  (read from an environment variable), computes the funnel per campaign, and returns JSON.
- Results are CDN-cached for ~15 minutes, so the team gets a fast page and lemlist
  isn't hammered.

## Deploy in ~5 minutes (Vercel, free tier)

1. Create a free account at vercel.com.
2. Put this `gtm-dashboard` folder in a GitHub repo (or run `npx vercel` from inside it).
3. Import the repo in Vercel (or follow the CLI prompts). No build step needed.
4. In Vercel → Project → Settings → Environment Variables, add:
   - Name: `LEMLIST_API_KEY`
   - Value: your lemlist API key (lemlist → Settings → Integrations → API)
5. Deploy. You get a URL like `https://tandem-outbound.vercel.app`. Share that once.

Netlify works the same way (put the function in `netlify/functions/stats.js` and set
the env var); the code is identical.

## Keep it private to the team (recommended)

A plain Vercel URL is public. To restrict it:
- Vercel Pro: turn on "Password Protection" or "Vercel Authentication" in Project Settings, or
- keep it public but unguessable, or
- put it behind your SSO / a simple shared password.

Never paste the lemlist key into `index.html` or any client-side file. It belongs only
in the server env var.

## Editing the dashboard

- Add / rename / reorder campaigns: edit the `CAMPAIGNS` array in `api/stats.js`.
- Demos booked outside lemlist (Calendly/Zapier): lemlist's `meetingBooked` only counts
  lemcal, so add manual counts per campaign id in `MANUAL_BOOKINGS` in `api/stats.js`.

## Notes / honesty

- The funnel is computed from lemlist's `/api/activities` endpoint
  (`linkedinInviteDone`, `linkedinInviteAccepted`, `linkedinReplied`, `meetingBooked`,
  `linkedinSent`), deduped by lead. It should match the lemlist UI closely but may differ
  by a hair from the in-app tiles, which use a slightly different aggregation.
- Reply sentiment (positive / not a fit) is not auto-classified here — the page lists the
  repliers and their message so you can read them. Classification stays a human call.
- Auth uses HTTP Basic with an empty username and the API key as the password
  (`Authorization: Basic base64(":" + KEY)`), per lemlist's API docs.
