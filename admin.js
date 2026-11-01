
(() => {
  "use strict";

  const url = window.SHIPTRACK_SUPABASE_URL;
  const key = window.SHIPTRACK_SUPABASE_PUBLISHABLE_KEY;

  const $ = (id) => document.getElementById(id);

  let db;
  let currentUser = null;
  let shipments = [];
  let customers = [];
  let editingId = null;
  let originalStatus = "";

  const fieldIds = [
    "customerId",
    "trackingNumber",
    "status",
    "shipperName",
    "shipperAddress",
    "receiverName",
    "receiverAddress",
    "originCity",
    "originCountry",
    "destinationCity",
    "destinationCountry",
    "shipType",
    "weight",
    "invoiceNo",
    "bookingMode",
    "transportMode",
    "currentLocation",
    "estimatedDelivery",
    "shippingService",
    "packageType",
    "holdReason",
    "eventTitle",
    "eventDescription"
  ];

  function showMessage(message, type = "error") {
    let box = $("adminMessage");

    if (!box) {
      box = document.createElement("div");
      box.id = "adminMessage";
      box.style.padding = "12px";
      box.style.marginBottom = "14px";
      box.style.borderRadius = "8px";
      $("shipmentForm")?.prepend(box);
    }

    box.textContent = message;
    box.style.background =
      type === "success" ? "#dcfce7" : "#fee2e2";
    box.style.color =
      type === "success" ? "#166534" : "#991b1b";
    box.style.display = "block";
  }

  function clearMessage() {
    const box = $("adminMessage");
    if (box) {
      box.textContent = "";
      box.style.display = "none";
    }
  }

  function setButtonLoading(button, loading, normalText) {
    if (!button) return;

    button.disabled = loading;
    button.textContent = loading ? "Please wait..." : normalText;
  }

  function value(id) {
    return $(id)?.value?.trim() || "";
  }

  function nullable(id) {
    return value(id) || null;
  }

  function makeCell(text) {
    const td = document.createElement("td");
    td.textContent = text || "—";
    return td;
  }

  function normalizeStatus(status) {
    return String(status || "").toLowerCase().trim();
  }

  async function verifyAdmin() {
    const { data, error } = await db.auth.getSession();

    if (error || !data.session) {
      window.location.replace("index.html");
      return false;
    }

    currentUser = data.session.user;

    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("role")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (profileError || !profile || profile.role !== "admin") {
      alert("Access denied. Admin privileges are required.");
      window.location.replace("tracking.html");
      return false;
    }

    return true;
  }

  async function loadCustomers() {
    const select = $("customerId");

    const { data, error } = await db
      .from("profiles")
      .select("id, email, role")
      .eq("role", "customer")
      .order("email", { ascending: true });

    if (error) throw error;

    customers = data || [];

    select.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select customer";
    select.appendChild(placeholder);

    customers.forEach((customer) => {
      const option = document.createElement("option");
      option.value = customer.id;
      option.textContent = customer.email || customer.id;
      select.appendChild(option);
    });
  }

  async function loadShipments() {
    const { data, error } = await db
      .from("shipments")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) throw error;

    shipments = data || [];

    renderStats();
    renderShipments();
  }

  function renderStats() {
    const total = shipments.length;

    const delivered = shipments.filter(
      (s) => normalizeStatus(s.status) === "delivered"
    ).length;

    const onHold = shipments.filter(
      (s) => normalizeStatus(s.status).includes("hold")
    ).length;

    const inTransit = shipments.filter((s) => {
      const status = normalizeStatus(s.status);

      return [
        "in transit",
        "picked up",
        "out for delivery",
        "arrived at facility",
        "processing",
        "shipment registered"
      ].includes(status);
    }).length;

    if ($("totalCount")) $("totalCount").textContent = total;
    if ($("transitCount")) $("transitCount").textContent = inTransit;
    if ($("deliveredCount")) $("deliveredCount").textContent = delivered;
    if ($("holdCount")) $("holdCount").textContent = onHold;
  }

  function renderShipments() {
    const tbody = $("shipmentRows");
    if (!tbody) return;

    tbody.replaceChildren();

    const search = value("shipmentSearch").toLowerCase();

    const filtered = shipments.filter((shipment) => {
      const text = [
        shipment.tracking_number,
        shipment.destination_city,
        shipment.destination_country,
        shipment.status,
        shipment.receiver_name
      ].join(" ").toLowerCase();

      return text.includes(search);
    });

    if (filtered.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");

      cell.colSpan = 6;
      cell.textContent = "No shipments found.";
      row.appendChild(cell);
      tbody.appendChild(row);
      return;
    }

    filtered.forEach((shipment) => {
      const row = document.createElement("tr");

      row.appendChild(makeCell(shipment.tracking_number));
      row.appendChild(makeCell(shipment.receiver_name));

      row.appendChild(
        makeCell(
          [shipment.destination_city, shipment.destination_country]
            .filter(Boolean)
            .join(", ")
        )
      );

      row.appendChild(makeCell(shipment.status));

      row.appendChild(
        makeCell(
          shipment.estimated_delivery
            ? new Date(
                shipment.estimated_delivery + "T00:00:00"
              ).toLocaleDateString()
            : "Not set"
        )
      );

      const actionCell = document.createElement("td");
      const editButton = document.createElement("button");

      editButton.type = "button";
      editButton.textContent = "Edit";
      editButton.className = "btn btn-secondary";

      editButton.addEventListener("click", () => {
        editShipment(shipment.id);
      });

      actionCell.appendChild(editButton);
      row.appendChild(actionCell);

      tbody.appendChild(row);
    });
  }

  function clearForm() {
    $("shipmentForm")?.reset();

    editingId = null;
    originalStatus = "";

    if ($("formTitle")) {
      $("formTitle").textContent = "Create New Shipment";
    }

    if ($("saveButton")) {
      $("saveButton").textContent = "Create Shipment";
    }

    clearMessage();
  }

  function editShipment(id) {
    const shipment = shipments.find((s) => s.id === id);

    if (!shipment) {
      showMessage("Shipment could not be found.");
      return;
    }

    editingId = shipment.id;
    originalStatus = shipment.status || "";

    const mapping = {
      customerId: "user_id",
      trackingNumber: "tracking_number",
      status: "status",
      shipperName: "shipper_name",
      shipperAddress: "shipper_address",
      receiverName: "receiver_name",
      receiverAddress: "receiver_address",

      originCity: "origin_city",
      originCountry: "origin_country",
      destinationCity: "destination_city",
      destinationCountry: "destination_country",
      shipType: "ship_type",
      weight: "weight",
      invoiceNo: "invoice_no",
      bookingMode: "booking_mode",
      transportMode: "transport_mode",
      currentLocation: "current_location",
      estimatedDelivery: "estimated_delivery",
      shippingService: "shipping_service",
      packageType: "package_type",
      holdReason: "hold_reason"
    };

    Object.entries(mapping).forEach(([inputId, column]) => {
      if ($(inputId)) {
        $(inputId).value = shipment[column] ?? "";
      }
    });

    $("eventTitle").value = "";
    $("eventDescription").value = "";

    if ($("formTitle")) {
      $("formTitle").textContent = "Edit Shipment";
    }

    if ($("saveButton")) {
      $("saveButton").textContent = "Save Changes";
    }

    clearMessage();

    $("editorPanel")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function buildTimeline(previousEvents, status, location) {
    const events = Array.isArray(previousEvents)
      ? [...previousEvents]
      : [];

    const title = value("eventTitle");
    const description = value("eventDescription");

    const statusChanged =
      editingId && status !== originalStatus;

    if (title || description || statusChanged || !editingId) {
      events.push({
        event_time: new Date().toISOString(),
        title: title || status,
        description:
          description ||
          (statusChanged
            ? `Shipment status changed to ${status}.`
            : `Shipment status: ${status}.`),
        status: status,
        location: location || ""
      });
    }

    return events;
  }

  function buildPayload(existingShipment = null) {
    const trackingNumber = value("trackingNumber").toUpperCase();
    const customerId = value("customerId");
    const status = value("status");

    if (!customerId) {
      throw new Error("Select a customer.");
    }

    if (!trackingNumber) {
      throw new Error("Enter a tracking number.");
    }

    if (!status) {
      throw new Error("Select a shipment status.");
    }

    const weightText = value("weight");
    const weight = weightText ? Number(weightText) : null;

    if (weightText && (!Number.isFinite(weight) || weight < 0)) {
      throw new Error("Enter a valid shipment weight.");
    }

    const payload = {
      user_id: customerId,
      tracking_number: trackingNumber,
      status: status,

      shipper_name: nullable("shipperName"),
      shipper_address: nullable("shipperAddress"),
      receiver_name: nullable("receiverName"),
      receiver_address: nullable("receiverAddress"),

      origin_city: nullable("originCity"),
      origin_country: nullable("originCountry"),
      destination_city: nullable("destinationCity"),
      destination_country: nullable("destinationCountry"),

      ship_type: nullable("shipType"),
      weight: weight,
      invoice_no: nullable("invoiceNo"),
      booking_mode: nullable("bookingMode"),
      transport_mode: nullable("transportMode"),

      current_location: nullable("currentLocation"),
      estimated_delivery: nullable("estimatedDelivery"),

      shipping_service: nullable("shippingService"),
      package_type: nullable("packageType"),
      hold_reason: nullable("holdReason"),

      updated_at: new Date().toISOString(),

      timeline_events: buildTimeline(
        existingShipment?.timeline_events,
        status,
        value("currentLocation")
      )
    };

    return payload;
  }

  async function saveShipment(event) {
    event.preventDefault();
    clearMessage();

    const button = $("saveButton");
    const normalText = editingId ? "Save Changes" : "Create Shipment";

    try {
      setButtonLoading(button, true, normalText);

      const existing = editingId
        ? shipments.find((s) => s.id === editingId)
        : null;

      const payload = buildPayload(existing);

      let result;

      if (editingId) {
        result = await db
          .from("shipments")
          .update(payload)
          .eq("id", editingId)
          .select()
          .single();
      } else {
        result = await db
          .from("shipments")
          .insert(payload)
          .select()
          .single();
      }

      if (result.error) throw result.error;

      showMessage(
        editingId
          ? "Shipment updated successfully."
          : "Shipment created successfully.",
        "success"
      );

      await loadShipments();

      clearForm();

    } catch (error) {
      console.error("Save shipment error:", error);
      showMessage(error.message || "Unable to save shipment.");
    } finally {
      setButtonLoading(button, false, normalText);
    }
  }

  async function logout() {
    await db.auth.signOut();
    window.location.replace("index.html");
  }

  async function init() {
    if (
      !window.supabase ||
      !url ||
      !key ||
      url.includes("PASTE_YOUR") ||
      key.includes("PASTE_YOUR")
    ) {
      alert("Supabase is not configured. Check config.js.");
      return;
    }

    db = window.supabase.createClient(url, key);

    const isAdmin = await verifyAdmin();

    if (!isAdmin) return;

    try {
      await loadCustomers();
      await loadShipments();
    } catch (error) {
      console.error("Dashboard loading error:", error);
      showMessage(
        error.message ||
        "Could not load dashboard. Check your Supabase schema and RLS policies."
      );
    }

    $("shipmentForm")?.addEventListener("submit", saveShipment);

    $("newShipmentButton")?.addEventListener("click", () => {
      clearForm();

      $("editorPanel")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });

    $("resetButton")?.addEventListener("click", clearForm);

    $("refreshButton")?.addEventListener("click", async () => {
      try {
        await loadCustomers();
        await loadShipments();
        showMessage("Dashboard refreshed.", "success");
      } catch (error) {
        showMessage(error.message || "Refresh failed.");
      }
    });

    $("shipmentSearch")?.addEventListener("input", renderShipments);

    $("logoutButton")?.addEventListener("click", logout);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
