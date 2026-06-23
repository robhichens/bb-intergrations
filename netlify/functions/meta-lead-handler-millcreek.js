// netlify/functions/meta-lead-handler.js
//
// Receives a Mill Creek lead (from Zapier's Facebook Lead Ads trigger,
// or any source that POSTs JSON) and forwards it to IntelliKid Systems (IKS)
// via the v2 "simplified" lead endpoint.
//
// SECRET: the IKS API token is read from the IKS_API_TOKEN environment
// variable (set in Netlify > Site settings > Environment variables).
// It is never stored in this file or the repo.

const IKS_ENDPOINT = "https://api.intellikidsystems.com/api/v2/lead/simplified";

// Mill Creek location_id from GET /api/v2/lead/config.
// NOTE: FL and Mill Creek IDs are nearly identical — this is Mill Creek.
const MILL_CREEK_LOCATION_ID = "1095544633073582675";

exports.handler = async (event) => {
  // --- Test mode: visit the URL in a browser (GET) to confirm it's alive ---
  if (event.httpMethod === "GET") {
    return json(200, {
      status: "alive",
      message: "Mill Creek lead handler is live. POST a lead here to forward it to IKS.",
      location_id: MILL_CREEK_LOCATION_ID,
      token_configured: Boolean(process.env.IKS_API_TOKEN),
    });
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed. Use POST." });
  }

  // --- Guard: make sure the token is set ---
  const token = process.env.IKS_API_TOKEN;
  if (!token) {
    return json(500, { error: "IKS_API_TOKEN environment variable is not set." });
  }

  // --- Parse the incoming lead ---
  let incoming;
  try {
    incoming = JSON.parse(event.body || "{}");
  } catch (e) {
    return json(400, { error: "Invalid JSON in request body." });
  }

  // Accept a few common field-name variants so this works whether the lead
  // comes from Zapier, a manual test, or a tweaked form. First match wins.
  const firstName = pick(incoming, ["first_name", "firstName", "First name", "full_name_first"]);
  const lastName  = pick(incoming, ["last_name", "lastName", "Last name"]);
  const email     = pick(incoming, ["email", "Email"]);
  const phone     = pick(incoming, ["phone", "phone_number", "Phone", "Phone number"]);
  const phoneCleaned = phone ? phone.replace(/^\+1/, "") : "";
  const childAge  = pick(incoming, ["child_age", "How old is your little one?", "childs_age", "age"]);
  const startWhen = pick(incoming, ["start_when", "When are you hoping to start?", "start_date"]);

  // IKS requires at least an email OR a phone.
  if (!email && !phone) {
    return json(400, { error: "Lead must include at least an email or a phone number." });
  }

  // Build the "tell us about your child" note from the age bucket (+ optional start timing).
  // We map the FB age bucket here because IKS has no matching bucket field;
  // child_birthday expects a real date, which our form doesn't collect.
  const childNoteParts = [];
  if (childAge)  childNoteParts.push(`Child's age: ${childAge}`);
  if (startWhen) childNoteParts.push(`Hoping to start: ${startWhen}`);
  const childNote = childNoteParts.join(" | ");

  // --- Build the IKS simplified payload ---
  const payload = {
    location_id: MILL_CREEK_LOCATION_ID,
    source: "Facebook Ads",
    first_name: firstName || "",
    last_name: lastName || "",
    email: email || "",
    email_consents: "all",
    phone: phoneCleaned || "",
    phone_consents: "all",
    utm_source: "facebook",
    utm_medium: "paid_social",
    utm_campaign: "MC_Nature_2026-06",
  };
  if (childNote) payload.tell_us_about_your_child = childNote;

  // --- Forward to IKS ---
  try {
    const res = await fetch(IKS_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();

    if (!res.ok) {
      // Surface IKS's error so you can see what it didn't like during testing.
      console.error("IKS rejected lead:", res.status, text);
      return json(502, { error: "IKS rejected the lead.", iks_status: res.status, iks_response: text });
    }

    console.log("Payload sent to IKS:", JSON.stringify(payload));
    console.log("Lead forwarded to IKS:", email || phone, "| IKS response:", text);
    return json(200, { status: "forwarded", iks_response: safeParse(text) });
  } catch (err) {
    console.error("Failed to reach IKS:", err);
    return json(502, { error: "Failed to reach IKS.", detail: String(err) });
  }
};

// --- helpers ---
function pick(obj, keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== "") {
      return String(obj[k]).trim();
    }
  }
  return "";
}

function json(statusCode, bodyObj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bodyObj),
  };
}

function safeParse(text) {
  try { return JSON.parse(text); } catch { return text; }
}

