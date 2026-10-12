import { useEffect, useRef } from "react";

type SessionTimeoutProps = {
  onWarning: () => void;
  onTimeout: () => void;
  warningAfterMs?: number;
  timeoutAfterMs?: number;
};

export function SessionTimeout({
  onWarning,
  onTimeout,
  warningAfterMs = 105 * 60 * 1000,
  timeoutAfterMs = 120 * 60 * 1000,
}: SessionTimeoutProps) {
  const warningTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const timeoutTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const reset = () => {
      if (warningTimer.current) clearTimeout(warningTimer.current);
      if (timeoutTimer.current) clearTimeout(timeoutTimer.current);
      warningTimer.current = setTimeout(onWarning, warningAfterMs);
      timeoutTimer.current = setTimeout(onTimeout, timeoutAfterMs);
    };
    const events = ["pointerdown", "keydown", "touchstart"];
    events.forEach((event) => window.addEventListener(event, reset));
    reset();
    return () => {
      events.forEach((event) => window.removeEventListener(event, reset));
      if (warningTimer.current) clearTimeout(warningTimer.current);
      if (timeoutTimer.current) clearTimeout(timeoutTimer.current);
    };
  }, [onTimeout, onWarning, timeoutAfterMs, warningAfterMs]);

  return null;
}
