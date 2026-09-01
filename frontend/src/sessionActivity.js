const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "mouseup",
  "click",
  "keydown",
  "input",
  "change",
  "touchstart",
  "pointermove",
  "pointerdown",
  "wheel",
  "scroll",
];

export function startInactivityTimer({ activityTarget, timeoutMs, onInactive }) {
  let timeoutId;

  const restartTimer = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(onInactive, timeoutMs);
  };

  ACTIVITY_EVENTS.forEach((eventName) => {
    activityTarget.addEventListener(eventName, restartTimer, { passive: true });
  });
  restartTimer();

  return () => {
    clearTimeout(timeoutId);
    ACTIVITY_EVENTS.forEach((eventName) => {
      activityTarget.removeEventListener(eventName, restartTimer);
    });
  };
}
