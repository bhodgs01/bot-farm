/**
 * Shadow map size per `shadows` setting. Lives with the engine rather than in a campus's
 * settings file because the engine is what sizes the maps; a campus's settings re-export it
 * so its presets and the engine can never disagree about what "low" means.
 */
export const SHADOW_SIZES = { off: 0, low: 1024, high: 2048, ultra: 4096 }
