(() => {
  const url = window.SHIPTRACK_SUPABASE_URL;
  const key = window.SHIPTRACK_SUPABASE_PUBLISHABLE_KEY;

  if (!window.supabase || !url || !key ||
      url.includes("PASTE_YOUR") || key.includes("PASTE_YOUR")) {
    document.documentElement.style.visibility = "visible";
    alert("Supabase is not configured. Update config.js first.");
    location.replace("index.html");
    return;
  }

  const client = window.supabase.createClient(url, key);

  async function start() {
    const { data, error } = await client.auth.getSession();
    if (error || !data.session) {
      location.replace("index.html");
      return;
    }

    document.getElementById("accountEmail").textContent = data.session.user.email || "";
    document.documentElement.style.visibility = "visible";
  }

  document.getElementById("logoutButton").addEventListener("click", async () => {
    const button = document.getElementById("logoutButton");
    button.disabled = true;
    const { error } = await client.auth.signOut();
    if (error) {
      alert("Could not sign out: " + error.message);
      button.disabled = false;
      return;
    }
    location.replace("index.html");
  });

  const form = document.getElementById("trackingForm");
  const input = document.getElementById("trackingInput");
  const errorBox = document.getElementById("errorMessage");
  const result = document.getElementById("result");
  const emptyState = document.getElementById("emptyState");

  function formatDate(value) {
    if (!value) return "Not provided";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) :
      date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }

  function setText(id, value) {
    document.getElementById(id).textContent =
      value === null || value === undefined || value === "" ? "Not provided" : String(value);
  }

  function showShipment(row) {
    setText("resultId", row.tracking_number);
    setText("originCity", row.origin_city);
    setText("originCountry", row.origin_country);
    setText("destCity", row.destination_city);
    setText("destCountry", row.destination_country);
    setText("eta", row.estimated_delivery);
    setText("service", row.shipping_service);
    setText("packageType", row.package_type);
    setText("updated", formatDate(row.updated_at));

    const pill = document.getElementById("statusPill");
    pill.textContent = row.status || "Status unavailable";

    const timeline = document.getElementById("timelineSteps");
    timeline.replaceChildren();

    // Optional timeline_events column: JSON array of
    // {"title":"Dispatched","description":"Package left origin facility","event_time":"2026-10-30T10:00:00Z"}
    const events = Array.isArray(row.timeline_events) ? row.timeline_events : [];
    if (events.length === 0) {
      const note = document.createElement("p");
      note.className = "muted";
      note.textContent = "No detailed progress events have been added yet.";
      timeline.appendChild(note);
    } else {
      events.forEach((event) => {
        const item = document.createElement("div");
        item.className = "timeline-item";
        const title = document.createElement("strong");
        title.textContent = event.title || "Shipment update";
        const description = document.createElement("p");
        description.textContent = event.description || "";
        const time = document.createElement("small");
        time.textContent = formatDate(event.event_time);
        item.append(title, description, time);
        timeline.appendChild(item);
      });
    }

    errorBox.textContent = "";
    result.hidden = false;
    emptyState.hidden = true;
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const trackingNumber = input.value.trim();
    if (!trackingNumber) return;

    const button = form.querySelector("button");
    button.disabled = true;
    button.textContent = "Searching…";
    errorBox.textContent = "";

    try {
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError || !sessionData.session) {
        location.replace("index.html");
        return;
      }

      // RLS must restrict rows to the signed-in customer's user_id.
      const { data, error } = await client
        .from("shipments")
        .select("tracking_number, origin_city, origin_country, destination_city, destination_country, status, estimated_delivery, shipping_service, package_type, updated_at, timeline_events")
        .eq("tracking_number", trackingNumber)
        .eq("user_id", sessionData.session.user.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        result.hidden = true;
        emptyState.hidden = false;
        errorBox.textContent = "No shipment with that tracking number was found in your account.";
      } else {
        showShipment(data);
      }
    } catch (error) {
      errorBox.textContent = "Could not retrieve shipment: " + (error.message || "Please try again.");
    } finally {
      button.disabled = false;
      button.textContent = "Track package →";
    }
  });

  start();
})();
