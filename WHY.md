# Why dyelot

## The obvious version

Pick a palette on a color site, paste the hex codes into a Tailwind config and hope the text stays
readable. A palette is a handful of swatches. A product needs roles, a light mode, a dark mode and a
contrast ratio for every pair of text and background. Someone fills in the rest by hand, screen by
screen.

## Why I'm building it differently

I checked about 40 palette, theme and design-system tools on 2026-11-01. I found none that combined
four things: a complete system with mirrored light and dark modes, previews on several realistic pages
that share one scheme, a handoff a coding agent can read, and a free price. Scale generators stop at
color. The nearest theme editor serves one framework. The DESIGN.md catalogs clone real brands. I found
no tool that offers motion tokens.

DESIGN.md is the handoff worth targeting. Google Labs open-sourced the format in April 2026 so an agent
can read a design system as plain text. It is still alpha, and nothing I found generates a checked one
from your own palette. dyelot will write DESIGN.md with tokens and a ready prompt beside it.

The numbers come from an engine, not a model. The engine will solve each color for a target WCAG
contrast and measure it again on the value it emits. A model, where one helps, fills a closed schema and
never writes a color. Every export will carry a receipt of what was measured, so a claim of
accessibility comes with its proof.

## What could go wrong

DESIGN.md is alpha, and Google could add a palette studio to Stitch tomorrow. dyelot needs no model and
no server for its core, so a changed format means a new file writer, not a rewrite. Today the repo
holds the shell, the CI and the design spec. The engine is in progress.
