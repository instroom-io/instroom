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
<title>Instroom</title>
<style>
  body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #303030; background: #f1f1f1; }
  main { max-width: 520px; margin: 24px auto; padding: 20px 24px; background: #fff; border-radius: 12px; box-shadow: 0 1px 2px rgba(0,0,0,.08); }
  h1 { font-size: 16px; margin: 0 0 8px; }
  p { font-size: 14px; line-height: 1.5; color: #616161; margin: 0 0 12px; }
  .error { color: #8e1f0b; }
  button, a.button { display: inline-block; font: inherit; font-size: 14px; font-weight: 600; padding: 8px 14px; border-radius: 8px; border: 0; cursor: pointer; text-decoration: none; }
  .primary { background: #1fae5b; color: #fff; }
  .secondary { background: #e3e3e3; color: #303030; margin-left: 8px; }
  button:disabled { opacity: .6; cursor: default; }
</style>
</head>
<body>
<main id="app"><p>Loading…</p></main>
<script>
(function () {
  var app = document.getElementById("app");

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text) node.textContent = text;
    return node;
  }
  function show(nodes) { app.replaceChildren.apply(app, nodes); }

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
    var retry = el("button", { class: "primary" }, "Try again");
    retry.onclick = load;
    show([el("h1", {}, "Something went wrong"), el("p", { class: "error" }, message), retry]);
  }

  function showConnected(data) {
    var open = el("a", { class: "button primary", href: "/dashboard?brandId=" + encodeURIComponent(data.brandId), target: "_blank", rel: "noopener" }, "Open Instroom");
    show([
      el("h1", {}, "Connected to Instroom"),
      el("p", {}, "Store: " + (data.storeName || "—")),
      el("p", {}, "Orders last synced: " + (data.lastOrderSyncAt ? new Date(data.lastOrderSyncAt).toLocaleString() : "not yet")),
      open,
    ]);
  }

  function showLink() {
    var link = el("button", { class: "primary" }, "Link to your Instroom workspace");
    var refresh = el("button", { class: "secondary" }, "Refresh");
    var note = el("p", {}, "Instroom now has access to this store. Link it to your brand to start creating influencer orders and tracking shipments.");
    refresh.onclick = load;
    link.onclick = async function () {
      link.disabled = true;
      try {
        var data = await api("/api/shopify-embedded/link", "POST");
        window.open(data.url, "_blank", "noopener");
        note.textContent = "Finish in the Instroom tab that just opened (sign in, choose the brand, confirm), then click Refresh.";
      } catch (e) {
        note.textContent = e.message;
        note.className = "error";
      } finally {
        link.disabled = false;
      }
    };
    show([el("h1", {}, "Link this store to Instroom"), note, link, refresh]);
  }

  async function load() {
    show([el("p", {}, "Loading…")]);
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
