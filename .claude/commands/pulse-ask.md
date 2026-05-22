---
description: Answer a natural language question about Tableau Pulse metrics by chaining metric lookup → insight brief
argument-hint: "Your question (e.g. 'What's driving up COGS this month?')"
---

You are going to answer a Pulse metrics question right now. Do not explain steps — execute them.

## Question

$ARGUMENTS

## What you must do

**Phase 1: try the fast path**

Call `discover-pulse` with the question from $ARGUMENTS. This tool automatically chains:
subscriptions → metric instances → full definitions → insight brief.

If it succeeds, present the answer and stop. You are done.

**Phase 2: manual chain (only if Phase 1 fails or user has no followed metrics)**

Execute this chain in order:

1. **Find definitions** — call `list-all-pulse-metric-definitions` with `view: "DEFINITION_VIEW_BASIC"`.
   Scan names and descriptions to identify which definitions are relevant to the question.
   If nothing clearly matches, ask the user ONE question: "Which metric are you asking about?"
   and show the top candidate names.

2. **Get metric instances** — for each relevant definition ID, call
   `list-pulse-metrics-from-metric-definition-id`. Collect the resulting metric instances.

3. **Get full definitions** — call `list-pulse-metric-definitions-from-definition-ids` with
   those definition IDs and `view: "DEFINITION_VIEW_FULL"`. You need `extension_options`,
   `representation_options`, `insights_options`, `allowed_dimensions`,
   `allowed_granularities`, and `specification` for a valid `briefRequest`.

4. **Pick the best metric group** — prefer metrics that share the same datasource for richer
   cross-metric analysis. Build `metric_group_context` from matching metric instances + their
   full definitions.

5. **Infer `action_type`** from the question:
   - "why / what caused / what changed / what's driving" → `ACTION_TYPE_ANSWER`
   - "should / focus / advise / risk / goal / forecast / target" → `ACTION_TYPE_ADVISE`
   - anything else (overview, summary, what is) → `ACTION_TYPE_SUMMARIZE`

6. **Compute `now`** — check `extension_options.offset_from_today` across all metrics.
   Take the max offset. Subtract that many days from today to get `now` (YYYY-MM-DD).
   If all offsets are 0, use yesterday's date as `now` to avoid empty-period responses.

7. **Call `generate-pulse-insight-brief`** with:
   ```
   briefRequest:
     language: LANGUAGE_EN_US
     locale: LOCALE_EN_US
     now: <computed above>
     messages:
       - role: ROLE_USER
         action_type: <inferred above>
         content: <the question>
         metric_group_context_resolved: true
         metric_group_context: <built above>
   ```

8. **Present the answer** from `brief_text` or `answer`. If source insights are present,
   briefly list the top 2–3 supporting signals as bullet points below the main answer.

## Multi-turn follow-up

If the user asks a follow-up question, carry forward the previous answer as
`ROLE_ASSISTANT` in `messages` before the new `ROLE_USER` turn. Reuse the same
`metric_group_context` — do not re-fetch unless the user asks about different metrics.

## Rules

- Never describe steps you're about to take — just take them
- Never ask the user to call a tool themselves
- Prefer `discover-pulse` (Phase 1) — only fall to Phase 2 if it fails
- Never call `generate-pulse-insight-brief` without a populated `metric_group_context`
- If the question is compound ("overview + forecast + what should I focus on?"), make one
  call with `ACTION_TYPE_ADVISE` — do not split into multiple calls
