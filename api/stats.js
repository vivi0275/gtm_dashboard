// Serverless proxy: calls the lemlist API with a SERVER-SIDE key and returns
// a computed funnel per campaign. The key never reaches the browser.
//
// Set LEMLIST_API_KEY in your Vercel project settings (Environment Variables).
// Optional: edit MANUAL_BOOKINGS below for demos booked outside lemlist (Calendly/Zapier).

const LEMLIST_BASE = "https://api.lemlist.com/api";

// The campaigns shown on the dashboard. Edit names/ids/signals here.
const CAMPAIGNS = [
  { id: "cam_w8MSGFGBJeFHh8qRA", name: "Campaign GTM", role: "main", signal: "Live campaign" },
  { id: "cam_oCLPvtEyumvDyqECo", name: "Teams running Rocketlane / Asana", role: "experiment", signal: "Signal: tech stack (TheirStack)" },
  { id: "cam_baQ4bryphKccydJmo", name: "Teams making their first implementation hire", role: "experiment", signal: "Signal: first impl job post" },
  { id: "cam_NmKvkhsnFu7eiSLYr", name: "Teams growing their implementation team", role: "experiment", signal: "Signal: growth impl job post" },
  { id: "cam_vrMNEtXmxAG2LX4GG", name: "Teams in implementation-heavy verticals", role: "experiment", signal: "Signal: Clay stacked signals" }
];

// Demos booked outside lemlist (Calendly/Zapier). lemlist's meetingBooked only
// counts lemcal, so add manual ones here per campaign id.
const MANUAL_BOOKINGS = {
  "cam_w8MSGFGBJeFHh8qRA": 5
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

  return {
    id: meta.id, name: meta.name, role: meta.role, signal: meta.signal,
    contacted: contactedSet.size,
    accepted: uniqueLeads(accepted),
    replied: uniqueLeads(replied),
    booked: Math.max(bookedApi, manual),
    messagesSent: linkedinSent.length,
    live: contactedSet.size > 0,
    replies: replies
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
