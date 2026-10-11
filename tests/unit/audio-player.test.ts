import { describe, expect, it } from "vitest";
import { playOnly, release } from "@/components/audio-player";

// A stand-in for an <audio> element: counts pauses, and plays or refuses as told.
const player = (refuse = false) => {
  const p = { pauses: 0, play: () => (refuse ? Promise.reject(new DOMException("blocked", "NotAllowedError")) : Promise.resolve()), pause: () => void p.pauses++ };
  return p;
};

describe("audio player", () => {
  it("pauses the intro that was playing when another starts", async () => {
    const [a, b] = [player(), player()];
    await playOnly(a, () => {});
    await playOnly(b, () => {});
    expect(a.pauses).toBe(1);
    expect(b.pauses).toBe(0);
    release(b);
  });

  it("goes back to paused when the browser refuses to play, and forgets that player", async () => {
    const [blocked, next] = [player(true), player()];
    let refused = 0;
    await playOnly(blocked, () => refused++);
    expect(refused).toBe(1);
    expect(blocked.pauses).toBe(1);
    await playOnly(next, () => {});
    expect(blocked.pauses).toBe(1);
    release(next);
  });

  it("forgets an intro once it has ended", async () => {
    const [a, b] = [player(), player()];
    await playOnly(a, () => {});
    release(a);
    await playOnly(b, () => {});
    expect(a.pauses).toBe(0);
    release(b);
  });
});
