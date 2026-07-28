// Serverless proxy: calls the lemlist API with a SERVER-SIDE key and returns
// a computed funnel per campaign. The key never reaches the browser.
//
// Set LEMLIST_API_KEY in your Vercel project settings (Environment Variables).
// Optional: edit MANUAL_BOOKINGS below for demos booked outside lemlist (Calendly/Zapier).

const LEMLIST_BASE = "https://api.lemlist.com/api";

// The campaigns shown on the dashboard. Edit names/ids/signals here.
const CAMPAIGNS = [
  { id: "cam_w8MSGFGBJeFHh8qRA", name: "First campaign", role: "main", signal: "Live campaign" },
  { id: "cam_oCLPvtEyumvDyqECo", name: "Rocketlane/Asana", role: "experiment", signal: "Signal: tech stack (TheirStack)" },
  { id: "cam_baQ4bryphKccydJmo", name: "First implementation hire", role: "experiment", signal: "Signal: first impl job post" },
  { id: "cam_NmKvkhsnFu7eiSLYr", name: "Growing implementation team", role: "experiment", signal: "Signal: growth impl job post" },
  { id: "cam_vrMNEtXmxAG2LX4GG", name: "Implementation-heavy verticals", role: "experiment", signal: "Signal: Clay stacked signals" }
];

// Demos booked outside lemlist (Calendly/Zapier). lemlist's meetingBooked only
// counts lemcal, so add manual ones here per campaign id.
const MANUAL_BOOKINGS = {
  "cam_w8MSGFGBJeFHh8qRA": 5
};

// ---------------------------------------------------------------------------
// CURATED ANALYSIS — data lemlist's API does NOT provide (reply sentiment,
// per-step performance, job-title breakdown, leads loaded). Edit freely.
// Keyed by campaign id. Any campaign without an entry simply hides these
// sections. Funnel counts and reply lists stay LIVE from lemlist above.
//   tone: "positive" | "warm" | "cold"  -> drives colors and the funnel's
//   "Positive reply" stage (= count of tone "positive").
// ---------------------------------------------------------------------------
const CURATED = {
  "cam_w8MSGFGBJeFHh8qRA": {
    leadsLoaded: 240,
    replyQuality: {
      asOf: "2026-07-24",
      note: "12 replies now, 6 positive. Both demos booked this week are FDEs (Ben Xiao @ Strala, Emile Cohen @ Tribe AI), so the builder persona is converting too, not just Impl leaders. Meanwhile two Implementation Directors (Kathern Brooks, Talal Said) passed.",
      rows: [
        { name: "Karim Kallala",     company: "Attention",      title: "Head of FDE",                read: "Happy to find time to learn more.",     signal: "Positive",             tone: "positive" },
        { name: "Stan Parkford",     company: "Swiftly",        title: "Director of Implementations", read: "Looked at the site, interested.",       signal: "Positive · pilot",     tone: "positive" },
        { name: "Geoff Genzano",     company: "Courier Health", title: "Director of Implementation",  read: "Got double booked, will reschedule.",   signal: "Positive · rebooking", tone: "positive" },
        { name: "Meghna Shekhar",    company: "Magical",        title: "AI FDE",                     read: "Setting time next week.",               signal: "Positive · reconnect", tone: "positive" },
        { name: "Ben Xiao",          company: "Strala",         title: "FDE",                        read: "Meeting set, rescheduled to 10:30.",    signal: "Booked · demo Jul 24", tone: "positive" },
        { name: "Emile Cohen",       company: "Tribe AI",       title: "FDE",                        read: "Booked a slot, shared his email.",      signal: "Booked · demo Jul 29", tone: "positive" },
        { name: "Tripp Smith",       company: "Maybern",        title: "SVP Forward Deployed Eng.",  read: "Wants a clear diff vs Linear/Everhour.", signal: "Engaged · skeptical", tone: "warm" },
        { name: "Christian Yongwhan", company: "Probook",       title: "Chief Architect",            read: "\"Not sure.\"",                         signal: "Lukewarm",             tone: "warm" },
        { name: "Christie Green",    company: "Tavily",         title: "VP CS",                      read: "Product is API-based, no fit.",         signal: "Not a fit",            tone: "cold" },
        { name: "Kathern Brooks",    company: "Posh",           title: "Director of Implementation",  read: "\"No, thank you.\"",                    signal: "Not interested",       tone: "cold" },
        { name: "Talal Said",        company: "Promise",        title: "Solutions & Delivery",       read: "\"No, thank you.\"",                    signal: "Not interested",       tone: "cold" },
        { name: "Raghav Dixit",      company: "Tenex",          title: "FDE",                        read: "Has an internal tool.",                 signal: "Not a fit",            tone: "cold" }
      ]
    },
    perStep: [
      { step: "LinkedIn invitation",        type: "Invite",  sent: 237, replied: 1 },
      { step: "Msg 1 — Intro",              type: "Message", sent: 91,  replied: 8 },
      { step: "Follow-up 1 — Proof",        type: "Message", sent: 74,  replied: 4 },
      { step: "Follow-up 2 — Bottleneck Q", type: "Message", sent: 38,  replied: 0 },
      { step: "InMail — if not accepted",   type: "InMail",  sent: 0,   replied: 0 }
    ],
    byJobTitle: {
      batchNote: "Jul 17 batch, 128 contacted",
      footer: "From the Jul 17 batch (128 contacted). The campaign has since grown to 237 contacted, so this breakdown is due for a re-enrichment.",
      roles: [
        { name: "FDE",              contacted: 51, accepted: 21, replied: 4, tag: "responds" },
        { name: "Implementation",   contacted: 32, accepted: 15, replied: 2, tag: "responds" },
        { name: "Solutions / SE",   contacted: 22, accepted: 10, replied: 0 },
        { name: "Customer Success", contacted: 8,  accepted: 2,  replied: 0 },
        { name: "Deployment",       contacted: 7,  accepted: 2,  replied: 0 },
        { name: "Other",            contacted: 5,  accepted: 3,  replied: 0 },
        { name: "Architect",        contacted: 3,  accepted: 1,  replied: 0 }
      ],
      seniority: [
        { name: "Leaders (Head / Dir / VP / Chief)", contacted: 67, accepted: 31, replied: 4 },
        { name: "ICs / individual contributors",     contacted: 61, accepted: 23, replied: 2 }
      ]
    }
  },
  "cam_oCLPvtEyumvDyqECo": { leadsLoaded: 28 },
  "cam_baQ4bryphKccydJmo": { leadsLoaded: 9 },
  "cam_NmKvkhsnFu7eiSLYr": { leadsLoaded: 18 },
  "cam_vrMNEtXmxAG2LX4GG": { leadsLoaded: 59 }
};

function authHeader() {
  const key = process.env.LEMLIST_API_KEY;
  if (!key) throw new Error("LEMLIST_API_KEY is not set");
  return "Basic " + Buffer.from(":" + key).toString("base64");
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

// GET a lemlist URL, retrying on 429 (rate limit) with exponential backoff.
// Honors the Retry-After header when lemlist sends one.
async function getWithRetry(url, label) {
  const maxAttempts = 6;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const r = await fetch(url, { headers: { Authorization: authHeader() } });
    if (r.status === 429) {
      if (attempt === maxAttempts) throw new Error("lemlist 429 on " + label + " (rate limited after retries)");
      const retryAfter = parseInt(r.headers.get("retry-after"), 10);
      const waitMs = (retryAfter > 0 ? retryAfter * 1000 : Math.min(1000 * Math.pow(2, attempt), 8000));
      await sleep(waitMs);
      continue;
    }
    if (!r.ok) throw new Error("lemlist " + r.status + " on " + label);
    return r.json();
  }
}

// Fetch every activity of a given type for a campaign (paginated).
async function fetchActivities(campaignId, type) {
  const out = [];
  const limit = 100;
  for (let offset = 0, page = 0; page < 40; offset += limit, page++) {
    const url = LEMLIST_BASE + "/activities?campaignId=" + campaignId +
      "&type=" + type + "&limit=" + limit + "&offset=" + offset;
    const batch = await getWithRetry(url, type);
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push.apply(out, batch);
    if (batch.length < limit) break;
    await sleep(120); // gentle pacing between pages to stay under the rate limit
  }
  return out;
}

function uniqueLeads(acts) {
  const s = new Set();
  acts.forEach(function (a) { if (a && a.leadId) s.add(a.leadId); });
  return s.size;
}

async function computeCampaign(meta) {
  // Sequential (not Promise.all) to avoid bursting lemlist's rate limit.
  const inviteDone = await fetchActivities(meta.id, "linkedinInviteDone");
  const linkedinSent = await fetchActivities(meta.id, "linkedinSent");
  const accepted = await fetchActivities(meta.id, "linkedinInviteAccepted");
  const replied = await fetchActivities(meta.id, "linkedinReplied");
  const booked = await fetchActivities(meta.id, "meetingBooked");

  const contactedSet = new Set();
  inviteDone.concat(linkedinSent).forEach(function (a) { if (a.leadId) contactedSet.add(a.leadId); });

  const bookedApi = uniqueLeads(booked);
  const manual = MANUAL_BOOKINGS[meta.id] || 0;

  // Reply list per campaign, deduped by lead, so the dashboard can show
  // the repliers for whichever campaign/experiment is filtered.
  const replies = [];
  const seen = new Set();
  replied.forEach(function (a) {
    if (seen.has(a.leadId)) return;
    seen.add(a.leadId);
    const name = [a.leadFirstName, a.leadLastName].filter(Boolean).join(" ") || "Unknown";
    replies.push({
      name: name,
      company: a.leadCompanyName || "",
      preview: (a.text || "").slice(0, 120),
      date: a.createdAt || ""
    });
  });
  replies.sort(function (x, y) { return (y.date || "").localeCompare(x.date || ""); });

  const curated = CURATED[meta.id] || null;

  return {
    id: meta.id, name: meta.name, role: meta.role, signal: meta.signal,
    contacted: contactedSet.size,
    accepted: uniqueLeads(accepted),
    replied: uniqueLeads(replied),
    booked: Math.max(bookedApi, manual),
    messagesSent: linkedinSent.length,
    live: contactedSet.size > 0,
    replies: replies,
    leadsLoaded: curated && curated.leadsLoaded != null ? curated.leadsLoaded : null,
    curated: curated
  };
}

module.exports = async function handler(req, res) {
  try {
    const results = [];
    for (const meta of CAMPAIGNS) {
      // sequential to stay under lemlist rate limits; drafts return instantly
      results.push(await computeCampaign(meta));
    }
    res.setHeader("Content-Type", "application/json");
    // CDN-cache for 15 min so the team isn't hammering lemlist and the page is fast
    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");
    res.status(200).json({ generatedAt: new Date().toISOString(), campaigns: results });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
