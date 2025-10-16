export function throttleLog(label, fn, delay = 300) {
  let timeout;
  return (...args) => {
    if (timeout) return;
    timeout = setTimeout(() => {
      console.groupCollapsed(`[${label}]`);
      fn(...args);
      console.groupEnd();
      timeout = null;
    }, delay);
  };
}
