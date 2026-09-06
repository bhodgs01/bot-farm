/**
 * Who each worker is, in one breath. Clicking an astronaut's body opens this rather than
 * its alert: a short first-person introduction of what the worker watches and when it
 * raises a hand. Sources may set `thread.intro` themselves; this fills in the rest.
 */

const name = (t) => String(t.title || 'a worker').replace(/^[^\w$]+/, '')

const BY_ID = [
  [/^chief:/, () => "I'm your chief of staff. I read the whole map every poll: who needs you, the deadlines, the weather, your sleep and today's API spend. Ask me what the day looks like."],
  [/^ledger:/, () => "I keep the books: what finished jobs still owe, what's in process, the pipeline, retainers per month, open print orders and today's API spend. The numbers stay on my card, not over my head."],
  [/^home:you$/, () => "I'm you, as the map sees you: last night's sleep and today's body battery from your Garmin."],
  [/^home:nap/, () => 'I watch the nap-time switch in Home Assistant. When it flips, the whole map goes dark; when you wake, it lightens.'],
  [/^frances:sensor/, () => "I'm the room sensor in Mary's apartment. I raise a hand when I go quiet for too long."],
  [/^frances:doors/, () => "I keep Mary's doors: front, back, garage and cave, straight from the sensors. Open count over my head; my hand goes up for a door open at night or open too long."],
  [/^frances:alarm/, () => "I'm the escalation ladder. When Frances opens an incident I hold it up until someone on the ladder acknowledges it; quiet floor and I just keep the recent events."],
  [/^games:/, () => "I'm the scoreboard. I sleep at the newsstand until a Kansas City team plays; on game day the kickoff and then the live score ride over my head."],
  [/^domains:/, () => "I keep the domain renewals, read from the public registry record. Count over my head inside 60 days; hand up inside 30."],
  [/^mary:/, () => "I'm Mary, the person Frances looks after. My vitals come live from the Garmin and the room sensors: heart rate, HRV, body battery, stress and sleep. My bubble goes up only if something is out of range."],
  [/^weather:/, () => "I'm the weather desk for Mission, Kansas. The temperature rides over my head; my card has the forecast and any alerts. I only raise a hand for warning-grade weather."],
  [/^news:/, (t) => `I'm the ${name(t)} correspondent. My briefing is written each morning from news.kcproto.com; press Read to go through it story by story.`],
  [/^cal:week$/, () => "I'm the week keeper. The number over my head is how many calendar events are still to come in the next seven days; hover me for the list."],
  [/^cal:/, () => "I'm one event on your calendar. I raise a hand inside the last 24 hours so tomorrow morning is visible tonight."],
  [/^chore:blake:list$/, () => 'I keep the chore board. The count over my head is what is left today; when it hits zero I celebrate.'],
  [/^chore:/, () => "I'm one chore from Chore Quest. Mark me done on my card and I beam up."],
  [/^deadline:/, () => "I'm a countdown to one dated thing you have to be ready for. Days left over my head; I raise a hand inside a week."],
  [/^keys?:/, () => "I audit the API keys in the cluster's secrets: which are live, which are dead, and what each key spent today. A dead key or an over-budget day raises my hand."],
  [/^spend:/, () => "I'm the spend meter: today's Anthropic API cost by key."],
  [/^tv:box$/, () => "I'm the on-site Embassy box, the EliteDesk that serves the portal as primary. If I go offline the portal fails over to home."],
  [/^tv:/, () => "I'm one of the Embassy signage TVs, a Raspberry Pi. If I answer the tailnet but refuse SSH, I need a reflash."],
  [/^janine:draft/, () => "I'm a reply Janine drafted and is holding for you. Send it or skip it from my card."],
  [/^order:/, () => "I'm a print order waiting on the farm: who ordered, what, and the quote."],
  [/^dr:/, () => 'I watch the Hetzner disaster-recovery box: its pods, its node, and whether the failover is live.'],
  [/^backup:/, () => "I watch the desktop backup: whether last night's Kopia snapshot ran."],
  [/^garage:fj40/, () => "I'm the FJ40 on the lift. The open items on the truck stand around me; click one for its next step."],
  [/^garage:/, () => "I'm one open item on the FJ40."],
  [/^fleet:flux/, () => 'I keep Flux honest: which kustomizations are reconciled and which have been stuck past the grace period.'],
  [/^fleet:disk/, () => 'I watch the disks on the nodes and raise a hand past 90 percent.'],
  [/^fleet:nas/, () => 'I watch the NAS: its shares, its space, and whether the cluster can still reach it.'],
  [/^fleet:failover/, () => 'I watch the failover between home and Hetzner by reading the canaries.'],
  [/^plex:/, () => "I'm a Plex stream someone is watching right now. What's playing is on the theater screen."],
  [/^trade:pot$/, () => "I hold the trade bot's pot: the account balance and today's P&L."],
  [/^trade:/, () => "I'm one open position held by the trade bot."],
  [/^mail:/, () => "I'm an email in the business inbox. I raise a hand when I've sat unanswered too long."],
  [/^print:req/, () => "I'm a print request that arrived by email with a model file. I need a quote and a printer."],
  [/^node:/, () => "I'm a Kubernetes node in the home cluster. Pods on my roof; I raise a hand when something on me is failing."],
]

const BY_SOURCE = {
  k3s: (t) => `I'm ${name(t)}, ${t.gitBranch || 'an AI agent'} running on the cluster${t.cwd ? ` (${t.cwd})` : ''}. I raise a hand when one of my pods is failing or I stop answering.`,
  nodes: () => "I'm a node in the home k3s cluster. Readiness, load and pods are on my card.",
  watchdog: () => "I'm a service the watchdog is checking. A hand up means it marked me down.",
  'brain-jobs': () => "I'm a feed sync job for the second brain. The blue i means I'm just reporting.",
  'print-farm': () => "I'm a 3D printer on the farm. Progress and ETA on my card; the camera too when you're on the home LAN.",
  'trade-bot': () => 'I report for the trade bot. Blue i means information only.',
  'chore-quest': () => "I'm a chore from Chore Quest.",
  vikunja: () => "I'm a ticket from Vikunja. Close me from my card when it's done.",
  'projects-board': () => "I'm a client project on the KC Proto board: what stage I'm at and what you owe me next, whether a follow-up, a delivery, or an invoice.",
  'news-desk': () => "I'm a news desk.",
  gmail: () => "I'm an email in the business inbox.",
  calendar: () => "I'm on your calendar.",
  caregiver: () => 'I report from the caregiver app.',
}

const BY_KIND = {
  task: () => "I'm a task that still has to be done.",
  done: () => "I'm a finished chore.",
  project: () => "I'm a client project.",
  device: () => "I'm a device on the tailnet.",
  keeper: () => 'I keep one post on the map and know its facts cold.',
  info: () => "I'm here for information only; the blue i means nothing is wrong.",
  watching: () => "I'm someone watching Plex.",
  weather: () => "I'm the weather desk.",
  briefing: () => "I'm a news correspondent.",
}

export function introFor(t) {
  if (typeof t.intro === 'string' && t.intro) return t.intro
  const id = String(t.id || '')
  for (const [re, fn] of BY_ID) if (re.test(id)) return fn(t)
  const bySource = BY_SOURCE[t.source]
  if (bySource) return bySource(t)
  const byKind = BY_KIND[t.kind]
  if (byKind) return byKind(t)
  return `I'm ${name(t)} on the ${t.project || 'map'} hex.`
}

export const withIntros = (threads) => threads.map((t) => (t.intro ? t : { ...t, intro: introFor(t) }))
