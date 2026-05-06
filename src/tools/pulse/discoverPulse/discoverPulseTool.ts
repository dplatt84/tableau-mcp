import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { getConfig } from '../../../config.js';
import { useRestApi } from '../../../restApiInstance.js';
import {
  actionTypeEnumSchema,
  ActionTypeEnumType,
  languageEnumSchema,
  localeEnumSchema,
  PulseInsightBriefResponse,
} from '../../../sdks/tableau/types/pulse.js';
import { Server } from '../../../server.js';
import { getTableauAuthInfo } from '../../../server/oauth/getTableauAuthInfo.js';
import { Tool } from '../../tool.js';

const conversationTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

const paramsSchema = {
  question: z.string(),
  actionType: actionTypeEnumSchema
    .exclude(['ACTION_TYPE_UNDEFINED'])
    .optional()
    .describe(
      'How to respond. Omit to auto-infer from question phrasing. ' +
        'ACTION_TYPE_ANSWER: why/what changed. ' +
        'ACTION_TYPE_SUMMARIZE: overview/summary. ' +
        'ACTION_TYPE_ADVISE: recommendations/risk/goals.',
    ),
  metricNames: z
    .array(z.string())
    .optional()
    .describe(
      'Metric names to include. Omit to auto-select the largest same-datasource group for richer cross-metric analysis.',
    ),
  conversationHistory: z
    .array(conversationTurnSchema)
    .optional()
    .describe(
      'Prior conversation turns to thread into the request for multi-turn analysis. ' +
        'Alternate user/assistant pairs from oldest to newest.',
    ),
  language: languageEnumSchema.default('LANGUAGE_EN_US'),
  locale: localeEnumSchema.default('LOCALE_EN_US'),
};

function inferActionType(question: string): ActionTypeEnumType {
  const q = question.toLowerCase();
  if (/\b(why|what (caused|changed|drove|drove up|drove down|is driving|happened))\b/.test(q)) {
    return 'ACTION_TYPE_ANSWER';
  }
  if (
    /\b(should|recommend|focus|advise|risk|goal|target|forecast|prevent|pressure test)\b/.test(q)
  ) {
    return 'ACTION_TYPE_ADVISE';
  }
  return 'ACTION_TYPE_SUMMARIZE';
}

export const getDiscoverPulseTool = (server: Server): Tool<typeof paramsSchema> => {
  const tool = new Tool({
    server,
    name: 'discover-pulse',
    description: `
Answer natural language questions about Tableau Pulse metrics using AI-generated insight briefs.
Supports multi-turn conversation, auto-selects same-datasource metric context, and infers response
style from question phrasing.

**When to use this tool (not query-datasource or answer-pulse-question):**
- User asks about a KPI, metric, or business signal that is tracked in Pulse
- Question involves trends, anomalies, drivers, period-over-period change, outliers, forecasts, goals
- User wants to continue a prior conversation about Pulse metrics
- User asks for an explanation, summary, executive brief, or reformatted output of a metric

**Question patterns and how they map:**
- "What's driving up COGS this month?" → ACTION_TYPE_ANSWER, single metric anchor
- "What changed in revenue this quarter?" → ACTION_TYPE_ANSWER
- "What is unusual about conversion rate?" → ACTION_TYPE_ANSWER (outlier/anomaly)
- "Summarize what's happening with sales" → ACTION_TYPE_SUMMARIZE
- "What should I focus on to improve performance?" → ACTION_TYPE_ADVISE
- "Are we on track to hit revenue targets?" → ACTION_TYPE_ADVISE (goal/risk framing)
- "Compare COGS and inventory. What does this tell me about efficiency?" → broaden to related metrics
- "Explain this in simpler terms" → follow-up turn, keep context
- "Reformat as an executive summary / SCQA report" → follow-up turn, reformatting
- "Answer this in Japanese" → pass language in question or use language parameter

**Parameters:**
- \`question\` (required): Plain English question. Ask one focused question per turn.
- \`actionType\` (optional): Omit to auto-infer. Set explicitly to override.
- \`metricNames\` (optional): Narrow to specific metrics. Omit to use all metrics from the
  largest same-datasource group, which produces the richest cross-metric analysis.
- \`conversationHistory\` (optional): Array of prior {role, content} turns. Include to continue
  an in-progress analysis — Discover carries context forward across turns.
- \`language\` / \`locale\` (optional): Defaults to English. Use for multilingual output.

**Best practices from Tableau Pulse team:**
- Start with one metric/KPI, then broaden in follow-up turns
- Ask one analytical question at a time — compound "why + what should I do?" questions are slower
  and less precise than two focused turns
- To widen scope: ask "Broaden this to other relevant metrics from the same data source"
- To narrow scope: name specific dimensions, regions, or product lines in the question
- To reset: ask a fresh question without conversation history
- Expect 5–20s response time; broader metric scope and high-cardinality dimensions add latency

**Limitations:**
- Grounds answers in pre-computed Pulse statistical insights, not arbitrary raw data queries
- Same-datasource metric groups produce the best cross-metric analysis
- Correlation observations are co-movement patterns, not causal proof
- Inline visualizations, citation cards, and context tracking from the Pulse UI are not available
  via this API endpoint
`,
    paramsSchema,
    annotations: {
      title: 'Discover Pulse',
      readOnlyHint: true,
      openWorldHint: false,
    },
    callback: async (
      { question, actionType, metricNames, conversationHistory, language, locale },
      { requestId, authInfo, signal },
    ): Promise<CallToolResult> => {
      const config = getConfig();

      return await tool.logAndExecute<PulseInsightBriefResponse>({
        requestId,
        authInfo,
        args: { question, actionType, metricNames, conversationHistory, language, locale },
        callback: async () => {
          // Step 1: fetch all definitions with full view
          const defsResult = await useRestApi({
            config,
            requestId,
            server,
            jwtScopes: ['tableau:insight_definitions_metrics:read'],
            signal,
            authInfo: getTableauAuthInfo(authInfo),
            callback: async (restApi) =>
              restApi.pulseMethods.listAllPulseMetricDefinitions('DEFINITION_VIEW_FULL'),
          });

          if (defsResult.isErr()) return defsResult;
          const { definitions } = defsResult.value;

          if (definitions.length === 0) {
            throw new Error('No Pulse metric definitions found on this site.');
          }

          // Step 2: filter to requested metric names, or pick the largest same-datasource group
          let filteredDefs = metricNames
            ? definitions.filter((d) =>
                metricNames.some((name) => name.toLowerCase() === d.metadata.name.toLowerCase()),
              )
            : (() => {
                // Group by datasource, pick the largest group for richest cross-metric context
                const byDatasource = new Map<string, typeof definitions>();
                for (const def of definitions) {
                  const dsId = def.specification.datasource.id;
                  const group = byDatasource.get(dsId) ?? [];
                  group.push(def);
                  byDatasource.set(dsId, group);
                }
                let largest: typeof definitions = [];
                for (const group of byDatasource.values()) {
                  if (group.length > largest.length) largest = group;
                }
                return largest;
              })();

          if (filteredDefs.length === 0) {
            throw new Error(
              `No metrics found matching: ${metricNames?.join(', ')}. ` +
                `Available metrics: ${definitions.map((d) => d.metadata.name).join(', ')}`,
            );
          }

          // Step 3: fetch a metric instance for each definition
          const metricContexts = (
            await Promise.all(
              filteredDefs.map(async (def) => {
                const metricsResult = await useRestApi({
                  config,
                  requestId,
                  server,
                  jwtScopes: ['tableau:insight_definitions_metrics:read'],
                  signal,
                  authInfo: getTableauAuthInfo(authInfo),
                  callback: async (restApi) =>
                    restApi.pulseMethods.listPulseMetricsFromMetricDefinitionId(def.metadata.id),
                });

                if (metricsResult.isErr()) return null;

                const metric =
                  metricsResult.value.find((m) => m.is_default) ?? metricsResult.value[0];
                if (!metric) return null;

                return {
                  metadata: {
                    name: def.metadata.name,
                    metric_id: metric.id,
                    definition_id: metric.definition_id,
                  },
                  metric: {
                    definition: def.specification,
                    metric_specification: metric.specification,
                    extension_options: def.extension_options,
                    representation_options: def.representation_options,
                    insights_options: def.insights_options,
                    candidates: [],
                  },
                };
              }),
            )
          ).filter((ctx) => ctx !== null);

          if (metricContexts.length === 0) {
            throw new Error(
              'Could not retrieve metric instances for any of the matched definitions.',
            );
          }

          // Step 4: build messages array — thread history then current question
          const resolvedActionType = actionType ?? inferActionType(question);

          const historyMessages = (conversationHistory ?? []).map((turn) => ({
            action_type: resolvedActionType,
            content: turn.content,
            role: turn.role === 'user' ? ('ROLE_USER' as const) : ('ROLE_ASSISTANT' as const),
            metric_group_context_resolved: true,
            metric_group_context: metricContexts,
          }));

          const currentMessage = {
            action_type: resolvedActionType,
            content: question,
            role: 'ROLE_USER' as const,
            metric_group_context_resolved: true,
            metric_group_context: metricContexts,
          };

          // Step 5: call the insight brief
          const briefResult = await useRestApi({
            config,
            requestId,
            server,
            jwtScopes: ['tableau:insight_brief:create'],
            signal,
            authInfo: getTableauAuthInfo(authInfo),
            callback: async (restApi) =>
              restApi.pulseMethods.generatePulseInsightBrief({
                language,
                locale,
                messages: [...historyMessages, currentMessage],
              }),
          });

          return briefResult;
        },
        constrainSuccessResult: (brief) => ({
          type: 'success',
          result: {
            ...brief,
            group_context: undefined,
            source_insights: brief.source_insights?.map(
              ({
                viz: _viz,
                facts: _facts,
                table: _table,
                id: _id,
                generation_id: _generation_id,
                insight_feedback_metadata: _ifm,
                score: _score,
                markup: _markup,
                ...rest
              }) => rest,
            ),
          },
        }),
      });
    },
  });

  return tool;
};
