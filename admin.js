
(() => {
  const url = window.SHIPTRACK_SUPABASE_URL;
  const key = window.SHIPTRACK_SUPABASE_PUBLISHABLE_KEY;

  if (!window.supabase || !url || !key) {
    alert("Supabase is not configured. Check config.js.");
    return;
  }

  const db = window.supabase.createClient(url, key);

  const get = (id) => document.getElementById(id);

  let currentUser = null;
  let editingTrackingNumber = null;

  async function initialize() {
    const { data: { session }, error } = await db.auth.getSession();

    if (error || !session) {
      alert("Please log in first.");
      location.href = "index.html";
      return;
    }

    currentUser = session.user;

    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("role")
      .eq("id", currentUser.id)
      .single();

    if (profileError || !profile || profile.role !== "admin") {
      document.body.innerHTML = `
        <h2>Access denied</h2>
        <p>Administrator permission is required.</p>
        <a href="tracking.html">Return to tracking</a>
      `;
      return;
    }

    const userField = get("user_id");
    if (userField) userField.value = currentUser.id;

    const trackingField = get("tracking_number");
    if (trackingField) trackingField.value = "ST-2026-045";

    const form = get("shipmentForm");
    if (form) {
      form.addEventListener("submit", saveShipment);
    }

    const searchButton = get("searchShipment");
    if (searchButton) {
      searchButton.addEventListener("click", loadShipment);
    }

    const resetButton = get("resetForm");
    if (resetButton) {
      resetButton.addEventListener("click", resetForm);
    }
  }

  function showMessage(message, isError = false) {
    const output = get("message");

    if (output) {
      output.textContent = message;
      output.style.color = isError ? "red" : "green";
    } else {
      alert(message);
    }
  }

  async function saveShipment(event) {
    event.preventDefault();

    const row = {
      user_id: get("user_id").value.trim(),
      tracking_number: get("tracking_number").value.trim().toUpperCase(),
      origin_city: get("origin_city").value.trim(),
      origin_country: get("origin_country").value.trim(),
      destination_city: get("destination_city").value.trim(),
      destination_country: get("destination_country").value.trim(),
      status: get("status").value,
      estimated_delivery: get("estimated_delivery").value || null,
      shipping_service: get("shipping_service").value.trim(),
      package_type: get("package_type").value.trim(),
      updated_at: new Date().toISOString()
    };

    if (!row.user_id || !row.tracking_number) {
      showMessage("Customer ID and tracking number are required.", true);
      return;
    }

    let timelineEvents = [];

    const timelineInput = get("timeline_events").value.trim();

    if (timelineInput) {
      try {
        timelineEvents = JSON.parse(timelineInput);

        if (!Array.isArray(timelineEvents)) {
          throw new Error("Timeline must be a JSON array.");
        }
      } catch (error) {
        showMessage("Invalid timeline JSON: " + error.message, true);
        return;
      }
    }

    row.timeline_events = timelineEvents;

    let result;

    if (editingTrackingNumber) {
      result = await db
        .from("shipments")
        .update(row)
        .eq("tracking_number", editingTrackingNumber)
        .select();
    } else {
      result = await db
        .from("shipments")
        .insert(row)
        .select();
    }

    if (result.error) {
      showMessage("Error: " + result.error.message, true);
      return;
    }

    if (!result.data || result.data.length === 0) {
      showMessage("No shipment was saved. Check your permissions.", true);
      return;
    }

    showMessage(
      editingTrackingNumber
        ? "Shipment updated successfully!"
        : "New shipment created successfully!"
    );

    editingTrackingNumber = row.tracking_number;
  }

  async function loadShipment() {
    const trackingNumber = get("tracking_number").value.trim().toUpperCase();

    if (!trackingNumber) {
      showMessage("Enter a tracking number first.", true);
      return;
    }

    const { data, error } = await db
      .from("shipments")
      .select("*")
      .eq("tracking_number", trackingNumber)
      .maybeSingle();

    if (error) {
      showMessage(error.message, true);
      return;
    }

    if (!data) {
      showMessage("Shipment not found. You can create a new one.", true);
      editingTrackingNumber = null;
      return;
    }

    get("user_id").value = data.user_id || "";
    get("tracking_number").value = data.tracking_number || "";
    get("origin_city").value = data.origin_city || "";
    get("origin_country").value = data.origin_country || "";
    get("destination_city").value = data.destination_city || "";
    get("destination_country").value = data.destination_country || "";
    get("status").value = data.status || "Processing";
    get("estimated_delivery").value = data.estimated_delivery || "";
    get("shipping_service").value = data.shipping_service || "";
    get("package_type").value = data.package_type || "";
    get("timeline_events").value =
      JSON.stringify(data.timeline_events || [], null, 2);

    editingTrackingNumber = data.tracking_number;

    showMessage("Shipment loaded. You can now edit it.");
  }

  function resetForm() {
    get("shipmentForm").reset();
    editingTrackingNumber = null;

    if (get("tracking_number")) {
      get("tracking_number").value = "ST-2026-045";
    }

    if (get("user_id")) {
      get("user_id").value = currentUser.id;
    }

    showMessage("Form cleared. Ready to create a new shipment.");
  }

  initialize();
})();
