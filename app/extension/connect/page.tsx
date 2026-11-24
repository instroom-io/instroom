"use client";

// /extension/connect — links the Instroom Chrome extension to the signed-in
// account. The extension opens this page in a new tab; the user confirms with
// a click (a token is never minted just by visiting a link), the page asks the
// server for a token and hands it to the extension through Chrome's
// externally_connectable messaging. Only extension IDs listed in
// NEXT_PUBLIC_CHROME_EXTENSION_IDS ever receive it.

import { useState } from "react";
import { useSession } from "next-auth/react";
import { signOutEverywhere } from "@/lib/sign-out";
import { Button } from "@/components/ui/button";

type Status = "idle" | "connecting" | "connected" | "no_extension" | "error";

const EXTENSION_IDS = (process.env.NEXT_PUBLIC_CHROME_EXTENSION_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

type ChromeRuntime = {
  sendMessage: (
    extensionId: string,
    message: unknown,
    callback: (response: unknown) => void
  ) => void;
  lastError?: { message?: string };
};

function getChromeRuntime(): ChromeRuntime | null {
  const w = window as unknown as { chrome?: { runtime?: ChromeRuntime } };
  return w.chrome?.runtime && typeof w.chrome.runtime.sendMessage === "function"
    ? w.chrome.runtime
    : null;
}

/** Send to one extension; resolves true only if it answered { ok: true }. */
function sendToExtension(runtime: ChromeRuntime, extensionId: string, message: unknown) {
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), 3000);
    try {
      runtime.sendMessage(extensionId, message, (response) => {
        clearTimeout(timer);
        // Reading lastError marks it handled; set when the ID isn't installed.
        if (runtime.lastError) return resolve(false);
        resolve(!!(response && (response as { ok?: boolean }).ok));
      });
    } catch {
      clearTimeout(timer);
      resolve(false);
    }
  });
}

export default function ExtensionConnectPage() {
  const { data: session, status: sessionStatus } = useSession();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setError(null);
    const runtime = getChromeRuntime();
    if (!runtime || EXTENSION_IDS.length === 0) {
      setStatus("no_extension");
      return;
    }

    setStatus("connecting");
    let tokenId: string | null = null;
    try {
      const res = await fetch("/api/extension/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Chrome extension" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) {
        throw new Error(data.error || "Couldn't connect the extension. Please try again.");
      }
      tokenId = data.id;

      const message = {
        type: "instroom_connect",
        token: data.token,
        expires_at: data.expires_at,
        user: data.user,
        app_origin: window.location.origin,
      };

      let delivered = false;
      for (const id of EXTENSION_IDS) {
        if (await sendToExtension(runtime, id, message)) {
          delivered = true;
          break;
        }
      }

      if (!delivered) {
        // Nobody took the token — don't leave a live credential behind.
        await fetch(`/api/extension/tokens/${tokenId}`, { method: "DELETE" }).catch(() => {});
        setStatus("no_extension");
        return;
      }
      setStatus("connected");
    } catch (err) {
      if (tokenId) {
        await fetch(`/api/extension/tokens/${tokenId}`, { method: "DELETE" }).catch(() => {});
      }
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  const email = session?.user?.email;

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md rounded-xl border bg-background p-8 shadow-sm text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/instroom-wordmark.png" alt="Instroom" className="mx-auto h-8 mb-6" />

        {status === "connected" ? (
          <>
            <h1 className="text-xl font-semibold mb-2">Extension connected</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Your Instroom extension is now signed in as <strong>{email}</strong>. You can
              close this tab and go back to Instagram or TikTok.
            </p>
            <Button onClick={() => window.close()} className="w-full">
              Close this tab
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold mb-2">Connect the Chrome extension</h1>
            <p className="text-sm text-muted-foreground mb-6">
              The extension will be able to add influencers to the workspaces you belong to,
              as{" "}
              <strong>{sessionStatus === "loading" ? "…" : email ?? "your account"}</strong>.
            </p>

            {status === "no_extension" && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3 mb-4 text-left">
                We couldn&apos;t reach the Instroom extension. Make sure it&apos;s installed and
                enabled in this Chrome profile, then try again.
              </p>
            )}
            {status === "error" && error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3 mb-4 text-left">
                {error}
              </p>
            )}

            <Button
              onClick={connect}
              disabled={status === "connecting" || sessionStatus !== "authenticated"}
              className="w-full"
            >
              {status === "connecting" ? "Connecting…" : "Connect extension"}
            </Button>

            <button
              type="button"
              onClick={() => signOutEverywhere("/login?callbackUrl=/extension/connect")}
              className="mt-4 text-xs text-muted-foreground underline"
            >
              Not you? Sign in with a different account
            </button>
          </>
        )}
      </div>
    </main>
  );
}
