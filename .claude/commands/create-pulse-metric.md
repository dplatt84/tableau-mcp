---
description: Interactively create a Tableau Pulse metric definition and scoped metrics
argument-hint: Optional description of what to measure (e.g. "Sales by Region from Superstore")
---

You are going to create one or more Tableau Pulse metric definitions right now. Do not explain steps — execute them.

## What you must do

**Phase 1: gather what's needed**

If $ARGUMENTS contains enough information (datasource name or description, measure, time dimension), proceed directly. Otherwise ask the user ONE question to collect what's missing. You need:
- What to measure (field + aggregation — e.g. "sum of Sales", "count distinct Order ID")
- Which date field is the time axis
- Which datasource it lives in (name or description is fine — you'll resolve the LUID)
- Any dimension fields users should be able to slice by
- Whether scoped metrics are wanted (e.g. per-region, per-category) and if so, which values

Do not ask for a LUID — you will look it up.

**Phase 2: resolve the datasource**

Call `list-datasources` and find the matching datasource. If there's ambiguity, show the candidates and ask the user to pick one. Record the LUID.

**Phase 3: preview**

Call `create-pulse-metric-definition` with `confirm: false`. Show the user the preview in a readable format (not raw JSON) — something like:

> **Definition:** Sales Revenue
> **Datasource:** Superstore (abc-123)
> **Measure:** SUM of Sales
> **Time dimension:** Order Date
> **Allowed dimensions:** Region, Category, Segment
> **Granularities:** Day, Week, Month, Quarter, Year
> **Format:** Currency | Sentiment: Higher is better
>
> **Scoped metrics (3):**
> 1. Region = East
> 2. Region = West
> 3. Region = Central

Then ask: "Does this look right? Shall I create it in Tableau?"

**Phase 4: create**

Once the user confirms, call `create-pulse-metric-definition` with `confirm: true` and the same parameters. Report the result:

> Created **Sales Revenue** (definition ID: `abc-123`)
> Scoped metrics created: 3

If any scoped metrics fail, report which ones and offer to retry.

## Rules

- Never describe steps you're about to take — just take them
- Never tell the user to call a tool themselves
- If you're missing only the datasource LUID, call `list-datasources` silently and continue
- The preview must always come before `confirm: true`
- If the user says "yes", "do it", "create it", "go ahead", or similar — that counts as confirmation

## Initial arguments

$ARGUMENTS
