

 

(() => {
    "use strict";

    // ==========================================
    // 1. SUPABASE CONFIGURATION
    // ==========================================

    const url = window.SHIPTRACK_SUPABASE_URL;
    const key = window.SHIPTRACK_SUPABASE_PUBLISHABLE_KEY;

    const $ = id => document.getElementById(id);

    let db = null;
    let currentUser = null;
    let realtimeChannel = null;


    // ==========================================
    // 2. HELPER FUNCTIONS
    // ==========================================

    function clean(value) {
        if (value === null || value === undefined || value === "") {
            return "Not provided";
        }

        return String(value);
    }

    function setText(id, value) {
        const element = $(id);

        if (element) {
            element.textContent = clean(value);
        }
    }

    function formatDate(value) {
        if (!value) {
            return "Not provided";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return date.toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short"
        });
    }

    function showMessage(message, isError = false) {
        const element = $("errorMessage");

        if (!element) return;

        element.textContent = message;

        element.style.color = isError
            ? "#ffd0cc"
            : "#c8d3e7";
    }

    function normalizeStatus(status) {
        return String(status || "")
            .toLowerCase()
            .replaceAll(" ", "-");
    }


    // ==========================================
    // 3. RENDER TRACKING TIMELINE
    // ==========================================

    function renderTimeline(events) {

        const timeline = $("timelineSteps");

        if (!timeline) return;

        timeline.replaceChildren();

        if (!Array.isArray(events) || events.length === 0) {

            const empty = document.createElement("p");

            empty.className = "muted";

            empty.textContent =
                "No progress updates have been recorded yet.";

            timeline.appendChild(empty);

            return;
        }

        const sortedEvents = [...events].sort((a, b) => {

            return new Date(
                b.event_time || b.timestamp || 0
            ) - new Date(
                a.event_time || a.timestamp || 0
            );

        });

        sortedEvents.forEach(event => {

            const item = document.createElement("div");

            item.className = "timeline-item";

            const title = document.createElement("strong");

            title.textContent =
                event.title ||
                event.status ||
                "Shipment Update";

            const description = document.createElement("p");

            description.textContent =
                event.description || "";

            const time = document.createElement("time");

            time.textContent = formatDate(
                event.event_time || event.timestamp
            );

            item.appendChild(title);
            item.appendChild(description);
            item.appendChild(time);

            timeline.appendChild(item);

        });

    }


    // ==========================================
    // 4. DISPLAY SHIPMENT INFORMATION
    // ==========================================

    function renderShipment(row) {

        if (!row) return;

        // Tracking number

        setText("resultId", row.tracking_number);


        // ======================================
        // SENDER INFORMATION
        // ======================================

        setText(
            "senderName",
            row.shipper_name
        );

        setText(
            "senderAddress",
            row.shipper_address
        );


        // ======================================
        // RECEIVER INFORMATION
        // ======================================

        setText(
            "receiverName",
            row.receiver_name
        );

        setText(
            "receiverAddress",
            row.receiver_address
        );


        // ======================================
        // SHIPMENT ROUTE
        // ======================================

        setText("originCity", row.origin_city);

        setText("originCountry", row.origin_country);

        setText("destCity", row.destination_city);

        setText("destCountry", row.destination_country);


        // ======================================
        // SHIPMENT DETAILS
        // ======================================

        setText(
            "shipType",
            row.ship_type || row.package_type
        );

        setText(
            "weight",
            row.weight == null
                ? "Not provided"
                : `${row.weight} kg`
        );

        setText("invoiceNo", row.invoice_no);

        setText("bookingMode", row.booking_mode);

        setText("transportMode", row.transport_mode);

        setText("currentLocation", row.current_location);

        setText("eta", row.estimated_delivery);

        setText("updated", formatDate(row.updated_at));

        setText("service", row.shipping_service);

        setText("packageType", row.package_type);


        // ======================================
        // SHIPMENT STATUS
        // ======================================

        const status = $("statusPill");

        if (status) {

            status.textContent =
                row.status || "Status unavailable";

            status.className =
                "status " + normalizeStatus(row.status);

        }


        // ======================================
        // TRACKING HISTORY
        // ======================================

        renderTimeline(row.timeline_events);


        // ======================================
        // SHIPMENT HOLD NOTIFICATION
        // ======================================

        const isOnHold =
            String(row.status || "").toLowerCase() === "on hold"
            || Boolean(row.hold_reason);

        if ($("holdNotice")) {

            $("holdNotice").classList.toggle(
                "hidden",
                !isOnHold
            );

        }

        setText(
            "holdReason",
            row.hold_reason ||
            "Your shipment is currently on hold. Contact the shipping administrator for further information."
        );


        // ======================================
        // SHOW RESULTS
        // ======================================

        $("result")?.classList.remove("hidden");

        $("emptyState")?.classList.add("hidden");

    }


    // ==========================================
    // 5. REALTIME SHIPMENT UPDATES
    // ==========================================

    async function subscribeToShipment(shipmentId) {

        if (realtimeChannel) {

            await db.removeChannel(realtimeChannel);

            realtimeChannel = null;

        }

        realtimeChannel = db

            .channel("shiptrack-" + shipmentId)

            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "shipments",
                    filter: `id=eq.${shipmentId}`
                },

                payload => {

                    if (
                        payload.new &&
                        payload.new.user_id === currentUser.id
                    ) {

                        renderShipment(payload.new);

                    }

                }
            )

            .subscribe();

    }


    // ==========================================
    // 6. SEARCH FOR SHIPMENT
    // ==========================================

    async function trackShipment(trackingNumber) {

        if (!trackingNumber) {

            showMessage(
                "Please enter a tracking number.",
                true
            );

            return;
        }

        showMessage("Searching for your shipment...");

        $("trackButton").disabled = true;

        try {

            const { data, error } = await db

                .from("shipments")

                .select(`
                    id,
                    user_id,
                    tracking_number,

                    shipper_name,
                    shipper_address,
                    receiver_name,
                    receiver_address,

                    origin_city,
                    origin_country,
                    destination_city,
                    destination_country,

                    status,
                    estimated_delivery,
                    shipping_service,
                    package_type,
                    updated_at,
                    timeline_events,

                    ship_type,
                    weight,
                    invoice_no,
                    booking_mode,
                    transport_mode,
                    current_location,
                    hold_reason
                `)

                .eq(
                    "tracking_number",
                    trackingNumber.trim().toUpperCase()
                )

                .eq(
                    "user_id",
                    currentUser.id
                )

                .maybeSingle();


            if (error) {
                throw error;
            }


            if (!data) {

                $("result").classList.add("hidden");

                $("emptyState").classList.remove("hidden");

                showMessage(
                    "No shipment with that tracking number was found in your account.",
                    true
                );

                return;
            }


            // Display shipment information

            renderShipment(data);

            showMessage("Shipment found successfully.");


            // Subscribe to realtime updates

            await subscribeToShipment(data.id);


            // Update browser URL without reloading

            const newUrl = new URL(window.location.href);

            newUrl.searchParams.set(
                "tracking",
                data.tracking_number
            );

            history.replaceState({}, "", newUrl);


        } catch (error) {

            console.error("Tracking error:", error);

            showMessage(
                "Unable to retrieve shipment: " + error.message,
                true
            );

        } finally {

            $("trackButton").disabled = false;

        }

    }


    // ==========================================
    // 7. INITIALIZE CUSTOMER DASHBOARD
    // ==========================================

    async function initializeTracking() {

        // Check Supabase configuration

        if (
            !window.supabase ||
            !url ||
            !key ||
            url.includes("PASTE_YOUR") ||
            key.includes("PASTE_YOUR")
        ) {

            showMessage(
                "Supabase is not configured. Check config.js.",
                true
            );

            return;
        }


        // Create Supabase client

        db = window.supabase.createClient(url, key);


        // Verify login

        const {
            data,
            error
        } = await db.auth.getSession();


        if (error || !data.session) {

            window.location.replace("index.html");

            return;
        }


        currentUser = data.session.user;


        $("accountEmail").textContent =
            currentUser.email || "Signed in";


        // Check administrator role

        const {
            data: profile,
            error: profileError
        } = await db

            .from("profiles")

            .select("role")

            .eq("id", currentUser.id)

            .maybeSingle();


        if (!profileError && profile && profile.role === "admin") {

            $("adminLink").classList.remove("hidden");

        }


        // Sign out

        $("logoutButton").addEventListener(
            "click",
            async () => {

                $("logoutButton").disabled = true;

                const { error } = await db.auth.signOut();

                if (error) {

                    showMessage(error.message, true);

                    $("logoutButton").disabled = false;

                    return;
                }

                window.location.replace("index.html");

            }
        );


        // Tracking form

        $("trackingForm").addEventListener(
            "submit",
            event => {

                event.preventDefault();

                const trackingNumber =
                    $("trackingInput").value.trim();

                trackShipment(trackingNumber);

            }
        );


        // Support direct tracking links

        const params = new URLSearchParams(
            window.location.search
        );

        const trackingNumber = params.get("tracking");

        if (trackingNumber) {

            $("trackingInput").value = trackingNumber;

            trackShipment(trackingNumber);

        }

    }


    // ==========================================
    // 8. START APPLICATION
    // ==========================================

    document.addEventListener(
        "DOMContentLoaded",
        initializeTracking
    );

})();
