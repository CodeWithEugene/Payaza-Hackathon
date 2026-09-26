import * as React from "react"

const MOBILE_BREAKPOINT = 768

function subscribe(callback: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

function getSnapshot() {
  return window.innerWidth < MOBILE_BREAKPOINT
}

// Server snapshot: assume desktop until hydrated (matches the previous
// `!!isMobile` behavior where the pre-effect value was falsy).
function getServerSnapshot() {
  return false
}

export function useIsMobile() {
  // useSyncExternalStore is the React-blessed way to read a mutable external
  // value (the viewport) — no setState-in-effect cascade, SSR-safe.
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
