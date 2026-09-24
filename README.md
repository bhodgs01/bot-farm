# campus-engine

The one render pipeline behind the three KC Proto campuses:

- Unlimited Campus (`bhodgs01/unlimited-campus`)
- School of Brain (`bhodgs01/brain-campus`)
- Bot Farm (`bhodgs01/bot-farm`)

All three started as forks of the same engine and drifted. This repo is the single copy. It
holds the renderer setup, the post chain (bloom, depth-of-field tilt-shift, SMAA, output),
the frame loop, the adaptive render-scale governor, and the shadow-size table. Cameras, walk
mode, settings, worlds and crowds stay in each campus.

Requires `three` ^0.185 from the host campus. No dependencies of its own.

## How it is shared

Each campus vendors this repo at `src/engine/` with `git subtree`, so the pods keep cloning
one repo and `npm ci && vite build` exactly as before.

Edit the engine **here**, then pull it into each campus:

```sh
# in a campus checkout
git subtree pull --prefix=src/engine https://github.com/bhodgs01/campus-engine.git main --squash
```

First-time wiring of a campus:

```sh
git subtree add --prefix=src/engine https://github.com/bhodgs01/campus-engine.git main --squash
```

If a fix has to be made inside a campus first, push it back rather than leaving it stranded:

```sh
git subtree push --prefix=src/engine https://github.com/bhodgs01/campus-engine.git main
```

## Using it from a campus

```js
import { Engine, ENGINE_VERSION } from './engine/index.js'
```

and in the campus's `core/settings.js`, so its presets use the same table the engine does:

```js
export { SHADOW_SIZES } from '../engine/index.js'
```

Campus-specific overrides the engine already honors (set on the instance, all optional):
`rideFov`, `rideBoost`, `suppressTiltShift`, `setScene(scene)`, `setFocusDistance(d)`.

## Lineage

Derived from the MIT-licensed bot-crossing engine by Jarren Rocks (see LICENSE).
