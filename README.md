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
  lemcal, so add them per campaign id in `MANUAL_BOOKINGS` in `api/stats.js`. Each entry has
  an `unnamed` count (demos booked before names were tracked) and a `demos` array, one item
  per Zapier "New demo booked" Slack post (`name`, `company`, `email`, `date`, plus optional
  `title` and `linkedinUrl` — Calendly gives neither, so take them from the lemlist lead when
  it has one, otherwise from the person's LinkedIn profile). Both are counted in the funnel;
  the named ones also appear in **Reply quality** with a "Booked · demo <day>" signal and a
  green *Demo booked* tag, so a lead who booked without ever replying on LinkedIn still shows
  up there. Only list someone in `demos` if they are not already part of `unnamed` — the two
  are added, not merged. Put the demo under the campaign the person is actually a lead in
  (check in lemlist): that is what keeps a campaign's funnel and Reply quality consistent.
- Launch dates: `LAUNCHED` in `api/stats.js`, one `"cam_…": "YYYY-MM-DD"` line per campaign.
  The dates come from the "Launch date" column of the Notion **Experiments** page; the main
  campaign isn't in that table, so its date is set by hand. Shown under the campaign
  title and in the Campaigns table of the All-campaigns view.
- The "View in lemlist ↗" links are built from `LEMLIST_TEAM_ID` +
  `/campaigns-v2/<campaignId>` (`campaignUrl()` in `api/stats.js`) — the same URL shape the
  Notion Experiments page uses.

## Notes / honesty

- The funnel is computed from lemlist's `/api/activities` endpoint
  (`linkedinInviteDone`, `linkedinInviteAccepted`, `linkedinReplied`, `meetingBooked`,
  `linkedinSent`), deduped by lead. It should match the lemlist UI closely but may differ
  by a hair from the in-app tiles, which use a slightly different aggregation.
- Reply sentiment is classified by a model, not a human. It is good at the obvious cases
  ("happy to find time" vs "no, thank you") and can be wrong on ambiguous ones — read the
  actual replies in lemlist before making a call on a borderline lead.
- "Response by job title" is live for every campaign: it buckets the `jobTitle` lemlist stores
  on each contacted lead's activity into role families and two seniority buckets, then counts
  accepted / replied per bucket from the same leadIds as the funnel. Titles are free text, so a
  bucket is a keyword match ("Chief Architect" is an Architect, not an Exec) — read it as an
  approximation, not a taxonomy.
- Still manual in `api/stats.js`: `MANUAL_BOOKINGS` (demos booked via Calendly/Zapier, which
  lemlist's `meetingBooked` doesn't count), `LAUNCHED` (launch dates, from the Notion Experiments
  page), and `leadsLoaded`.
- A demo booked outside lemlist has no reply text, so it is never sentiment-classified: its
  row is written in `MANUAL_BOOKINGS` and counts as a positive in the Reply quality pills and
  the funnel's "Positive reply" stage. Someone who both replied and booked keeps their
  classified reply row and is tagged *Demo booked* on it. In the All-campaigns view a person
  who appears in two campaigns is shown once, with the booked row winning.
- InMails sent (the sequence's "Manual task" step) are not a funnel stage: their recipients
  are already inside "Contacted", so the bar read as an extra top of funnel. The count lives
  on the Contacted stat card.
- Auth uses HTTP Basic with an empty username and the API key as the password
  (`Authorization: Basic base64(":" + KEY)`), per lemlist's API docs.
