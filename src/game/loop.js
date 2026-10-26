// Fixed-timestep game loop: the simulation always advances in equal steps,
// independent of frame rate; rendering happens once per animation frame.

const MAX_FRAME_SECONDS = 0.25;

export function startLoop({ ticksPerSecond, update, render }) {
  const step = 1 / ticksPerSecond;
  let accumulator = 0;
  let last = performance.now();
  let frame;

  function onFrame(now) {
    // Clamp long gaps (background tab, breakpoint) so we don't fast-forward.
    accumulator += Math.min((now - last) / 1000, MAX_FRAME_SECONDS);
    last = now;
    while (accumulator >= step) {
      update();
      accumulator -= step;
    }
    render();
    frame = requestAnimationFrame(onFrame);
  }

  frame = requestAnimationFrame(onFrame);
  return () => cancelAnimationFrame(frame);
}
