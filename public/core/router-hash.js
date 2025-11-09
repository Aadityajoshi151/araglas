// core/router-hash.js - hash-based router utilities

export function parseHashParams() {
  const hash = location.hash.split("?")[1] || "";
  const params = new URLSearchParams(hash);
  return Object.fromEntries(params.entries());
}

export function runRoute(routes, defaultFn, onError) {
  try {
    const [base] = location.hash.split("?");
    const fn = routes[base] || defaultFn;
    const res = fn && typeof fn === 'function' ? fn() : undefined;
    if (res && typeof res.then === 'function') {
      return res.catch(err => { onError && onError(err); });
    }
    return Promise.resolve(res);
  } catch (err) {
    onError && onError(err);
    return Promise.resolve();
  }
}

export function listen(routes, defaultFn, onError) {
  window.addEventListener("hashchange", () => runRoute(routes, defaultFn, onError));
}
