import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SessionTimeout } from "../components/session-timeout";

describe("encerramento por inatividade", () => {
  it("avisa antes de encerrar e reinicia a contagem após atividade", () => {
    vi.useFakeTimers();
    const onWarning = vi.fn();
    const onTimeout = vi.fn();
    render(
      <SessionTimeout
        warningAfterMs={105}
        timeoutAfterMs={120}
        onWarning={onWarning}
        onTimeout={onTimeout}
      />,
    );

    act(() => vi.advanceTimersByTime(105));
    expect(onWarning).toHaveBeenCalledOnce();
    window.dispatchEvent(new Event("pointerdown"));
    act(() => vi.advanceTimersByTime(119));
    expect(onTimeout).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onTimeout).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
