# Set piece request: `comicshop` — the Collectorz tile

**How to use this:** paste `docs/design-brief.md` into ChatGPT first (it defines the helper API,
the palette, the scale rules and two worked examples), then paste everything below. Take the
function it returns and run `python scripts/import_pieces.py <file.js>`.

---

Write one set piece named `comicshop`.

## What the tile is

Collectorz is an app you point a phone at a comic, a card, a coin or an old book, and it tells
you what it is and what it is worth. The people using it are usually not collectors. They
inherited a box and they do not know whether it is worth $5 or $5,000.

So this tile is **the appraisal counter of a comic shop**, not the shopping aisle. The feeling
should be "bring your box to the counter and find out", not "browse new releases". A comic shop
is the right building because it is the one store that really does sell comics, sports cards,
Pokemon and a tray of coins under one roof, which is exactly the four things the app handles.

Read it as: the moment the guy behind the counter picks up the loupe.

## What it should contain

Build these, in roughly this order of importance. Drop the last ones before you exceed the part
budget, do not cram everything in.

1. **A glass display counter** across the front, facing `+z`, open side to the camera. This is
   the hero. Dark base, a `SOLAR_A` or `SOLAR_B` glass top and front, lit from inside
   (`CELL.WHITE` with `emissive`). Inside it, **three or four graded slabs standing upright**,
   each a thin flat box: mostly clear glass with a small `CELL.WHITE` strip across the top for
   the grading label. Those slabs are the single most recognisable thing in the piece, so make
   them clearly readable from 45 degrees above.
2. **A revolving spinner rack** beside or behind the counter. A pole with two or three round
   wire tiers and comics faced outward on them. **This is the one moving part:** give the rack
   `spin` of about 0.4 to 0.8 rad/s so it turns slowly. Classic comic shop silhouette.
3. **A longbox** on the floor, lid off, with the top edges of packed comics showing as a row of
   thin upright slivers in mixed cells. Put it where an astronaut can stand next to it.
4. **A loupe and a small coin tray on the counter.** The loupe is a tiny cylinder plus a disc of
   glass, lying on its side or standing on its handle. The coin tray is a shallow `CELL.SLATE`
   box with three or four small flat `CELL.TRIM` cylinders in it. Small, but they are the two
   props that say "appraisal" rather than "retail".
5. **A back wall at `-z`** with a few comics faced out flat on it, like a new-release wall.
   Keep it low enough not to hide the counter.
6. **A hanging sign or a low shelf of old hardback books** at one end, if parts allow. The books
   are just stacked thin boxes in `CELL.ROCK` and `CELL.WHITE`.

## Rules specific to this piece

- **Accent:** this tile's accent is a warm red. Use `CELL.TRIM` for the awning or sign face, the
  spinner rack tiers, and the coins. Do not paint the whole building `TRIM`, it should read as
  an accent.
- **Glow, two points only:** the inside of the display case, and the sign. Everything else dark.
  The case light is what makes it read as a counter at night.
- **Leave the front edge clear.** Astronauts walk up to the counter from `+z`, so no low clutter
  in front of it that they would clip through. The longbox goes to one side, not dead centre.
- **Use `rand()`** for the small stuff: which cell each faced-out comic is, the yaw of the
  spinner rack, whether the loupe is lying down or standing. Three copies on one tile must not
  look identical.
- **No lettering, no logos, no faces.** Nothing smaller than about 5 cm reads at this zoom. A
  comic cover is one flat coloured rectangle, not artwork.
- Return the label `'Comic Shop'`.

## Budget

About 3.2 units wide, 1.8 to 2.2 units tall, footprint inside 3.2 x 3.2, under 60 parts. Fewer
big shapes beat many small ones. If you have to choose, the counter with lit slabs and the
spinner rack are the two that must survive.
