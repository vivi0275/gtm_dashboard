# Tandem — Outbound Dashboard (self-hosted, always live)

A shareable dashboard for the outbound campaigns. Anyone with the URL sees it, no
Cowork and no link-sharing each time. Your lemlist API key stays on the server and
is never sent to the browser.

## How it works

- `index.html` — the dashboard. It calls `/api/stats` only. No secrets in the page.
- `api/stats.js` — a serverless function that calls the lemlist API with your key
  (read from an environment variable), computes the funnel per campaign, classifies
  reply sentiment with Claude, and returns JSON.
- Results are CDN-cached for ~15 minutes, so the team gets a fast page and lemlist
  isn't hammered.
- The page polls `/api/stats` every 5 minutes on its own — leave the tab open and it
  stays current, no reloading. Most polls are served by the CDN, so lemlist still only
  sees ~4 origin refreshes an hour. Polling pauses on a hidden tab and catches up when
  you come back. It only re-renders when the server actually returned newer data, so
  your selected campaign and scroll position survive a refresh.

## Reply sentiment (automatic)

Sentiment, signal, and the one-line "read" for each reply are classified by Claude
(`claude-opus-5`) from the reply text — every replier is covered, including new ones,
with no editing. Classifications are cached by a hash of the reply text, so an unchanged
reply is never re-classified and steady state costs nothing.

Set `ANTHROPIC_API_KEY` (server-side env var, same place as the lemlist key). Without it
— or if the call fails — the dashboard falls back to the hand-written `CURATED.replyQuality`
block in `api/stats.js` and shows a warning under the table. The funnel's "Positive reply"
stage is the count of replies classified `positive`.

## Deploy in ~5 minutes (Vercel, free tier)

1. Create a free account at vercel.com.
2. Put this `gtm-dashboard` folder in a GitHub repo (or run `npx vercel` from inside it).
3. Import the repo in Vercel (or follow the CLI prompts). No build step needed.
4. In Vercel → Project → Settings → Environment Variables, add:
   - `LEMLIST_API_KEY` — your lemlist API key (lemlist → Settings → Integrations → API)
   - `ANTHROPIC_API_KEY` — from console.anthropic.com, for automatic reply sentiment
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
- Reply sentiment is classified by a model, not a human. It is good at the obvious cases
  ("happy to find time" vs "no, thank you") and can be wrong on ambiguous ones — read the
  actual replies in lemlist before making a call on a borderline lead.
- Still manual in `api/stats.js`: `MANUAL_BOOKINGS` (demos booked via Calendly/Zapier,
  which lemlist's `meetingBooked` doesn't count), `perStep`, `byJobTitle`, and `leadsLoaded`.
- Auth uses HTTP Basic with an empty username and the API key as the password
  (`Authorization: Basic base64(":" + KEY)`), per lemlist's API docs.
