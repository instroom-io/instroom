import { NextResponse } from "next/server"

// Plain HTML so app-bridge.js is the first script in <head> (Shopify requirement).

export const dynamic = "force-dynamic"

const escapeAttr = (value: string) => value.replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`)

export function GET() {
  const clientId = escapeAttr(process.env.SHOPIFY_CLIENT_ID ?? "")
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="shopify-api-key" content="${clientId}">
<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
<script src="https://cdn.shopify.com/shopifycloud/polaris-2.js"></script>
<title>Instroom</title>
</head>
<body>
<s-page id="app" inlineSize="base"><s-section><s-spinner accessibilityLabel="Loading"></s-spinner></s-section></s-page>
<script>
(function () {
  var app = document.getElementById("app");
  var STATES = {
    awaiting: ["Awaiting fulfillment", "warning"],
    in_transit: ["In transit", "info"],
    delivered: ["Delivered", "success"],
    cancelled: ["Cancelled", "neutral"],
  };

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    [].concat(children == null ? [] : children).forEach(function (c) {
      node.append(typeof c === "string" || typeof c === "number" ? String(c) : c);
    });
    return node;
  }
  function show(nodes) { app.replaceChildren.apply(app, nodes); }
  function section(heading, children, slot) {
    var attrs = { heading: heading };
    if (slot) attrs.slot = slot;
    return el("s-section", attrs, children);
  }
  function ago(iso) {
    var mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    var rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
    if (mins < 60) return rtf.format(-mins, "minute");
    if (mins < 1440) return rtf.format(-Math.round(mins / 60), "hour");
    return rtf.format(-Math.round(mins / 1440), "day");
  }
  function metric(label, value) {
    return el("s-stack", { gap: "small-300" }, [el("s-text", { color: "subdued" }, label), el("s-heading", {}, value)]);
  }
  function helpLinks() {
    return el("s-paragraph", {}, [
      el("s-text", { color: "subdued" }, "Need help? "),
      el("s-link", { href: "mailto:support@instroom.io" }, "support@instroom.io"),
      el("s-text", { color: "subdued" }, " · "),
      el("s-link", { href: "https://instroom.io/privacy", target: "_blank" }, "Privacy policy"),
    ]);
  }

  // Retries once when the server asks for a fresh ID token.
  async function api(path, method) {
    for (var attempt = 0; attempt < 2; attempt++) {
      var token = await shopify.idToken();
      var res = await fetch(path, { method: method || "GET", headers: { Authorization: "Bearer " + token } });
      if (res.status === 401 && res.headers.get("X-Shopify-Retry-Invalid-Session-Request") && attempt === 0) continue;
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || "Request failed (" + res.status + ")");
      return data;
    }
  }

  function showError(message) {
    var retry = el("s-button", {}, "Try again");
    retry.addEventListener("click", load);
    show([el("s-banner", { tone: "critical", heading: "Something went wrong" }, [message, retry])]);
  }

  function showConnected(data) {
    var q = "?brandId=" + encodeURIComponent(data.brandId);
    var s = data.summary;
    var connection = section("Connection", el("s-stack", { gap: "base" }, [
      el("s-stack", { direction: "inline", gap: "small-200", alignItems: "center" }, [
        el("s-text", { type: "strong" }, "Linked to " + (data.brandName || "your Instroom brand")),
        el("s-badge", { tone: "success" }, "Connected"),
      ]),
      el("s-text", { color: "subdued" }, "Store: " + (data.storeName || "—") + " · Last synced " + (data.lastOrderSyncAt ? ago(data.lastOrderSyncAt) : "not yet")),
      el("s-stack", { direction: "inline", gap: "small-200" }, [
        el("s-button", { variant: "primary", href: "/dashboard/post-tracker" + q, target: "_blank" }, "Open Post Tracker"),
        el("s-button", { href: "/dashboard/settings/integrations" + q, target: "_blank" }, "Integration settings"),
      ]),
    ]));

    var summary = section("Orders from Instroom", el("s-stack", { gap: "base" }, [
      el("s-grid", { gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "base" }, [
        metric("Total", s.total), metric("Awaiting fulfillment", s.awaiting), metric("In transit", s.inTransit), metric("Delivered", s.delivered),
      ]),
      s.codeOrders ? el("s-text", { color: "subdued" }, s.codeOrders + " customer order" + (s.codeOrders === 1 ? "" : "s") + " used an influencer's discount code.") : null,
    ].filter(Boolean)));

    var recent = data.recent.length
      ? el("s-table", {}, [
          el("s-table-header-row", {}, ["Order", "Influencer", "Status", "Created"].map(function (h) { return el("s-table-header", {}, h); })),
          el("s-table-body", {}, data.recent.map(function (o) {
            var state = STATES[o.state] || STATES.awaiting;
            return el("s-table-row", {}, [
              el("s-table-cell", {}, el("s-link", { href: "shopify://admin/orders/" + o.id }, o.name)),
              el("s-table-cell", {}, o.influencer ? "@" + o.influencer : "—"),
              el("s-table-cell", {}, el("s-badge", { tone: state[1] }, state[0])),
              el("s-table-cell", {}, new Date(o.createdAt).toLocaleDateString()),
            ]);
          })),
        ])
      : el("s-paragraph", {}, "No orders yet. Create one from an influencer's Order tab in Post Tracker.");

    var steps = section("How it works", el("s-stack", { gap: "small-200" }, [
      el("s-paragraph", {}, "1. Create an influencer's order in Instroom Post Tracker."),
      el("s-paragraph", {}, "2. Fulfill it here in Shopify as usual."),
      el("s-paragraph", {}, "3. The influencer's card updates to In-Transit and Delivered automatically."),
    ]), "aside");

    show([connection, summary, section("Recent orders", recent), steps, section("Help", helpLinks(), "aside")]);
  }

  function showLink() {
    var note = el("s-paragraph", {}, "Instroom now has access to this store. Link it to your brand to start creating influencer orders and tracking shipments.");
    var link = el("s-button", { variant: "primary" }, "Link to your Instroom workspace");
    var refresh = el("s-button", {}, "Refresh");
    refresh.addEventListener("click", load);
    link.addEventListener("click", async function () {
      link.setAttribute("loading", "");
      try {
        var data = await api("/api/shopify-embedded/link", "POST");
        window.open(data.url, "_blank", "noopener");
        note.textContent = "Finish in the Instroom tab that just opened (sign in, choose the brand, confirm), then click Refresh.";
      } catch (e) {
        note.replaceChildren(el("s-text", { tone: "critical" }, e.message));
      } finally {
        link.removeAttribute("loading");
      }
    });
    show([
      section("Link this store to Instroom", el("s-stack", { gap: "base" }, [
        note,
        el("s-stack", { direction: "inline", gap: "small-200" }, [link, refresh]),
      ])),
      section("Help", helpLinks(), "aside"),
    ]);
  }

  async function load() {
    show([el("s-section", {}, el("s-spinner", { accessibilityLabel: "Loading" }))]);
    try {
      var data = await api("/api/shopify-embedded/status");
      data.connected ? showConnected(data) : showLink();
    } catch (e) {
      showError(e.message);
    }
  }

  load();
})();
</script>
</body>
</html>`

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "frame-ancestors https://admin.shopify.com https://*.myshopify.com;",
    },
  })
}
