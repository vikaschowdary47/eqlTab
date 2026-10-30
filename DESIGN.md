# eqlTab visual direction

## Brief

Make the shared-bills workspace feel calm, exact, and distinctly human. The immediate focus is
the Auto Bills review flow, where people need to understand what arrived, what is missing, and
what can safely be confirmed or deleted.

## Concepts

1. **Slice the inbox** — each forwarded statement is a slice of a shared household ledger: the
   layout separates incoming work from settled history, while selection and confirmation move a
   statement from “received” to “shared”. Anchor: eqlTab's real workflow is email/upload → review →
   split → confirmation.
2. **Heikei ledger** — soft, overlapping abstract shapes sit behind the functional surface like a
   quiet paper collage. The shapes never carry meaning; they give the dense review screen a
   memorable atmosphere. Anchor: the page is a living collection of records, not a marketing hero.
3. **Watermelon rind** — the outer shell is a green-ink system, the useful action is watermelon
   flesh, and warnings are seeds: small, dark, and easy to spot. Anchor: the product's existing
   coral brand and its friendly household context.

The selected direction combines 1 as the product rule, 2 as the visual atmosphere, and 3 as the
palette. It is intentionally lightweight: CSS shapes and existing text are more honest and faster
than adding an illustration or animation dependency.

## System

- Ground: warm melon-white `#fffaf5`; surface `#fffdf9`; ink: deep rind green `#213a32`.
- Accent: watermelon flesh `#f56f73`; accessible action text `#b53b43`; soft flesh wash
  `#fff0ed`; rind highlight `#d8eda4`; lines `#e6e2d8`.
- Type: Geist for navigation and records, Instrument Serif for money and a few editorial accents.
- Layout: a 920px reading measure; a generous intro; compact, two-line record rows; selection
  controls remain attached to the list rather than floating over it.
- Motion: short rise-in on first paint and a low-frequency Heikei drift. Reduced motion removes all
  movement while keeping the composition complete.
- Signature frame: the Auto Bills header sits over a cluster of translucent oval/seed shapes, then
  resolves into a precise “Waiting for you” queue.

## Responsive and accessibility notes

At phone widths the toolbar wraps before the destructive action, record metadata stays readable,
and status chips move below the provider name. Decorative shapes are `aria-hidden`, never reduce
contrast, and never contain the only explanation of a state. Focus rings continue to use the
brand-strong token.
