export const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));
export function swipeTarget(
  start: number,
  deltaX: number,
  width: number,
  duration: number,
  sensitivity: number,
) {
  return clamp(
    start + (deltaX / Math.max(width, 1)) * sensitivity,
    0,
    Math.max(0, duration - 0.1),
  );
}
export function formatTime(seconds = 0) {
  const n = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return n >= 3600
    ? `${Math.floor(n / 3600)}:${String(Math.floor(n / 60) % 60).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`
    : `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
}
