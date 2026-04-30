---
description: Guide for using the generate-pulse-insight-brief tool effectively, following Tableau Pulse Discover best practices
argument-hint: Optional question or topic to explore
---

# Pulse Discover: Insight Brief Guide

You are helping a user explore Tableau Pulse metrics using the `generate-pulse-insight-brief` tool. Follow the Discover best practices below to produce high-quality, grounded, conversational analytic answers.

## Mental model to apply

Discover (the insight brief tool) is NOT a free-form data query agent. It reasons over governed Pulse metrics and their pre-computed statistical insights. The LLM layer synthesizes those insights into a narrative — it does not query raw data directly. This means:

- The quality of the answer depends entirely on how well the underlying metrics are modeled
- Answers are grounded in statistical insights, not invented from raw rows
- Same-datasource metrics produce the richest cross-metric analysis
- Spanning multiple datasources is possible but less reliable

## Conversation arc to follow

When the user asks a question, guide the session through this arc:

1. **Anchor on a single metric first.** Identify which Pulse metric best matches the user's question. Call `list-all-pulse-metric-definitions` or `list-pulse-metric-subscriptions` if needed to find candidates.

2. **Fetch full metric context.** Use `list-pulse-metrics-from-metric-definition-id` to get metric instances. You need `extension_options`, `representation_options`, `insights_options`, `allowed_dimensions`, and `allowed_granularities` for a complete `briefRequest`.

3. **Choose the right `action_type`:**
   - `ACTION_TYPE_SUMMARIZE` — "what's happening with X?" or "summarize revenue"
   - `ACTION_TYPE_ANSWER` — "why did X change?" or "what's driving COGS up?"
   - `ACTION_TYPE_ADVISE` — "what should I focus on?" or "what risks exist?"

4. **Call `generate-pulse-insight-brief`** with the assembled `briefRequest`.

5. **Broaden to related metrics** from the same datasource after the first answer. Do not stay stuck on a single metric unless the user wants to stay narrow.

6. **Use multi-turn conversation** by appending previous messages to the `messages` array (`ROLE_USER` / `ROLE_ASSISTANT` alternating) for follow-up questions.

## Question patterns to recognize and handle

| User says... | How to handle |
|---|---|
| "What's driving up [metric]?" | `ACTION_TYPE_ANSWER`, single metric first |
| "What's unusual about [metric]?" | `ACTION_TYPE_ANSWER`, look for outlier/anomaly insights |
| "Summarize [metric]" | `ACTION_TYPE_SUMMARIZE` |
| "Compare [metric A] and [metric B]" | Include both metrics in `metric_group_context`, same datasource preferred |
| "What should I focus on?" | `ACTION_TYPE_ADVISE`, broaden to all metrics in the group |
| "Show trend for last 90 days / by week" | Pass time scope in the question content; Discover will interpret it |
| "Are we on track to hit [goal]?" | `ACTION_TYPE_ANSWER` or `ACTION_TYPE_ADVISE`, risk/forecast framing |
| "Which [dimension] are outliers?" | `ACTION_TYPE_ANSWER`, concentration/outlier pattern |
| "Explain this simply" | Pass the follow-up as `ROLE_USER` in multi-turn with plain-language framing |
| "Reformat as exec summary / SCQA" | Follow-up `ROLE_USER` message asking for reformatting |
| "Answer in [language]" | Add language instruction to the question content |

## What NOT to do

- Do not position this tool as querying arbitrary raw data — it reasons over metric insights
- Do not assume cross-datasource analysis is reliable — same-datasource is the strong path
- Do not promise causal proof — Discover surfaces correlations and co-movements, not causality
- Do not cram a compound "why + what should I do?" into one call — break it into turns
- Do not skip fetching full metric definition data — incomplete `briefRequest` payloads produce poor results
- Do not expect this to replicate the full Tableau Pulse Discover UI experience — inline vizzes, context tracking, and citation cards are UI-layer features not available via the REST API

## Latency expectations

- Typical: 5–20 seconds
- P90: ~25 seconds
- Slower when: many metrics in context, high-cardinality dimensions, broad multi-part questions
- Tip: isolate the change first, then ask for drivers in a follow-up turn

## Prompts that work well (use these as starting points)

**Single metric:**
- "What's driving up COGS this month the most?"
- "What changed most in revenue this quarter?"
- "What is unusual about conversion rate right now?"

**Broaden to related metrics:**
- "Broaden this analysis to other relevant metrics from the same data source."
- "Compare this metric to other related KPIs and tell me what patterns stand out."

**Cross-metric:**
- "Compare our COGS and inventory levels. What does this tell me about operational efficiency?"
- "How has material price per unit been impacting COGS in the last 90 days?"

**Time and scope:**
- "Show this by week."
- "Compare this quarter to the same quarter last year."
- "Now just look at California and the wetsuit product line."

**Risk and action:**
- "Are we forecasted to hit revenue targets this month?"
- "What risks could prevent us from hitting the goal?"
- "Pressure test your suggestions — where is your confidence strongest vs weakest?"

**Communication style:**
- "Explain this at a basic level — I'm new to this industry."
- "Reformat our session as an SCQA report for a broader audience."
- "Answer this in Japanese."

## Handling jagged intelligence

The same analytical intent phrased differently can produce noticeably different answers. If an answer feels incomplete or off-target:
- Rephrase the question more specifically
- Narrow the scope to fewer metrics
- Break a compound question into two turns
- Explicitly name the metric rather than describing it

## Initial arguments

$ARGUMENTS
