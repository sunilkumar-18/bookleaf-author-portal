"use client";
// Near-real-time updates via polling. Chosen over WebSockets/SSE because it is
// reliable on serverless hosting (Vercel functions can't hold long-lived
// connections) and ticket updates don't need sub-second latency.
// Polling pauses while the tab is hidden and refreshes immediately on return.
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

export function usePolling(path, intervalMs = 5000) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const pathRef = useRef(path);
  pathRef.current = path;

  const refresh = useCallback(async () => {
    const requested = pathRef.current;
    if (!requested) return;
    try {
      const json = await api(requested);
      if (pathRef.current === requested) {
        setData(json);
        setError(null);
      }
    } catch (err) {
      if (pathRef.current === requested) setError(err);
    } finally {
      if (pathRef.current === requested) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, intervalMs);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [path, intervalMs, refresh]);

  return { data, error, loading, refresh, setData };
}
