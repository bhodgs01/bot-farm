/**
 * campus-engine: the one render pipeline behind Unlimited Campus, the School of Brain and the
 * Bot Farm. Renderer, post chain (bloom, depth-of-field tilt-shift, SMAA), the frame loop, the
 * adaptive quality governor, and the shadow-size table.
 *
 * Vendored into each campus at `src/engine/` with `git subtree`; edit it HERE and pull it into
 * each campus, never the other way round, or the three copies drift apart again.
 */
export { Engine } from './engine.js'
export { createTiltShift } from './tiltshift.js'
export { SHADOW_SIZES } from './shadows.js'

/** Bump on every change that alters what a frame looks like, so a campus can say which engine drew it. */
export const ENGINE_VERSION = '0.1.0'
