/**
 * Overlays — Modal / BottomSheet / Sidebar (app port of upstream #8,
 * docs/overlay-mobile.md).
 *
 * The public surface is `useOverlay()` plus the provider; the components live
 * behind ./declarative (opt-in, guarded by ESLint) and the host behind
 * ./internal (closed).
 */
export { OverlayHostProvider as OverlayProvider } from './internal/host';
export { useOverlay } from './registry';
