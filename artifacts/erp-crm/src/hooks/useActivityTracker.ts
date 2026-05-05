import { useEffect, useRef } from "react";
import { useAuth } from "./useAuth";

const BASE = import.meta.env.BASE_URL;
const HEARTBEAT_INTERVAL_MS = 30_000;
const IDLE_THRESHOLD_MS = 2 * 60 * 1000;

function api(path: string, body: object) {
  const t = localStorage.getItem("erp_token");
  return fetch(`${BASE}api${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {});
}

function genSessionKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useActivityTracker() {
  const { user } = useAuth();
  const sessionKey = useRef<string>(genSessionKey());
  const activeSeconds = useRef(0);
  const idleSeconds = useRef(0);
  const focusLostCount = useRef(0);
  const lastActivityAt = useRef(Date.now());
  const lastTickAt = useRef(Date.now());
  const started = useRef(false);

  useEffect(() => {
    if (!user) return;

    // Start session once
    if (!started.current) {
      started.current = true;
      api("/activity/session/start", { sessionKey: sessionKey.current });
    }

    function recordActivity() {
      lastActivityAt.current = Date.now();
    }

    function onFocusLost() {
      focusLostCount.current += 1;
      recordActivity(); // reset idle on return to page
    }

    // Track mouse + keyboard for activity
    window.addEventListener("mousemove", recordActivity, { passive: true });
    window.addEventListener("keydown", recordActivity, { passive: true });
    window.addEventListener("mousedown", recordActivity, { passive: true });
    window.addEventListener("scroll", recordActivity, { passive: true });
    document.addEventListener("visibilitychange", onFocusLost, { passive: true });
    window.addEventListener("blur", onFocusLost, { passive: true });

    // Accumulate active/idle seconds every second
    const ticker = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.round((now - lastTickAt.current) / 1000);
      lastTickAt.current = now;
      const idleSince = now - lastActivityAt.current;
      if (idleSince >= IDLE_THRESHOLD_MS) {
        idleSeconds.current += elapsed;
      } else {
        activeSeconds.current += elapsed;
      }
    }, 1000);

    // Heartbeat every 30 s
    const heartbeat = setInterval(() => {
      api("/activity/heartbeat", {
        sessionKey: sessionKey.current,
        activeSeconds: activeSeconds.current,
        idleSeconds: idleSeconds.current,
        focusLostCount: focusLostCount.current,
      });
    }, HEARTBEAT_INTERVAL_MS);

    // End session on tab/window close
    function endSession() {
      api("/activity/session/end", {
        sessionKey: sessionKey.current,
        activeSeconds: activeSeconds.current,
        idleSeconds: idleSeconds.current,
        focusLostCount: focusLostCount.current,
      });
    }
    window.addEventListener("beforeunload", endSession);

    return () => {
      window.removeEventListener("mousemove", recordActivity);
      window.removeEventListener("keydown", recordActivity);
      window.removeEventListener("mousedown", recordActivity);
      window.removeEventListener("scroll", recordActivity);
      document.removeEventListener("visibilitychange", onFocusLost);
      window.removeEventListener("blur", onFocusLost);
      window.removeEventListener("beforeunload", endSession);
      clearInterval(ticker);
      clearInterval(heartbeat);
      endSession();
    };
  }, [user?.id]);
}
