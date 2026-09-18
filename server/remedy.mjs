/**
 * The known fixes.
 *
 * The map has always been able to point at a failure and never to do anything about it, so
 * a flag Blake could have cleared in one command still cost him a terminal, a context switch
 * and the memory of which namespace it lived in. These are the two remedies that come up
 * often enough to be worth a button: restart a workload that is short of replicas, and poke
 * a Flux kustomization that has stopped reconciling.
 *
 * Three rules hold this to a button rather than a back door:
 *
 *   1. The target is never taken from the browser. The client sends a thread id; the server
 *      finds that thread in its own scan and uses the `remedy` its harness attached. A page
 *      cannot ask to restart something the map is not already flagging.
 *   2. Only a thread that is actually failing can be fixed. No flag, no action.
 *   3. Every remedy verifies. It reads the resource back and says what it saw, because a fix
 *      that reports success without looking is worse than no button at all.
 */
import fsp from 'node:fs/promises'

const SA_DIR = '/var/run/secrets/kubernetes.io/serviceaccount'
const KUBE_API = process.env.KUBERNETES_SERVICE_HOST
  ? `https://${process.env.KUBERNETES_SERVICE_HOST}:${process.env.KUBERNETES_SERVICE_PORT || 443}`
  : ''
const TIMEOUT_MS = 30 * 1000

/** Namespaces a remedy may touch at all. Empty means "whatever the roster covers". */
const ALLOWED_NS = new Set(
  String(process.env.REMEDY_NAMESPACES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)

const NAME_OK = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/

let saToken = null
async function token() {
  if (saToken !== null) return saToken
  try {
    saToken = (await fsp.readFile(`${SA_DIR}/token`, 'utf8')).trim()
  } catch {
    saToken = ''
  }
  return saToken
}

async function kube(apiPath, { method = 'GET', body, contentType } = {}) {
  const t = await token()
  if (!t || !KUBE_API) throw new Error('No cluster credentials on this server')
  const res = await fetch(KUBE_API + apiPath, {
    method,
    headers: {
      Authorization: `Bearer ${t}`,
      Accept: 'application/json',
      ...(contentType ? { 'Content-Type': contentType } : {}),
    },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`${method} ${apiPath.split('?')[0]} → ${res.status} ${(await res.text().catch(() => '')).slice(0, 160)}`)
  return res.json()
}

/**
 * The remedy a thread is offering, validated. Returns null when the thread has none, is not
 * actually failing, or names something outside what a remedy is allowed to touch — so a
 * harness cannot widen this by accident, only the list above can.
 */
export function remedyFor(thread) {
  const r = thread?.remedy
  if (!r || !thread.hasError) return null
  if (!['restart', 'reconcile'].includes(r.kind)) return null
  if (!NAME_OK.test(String(r.ns || '')) || !NAME_OK.test(String(r.name || ''))) return null
  if (ALLOWED_NS.size && !ALLOWED_NS.has(r.ns)) return null
  return { kind: r.kind, ns: r.ns, name: r.name, label: String(r.label || 'Fix it').slice(0, 60) }
}

/**
 * Roll a deployment. The same thing `kubectl rollout restart` does: stamp the pod template
 * with a fresh timestamp and let the controller replace the pods. Deliberately not a delete
 * — a rollout respects the deployment's own surge and availability rules, so a restart of
 * something healthy-ish does not take it down on the way.
 */
async function restart({ ns, name }) {
  const path = `/apis/apps/v1/namespaces/${ns}/deployments/${name}`
  const before = await kube(path)
  const at = new Date().toISOString()
  await kube(path, {
    method: 'PATCH',
    contentType: 'application/strategic-merge-patch+json',
    body: JSON.stringify({ spec: { template: { metadata: { annotations: { 'kubectl.kubernetes.io/restartedAt': at } } } } }),
  })
  const after = await kube(path)
  const stamped = after.spec?.template?.metadata?.annotations?.['kubectl.kubernetes.io/restartedAt']
  if (stamped !== at) throw new Error('the cluster did not take the restart')
  const want = after.spec?.replicas ?? 1
  const ready = after.status?.readyReplicas || 0
  return {
    did: `Restarted ${ns}/${name}`,
    // Read back honestly: the rollout has only just started, so this is the state it left in,
    // not a claim that anything is fixed yet.
    note: `was ${before.status?.readyReplicas || 0}/${before.spec?.replicas ?? 1} ready, now rolling (${ready}/${want})`,
  }
}

/**
 * Ask Flux to reconcile now rather than at the top of its interval — the annotation its
 * controllers watch for. Used on a kustomization that has gone stale.
 */
async function reconcile({ ns, name }) {
  const path = `/apis/kustomize.toolkit.fluxcd.io/v1/namespaces/${ns}/kustomizations/${name}`
  const at = new Date().toISOString()
  await kube(path, {
    method: 'PATCH',
    contentType: 'application/merge-patch+json',
    body: JSON.stringify({ metadata: { annotations: { 'reconcile.fluxcd.io/requestedAt': at } } }),
  })
  const after = await kube(path)
  if (after.metadata?.annotations?.['reconcile.fluxcd.io/requestedAt'] !== at) throw new Error('Flux did not take the request')
  const ready = (after.status?.conditions || []).find((c) => c.type === 'Ready')
  return {
    did: `Asked Flux to reconcile ${ns}/${name}`,
    note: ready ? `last said: ${String(ready.message || ready.status).slice(0, 120)}` : 'requested; watch the tile for the result',
  }
}

/** Run a validated remedy. Throws with something a human can read if it will not go. */
export async function runRemedy({ remedy, who }) {
  const out = remedy.kind === 'restart' ? await restart(remedy) : await reconcile(remedy)
  console.log(`act: ${who} ran ${remedy.kind} on ${remedy.ns}/${remedy.name} — ${out.note}`)
  return out
}
