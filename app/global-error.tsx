"use client";

import { useEffect, useState } from "react";
import { isChunkError } from "@/lib/chunkError";

const RELOAD_GUARD_KEY = "chowk-chunk-reload-at";
const RELOAD_WINDOW_MS = 15_000;

/**
 * Last-resort error page (replaces Next's generic built-in one).
 *
 * Chunk-load failures — the user had a page open from a previous deployment
 * and a client navigation hit a renamed JS chunk — self-heal with a single
 * hard reload (guarded so a genuinely missing chunk can't loop forever).
 * Anything else gets a simple branded fallback with Reload / Back.
 *
 * NOTE: this renders outside the root layout, so no app CSS or components
 * are available here — inline styles only, English copy only.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [status, setStatus] = useState<"checking" | "reloading" | "failed">(
    "checking"
  );
  const chunk = isChunkError(error);

  useEffect(() => {
    if (!chunk) {
      setStatus("failed");
      return;
    }
    // One self-healing reload per window; otherwise show the fallback.
    try {
      const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0);
      if (Date.now() - last < RELOAD_WINDOW_MS) {
        setStatus("failed");
        return;
      }
      sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
    } catch {
      setStatus("failed");
      return;
    }
    setStatus("reloading");
    const t = window.setTimeout(() => window.location.reload(), 400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F5F4FA",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: 16,
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <div style={{ fontSize: 44, lineHeight: 1 }}>{"\u26A0\uFE0F"}</div>
          <h1
            style={{
              margin: "16px 0 8px",
              fontSize: 22,
              fontWeight: 700,
              color: "#211D33",
            }}
          >
            {status === "reloading"
              ? "Updating Chowk..."
              : "This page couldn't load"}
          </h1>
          <p
            style={{
              margin: "0 0 24px",
              fontSize: 15,
              lineHeight: 1.5,
              color: "#6F6B80",
            }}
          >
            {status === "reloading"
              ? "A new update just went live — refreshing to the latest version."
              : "Reload to try again, or go back."}
          </p>
          {status !== "reloading" && (
            <div
              style={{ display: "flex", gap: 12, justifyContent: "center" }}
            >
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  cursor: "pointer",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 24px",
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#fff",
                  backgroundColor: "#211D33",
                }}
              >
                Reload
              </button>
              <button
                type="button"
                onClick={() => window.history.back()}
                style={{
                  cursor: "pointer",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  padding: "10px 24px",
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#211D33",
                  backgroundColor: "#fff",
                }}
              >
                Back
              </button>
            </div>
          )}
          {status === "failed" && error?.message && (
            <details
              style={{
                marginTop: 20,
                fontSize: 12,
                color: "#6F6B80",
                textAlign: "left",
                backgroundColor: "#fff",
                borderRadius: 8,
                padding: "8px 12px",
                wordBreak: "break-word",
              }}
            >
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                Error details
              </summary>
              <p style={{ margin: "8px 0 0" }}>{error.message}</p>
            </details>
          )}
        </div>
      </body>
    </html>
  );
}
