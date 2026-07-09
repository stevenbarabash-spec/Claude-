# Reusable Build Patterns — Interactive Tiles & Cards

This file captures durable UX/engineering patterns proven out during the
Greenwich Dental Group (GDG) site build. Apply this thinking whenever
building any interactive tile grid, carousel, hover-reveal card, or
similar "grid of things that expand/reveal more info" component on this
or future site builds — not just literally reusing the CSS/JS, but the
underlying way of thinking about these components.

## The mindset: think through every state and transition, not just the happy path

When building something like "hover a tile to reveal more" or "a
carousel of items," don't just wire up the primary interaction. Walk
through the full state machine and ask, for each interactive element:

- What does it look like in each of its distinct states (idle, hovering,
  active-but-not-hovering, playing, closed)?
- How does a user get from one state to another, and does the *feel* of
  that transition match how "in a hurry" vs. "unhurried" it should be?
- What happens when the user moves attention elsewhere without an
  explicit "close" action — should the thing stay put, or revert?
- What happens on the device/input type you didn't build it for first
  (mobile after desktop, touch after mouse)?
- What edge cases exist at the *boundaries* — first load, last item,
  scroll extremes, rapid repeated interaction?

## Specific patterns proven out on the GDG doctor-tile grid

**"Active" state decoupled from "playing" state.** A tile's video only
plays while the cursor is actually over it (`playing` class), but once a
user has engaged with a tile enough to open its detail/profile card,
that tile should stay visually "lit up" (full color, not grayscale)
for as long as the card is showing that item — independent of whether
the video is still playing. Use two separate classes (`playing` vs.
`active`) rather than conflating "currently hovered" with "currently
selected/displayed."

**A shared detail panel that stays open and crossfades content,
never closes-then-reopens.** When multiple grid items share one detail
panel below/beside the grid, do NOT close the panel on every
mouseleave and reopen it on the next item's mouseenter — that reads as
the whole section sliding shut and open repeatedly, which looks
broken/glitchy. Instead: the panel opens once, stays open as focus
moves between items, and its *content* crossfades (quick fade
out/in on a wrapper — ~250-300ms) while the container itself never
changes height. Only close it on an explicit action (click away, close
button) — not implicitly on hover loss.

**First reveal is slow/staggered; subsequent content swaps are fast.**
The very first time a card opens, let the container expand slowly
(1-1.3s, eased) with individual text fields (quote, name, bio, etc.)
fading/rising in with a staggered delay each — it should read as an
unhurried, deliberate reveal, not a snap. But once already open,
swapping to a different item's content should NOT replay that slow
stagger — it should be a quick, simple crossfade (~280ms). Reusing the
slow stagger for every swap feels sluggish; reusing the fast crossfade
for the first open feels abrupt. Use both, for their appropriate
moment.

**Guard against layout-shift feedback loops.** Any time an element's
expansion/collapse changes page height, consider whether that could:
(a) make a scrollbar appear/disappear, shifting horizontal layout under
the cursor mid-hover, which can re-trigger the same
hover-in/hover-out logic in a loop (fix: `scrollbar-gutter: stable`,
and/or a short "hover intent" debounce — ~120ms — before actually
closing something on mouseleave, so a one-frame spurious leave event
doesn't tear the whole thing down); (b) fight with a spacer element
that's reserving space for a `position: fixed` header (resizing that
spacer in response to a scroll-triggered class toggle causes scroll
anchoring to "correct" the scroll position, re-triggering the toggle —
infinite jitter loop. Fix: never resize that spacer in response to the
same interaction that's driven by scroll position; size it once and
leave it alone).

**`overflow-x: auto` implicitly clips `overflow-y` too (CSS spec
quirk).** If a scrollable tile/card that lives inside such a container
needs its box-shadow (or anything else) to bleed outside the tile's own
box on hover, give the *scroll container* generous vertical padding
(offset with a matching negative margin on the outside if you need net
page-spacing to stay the same) so the shadow fades to near-zero alpha
before it reaches that clip boundary — otherwise it gets cut into a
visible hard rectangular line.

**iOS Safari chains scroll momentum from a nested scrollable element
into the whole page.** Any horizontally swipeable carousel/track needs
`overscroll-behavior-x: contain` (or `overscroll-behavior: contain`),
or reaching the end of the swipeable content can bleed leftover
momentum into scrolling the entire page sideways, breaking the layout.
Pair this with a defensive `html, body { overflow-x: hidden; max-width:
100%; }` site-wide as cheap insurance against any horizontal overflow
bug class, even on pages without a swipeable element.

**Video-heavy tile grids: never let "many videos on one page" become a
loading problem.** Use `preload="none"` or `preload="metadata"` (never
`auto`) on any video that isn't the primary hero/autoplay element, and
always pair it with a `poster` image (the tile's own static photo) so
there's never a blank/black flash before playback actually starts —
the poster shows instantly, and it crossfades to live video once
buffering catches up.

**Mobile carousels: centered item + peeking neighbors, tap-to-center
before tap-to-activate.** For a horizontal snap-scroll carousel where
each item can also be "activated" (played, expanded, etc.), tapping a
peeking (non-centered) item should just bring it to center first — it
should NOT immediately trigger its activated state. Only tapping the
already-centered item activates it. This avoids accidentally triggering
playback/expansion on an item the user was just glancing at while
scrolling past.

## The header/nav pattern ("liquid glass")

Also explicitly flagged by the user as reusable for future builds: a
sticky/fixed header with `backdrop-filter: blur() saturate() contrast()`
over a translucent gradient background, rounded bottom corners, a
subtle top-highlight sheen overlay, scroll-based collapse of the
logo row (leaving just the nav bar) with a small icon-only logo bouncing
in to replace it, and a floating "back to top" button with the same
glassy treatment. See the GDG Global Header build for the full
implementation details and the specific bugs that had to be solved to
make `position: fixed`/`sticky` work reliably inside a page-builder's
(GoHighLevel's) nested wrapper divs.
