/**
 * The harness registry.
 *
 * The colony is the JARVIS Armada by default. Set COLONY_HARNESSES=jarvis-cluster,claude-code
 * to also walk this machine's Claude Code sessions out of the same ship.
 */
import claudeCode from './claude-code.mjs'
import jarvisCluster from './jarvis-cluster.mjs'

const ALL = { 'jarvis-cluster': jarvisCluster, 'claude-code': claudeCode }
const wanted = (process.env.COLONY_HARNESSES || 'jarvis-cluster').split(',').map((s) => s.trim()).filter(Boolean)

export const HARNESSES = wanted.map((id) => ALL[id]).filter(Boolean)

export const harnessById = (id) => HARNESSES.find((h) => h.id === id) || null

/**
 * Which harnesses have data on this machine. Detection is per-scan rather than cached at
 * boot so that installing one while the colony is running is picked up on the next poll.
 */
export async function detectedHarnesses() {
  const flags = await Promise.all(
    HARNESSES.map(async (h) => {
      try {
        return await h.detect()
      } catch {
        return false
      }
    })
  )
  return HARNESSES.filter((_, i) => flags[i])
}
