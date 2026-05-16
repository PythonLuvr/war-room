"use client";

// Top-level error boundary. Catches errors thrown by the root layout
// itself, which app/error.tsx can't reach because that one renders
// INSIDE the layout. Must include its own <html> + <body> since the
// layout failed.

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[war-room] global error boundary tripped:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          background: "#0a0a0a",
          color: "#e5e5e5",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "3rem 1.5rem",
        }}
      >
        <div style={{ maxWidth: "32rem", width: "100%", textAlign: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/war-bit/angry.png"
            alt="WarBit, angry the layout crashed"
            width={160}
            height={160}
            style={{
              width: 160,
              height: 160,
              margin: "0 auto 1.5rem",
              imageRendering: "pixelated",
              opacity: 0.9,
            }}
          />
          <h1
            style={{
              fontSize: "1.875rem",
              fontWeight: 600,
              margin: "0 0 0.5rem",
            }}
          >
            App layout crashed.
          </h1>
          <p
            style={{
              fontSize: "0.875rem",
              color: "#a3a3a3",
              lineHeight: 1.6,
              margin: "0 0 1rem",
            }}
          >
            The shell itself threw an error before the dashboard could
            render. Retry to reload the layout; if it keeps crashing,
            the error message below is the place to start.
          </p>
          {error.message && (
            <pre
              style={{
                textAlign: "left",
                fontSize: "0.6875rem",
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, monospace",
                background: "#171717",
                border: "1px solid #262626",
                borderRadius: "0.375rem",
                padding: "0.75rem",
                overflowX: "auto",
                margin: "0 0 0.5rem",
                color: "rgba(252, 165, 165, 0.9)",
              }}
            >
{error.message}
            </pre>
          )}
          <button
            onClick={reset}
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              borderRadius: "0.375rem",
              background: "rgba(245, 158, 11, 0.2)",
              border: "1px solid rgba(245, 158, 11, 0.4)",
              color: "rgb(254, 215, 170)",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      </body>
    </html>
  );
}
