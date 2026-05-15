---
description: Run or resume the SysML v2 upgrade workflow (exploration → plan → prototype → implementation)
---

You are managing a SysML v2 upgrade workflow for the `sysml-2ls` project. This is **not** a one-off task — it's a multi-session, multi-phase engineering effort. Your job is to **manage the process**, primarily by spawning subagents (with worktree isolation) to do the actual code-reading and code-writing while you orchestrate.

## Step 1 — Load context

Before doing anything, read these in order:

1. **`docs/maintenance/upgrade-workflow.md`** — the canonical workflow. Contains the four phases, principles, deliverable structures, and resumption rules. **Required reading.**
2. **`docs/maintenance/upgrade-checklist.md`** — the operational checklist.
3. **`docs/maintenance/upstream-sources.md`** — what we track.
4. The Claude memories listed in your auto-loaded `MEMORY.md` index. The standing principles (conformance over compat, authoring not execution, isolate migration axes, design-thinking phases, calibration on complexity, stricter-than-pilot OK if documented) are all encoded as memories.

## Step 2 — Determine state

Run `ls docs/maintenance/upgrades/` to see if any upgrade is in flight.

- **If no upgrade folder exists or the user gave an explicit tag** → start a new upgrade.
- **If exactly one upgrade folder exists** → resume that upgrade. Read its `RESUME.md` first (if present); fall back to reading `00-exploration-synthesis.md` then `plan.md`.
- **If multiple upgrade folders exist** → ask the user which one (rare).

## Step 3 — Identify the next concrete step

Based on the in-flight phase:

- **Exploration phase incomplete** → identify which chunk is next; either complete it directly (small) or delegate the survey to a subagent.
- **Exploration done, plan absent or stale** → draft `plan.md` per the workflow doc's planning-phase template. Surface strategic decisions to the user.
- **Plan exists, prototype phase active** → identify the next prototype packet to run. Spawn it via the Agent tool with `isolation: "worktree"`. Wait for the ~300-word report. Integrate. Then either spawn the next, or revise the plan.
- **Prototypes complete** → propose transition to implementation phase. **Do not start implementation autonomously** — that's a phase boundary that warrants user confirmation.
- **Implementation phase active** → continue per `plan.md`. Each phase's success criteria are the gates.

## Step 4 — Operating discipline

- **Spawn subagents in foreground, with worktree isolation.** Brief them via their packet (e.g. for prototype P3, point them at `docs/maintenance/upgrades/<tag>/prototypes/03-*.md`). Restate critical standing principles inline.
- **One subagent at a time.** Parallel spawns produce a flood of return-results.
- **Trust the subagent's report but verify direction.** If a subagent's finding warrants plan revision, **revise the plan before spawning the next prototype**.
- **Keep your own context lean.** Don't read large files when a subagent's summary suffices. Don't re-explain the project to yourself; the workflow doc and memories are the briefing.
- **Don't commit code without explicit user authorization.** Leave prototype work uncommitted on its branch.
- **Mark uncertainty honestly.** Per the calibration rule, SysML v2 semantics are dense; surface "I don't know" rather than projecting confidence.

## Step 5 — When in doubt

- **If a phase boundary is reached** (exploration → plan, plan → prototype, prototype → implementation) → ask the user before crossing.
- **If a strategic decision needs to be made** (e.g. fork-patch disposition, validation philosophy, sequencing) → present options with your recommendation; ask the user to confirm or redirect.
- **If a finding contradicts the plan** → revise the plan with a dated annotation, **then** ask the user whether to continue.
- **If something is destructive** (e.g. force-push, delete data, modify shared infra) → do not proceed; ask the user.

## Step 6 — Capture state for the next session

Before ending a working session (or when context starts to fill up):

- Update `docs/maintenance/upgrades/<tag>/RESUME.md` with: current phase, completed work, pending work, the concrete next 1–3 steps with their input prompts.
- Update `plan.md` with any new findings or sequencing changes.
- Note any new memories saved during the session (in the `MEMORY.md` index).

## What success looks like

For each upgrade cycle:

- All six exploration chunks written.
- `plan.md` with explicit strategic decisions.
- All planned prototypes run; results integrated.
- All implementation phases complete with success criteria met.
- Stdlib pin advanced to the new tag.
- Test suite green.
- `upgrade-checklist.md` updated with any procedural lessons learned.
- `known_limitations.md` updated with any documented stricter-than-pilot deviations.
- A short retrospective in the upgrade folder's `RESUME.md`.

Begin by reading the workflow doc.
