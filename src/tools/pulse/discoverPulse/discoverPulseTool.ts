import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { getConfig } from '../../../config.js';
import { useRestApi } from '../../../restApiInstance.js';
import { PulseDisabledError } from '../../../sdks/tableau/methods/pulseMethods.js';
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
import { getPulseDisabledError } from '../getPulseDisabledError.js';

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
Automatically uses the current user's followed (subscribed) metrics as context. Supports
multi-turn conversation and infers response style from question phrasing.

**ALWAYS use this tool (not generate-pulse-insight-brief) when the user asks any question about
their Pulse metrics**, including compound questions that combine overview + forecast + goals +
focus areas in a single ask. This tool handles those automatically.

**When to use this tool:**
- User asks about a KPI, metric, or business signal tracked in Pulse
- User asks for an overview or summary of their metrics (e.g. "give me a complete overview")
- User asks about red/green status, trends, anomalies, drivers, period-over-period change
- User asks about forecasts, goals, or targets (e.g. "am I on track to meet my goal?")
- User asks for recommendations or focus areas (e.g. "what should I focus on?")
- User asks a compound question combining any of the above in one sentence
- User wants to continue a prior conversation about Pulse metrics

**Question patterns and how they map:**
- "Give me a complete overview of my metrics" → ACTION_TYPE_SUMMARIZE, all followed metrics
- "I see a lot of red. Give me an overview, is the forecast on track, what should I focus on?" → ACTION_TYPE_ADVISE, all followed metrics
- "What's driving up COGS this month?" → ACTION_TYPE_ANSWER
- "Are we on track to hit revenue targets?" → ACTION_TYPE_ADVISE
- "What should I focus on to improve performance?" → ACTION_TYPE_ADVISE
- "What is unusual about conversion rate?" → ACTION_TYPE_ANSWER
- "Explain this in simpler terms" → follow-up turn, keep context
- "Reformat as an executive summary" → follow-up turn, reformatting

**Parameters:**
- \`question\` (required): Plain English question. Compound questions are fine.
- \`actionType\` (optional): Omit to auto-infer. ACTION_TYPE_ADVISE for goal/focus/risk questions,
  ACTION_TYPE_SUMMARIZE for overviews, ACTION_TYPE_ANSWER for why/what-changed questions.
- \`metricNames\` (optional): Narrow to specific metrics. Omit to use ALL followed metrics,
  which gives the richest cross-metric analysis for overview and advise questions.
- \`conversationHistory\` (optional): Array of prior {role, content} turns for multi-turn analysis.
- \`language\` / \`locale\` (optional): Defaults to English.

**Limitations:**
- Grounds answers in pre-computed Pulse statistical insights, not arbitrary raw data queries
- Correlation observations are co-movement patterns, not causal proof
- Inline visualizations from the Pulse UI are not available via this API endpoint
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

      return await tool.logAndExecute<PulseInsightBriefResponse, PulseDisabledError>({
        requestId,
        authInfo,
        args: { question, actionType, metricNames, conversationHistory, language, locale },
        getErrorText: getPulseDisabledError,
        callback: async () => {
          // Step 1: fetch the user's followed (subscribed) metrics
          const subscriptionsResult = await useRestApi({
            config,
            requestId,
            server,
            jwtScopes: ['tableau:metric_subscriptions:read'],
            signal,
            authInfo: getTableauAuthInfo(authInfo),
            callback: async (restApi) =>
              restApi.pulseMethods.listPulseMetricSubscriptionsForCurrentUser(),
          });

          if (subscriptionsResult.isErr()) return subscriptionsResult;
          const subscriptions = subscriptionsResult.value;

          if (subscriptions.length === 0) {
            throw new Error('No followed Pulse metrics found for the current user.');
          }

          // Step 2: fetch the metric instances for all subscribed metric IDs
          const metricsResult = await useRestApi({
            config,
            requestId,
            server,
            jwtScopes: ['tableau:insight_metrics:read'],
            signal,
            authInfo: getTableauAuthInfo(authInfo),
            callback: async (restApi) =>
              restApi.pulseMethods.listPulseMetricsFromMetricIds(
                subscriptions.map((s) => s.metric_id),
              ),
          });

          if (metricsResult.isErr()) return metricsResult;
          const subscribedMetrics = metricsResult.value;

          // Step 3: fetch full definitions for those metrics
          const definitionIds = [...new Set(subscribedMetrics.map((m) => m.definition_id))];
          const defsResult = await useRestApi({
            config,
            requestId,
            server,
            jwtScopes: ['tableau:insight_definitions_metrics:read'],
            signal,
            authInfo: getTableauAuthInfo(authInfo),
            callback: async (restApi) =>
              restApi.pulseMethods.listPulseMetricDefinitionsFromMetricDefinitionIds(
                definitionIds,
                'DEFINITION_VIEW_FULL',
              ),
          });

          if (defsResult.isErr()) return defsResult;
          const allDefinitions = defsResult.value;

          if (allDefinitions.length === 0) {
            throw new Error('No Pulse metric definitions found for the followed metrics.');
          }

          const defById = new Map(allDefinitions.map((d) => [d.metadata.id, d]));

          // Step 4: filter to requested metric names if provided, otherwise use all followed metrics
          let filteredMetrics = metricNames
            ? subscribedMetrics.filter((m) => {
                const def = defById.get(m.definition_id);
                return def
                  ? metricNames.some(
                      (name) => name.toLowerCase() === def.metadata.name.toLowerCase(),
                    )
                  : false;
              })
            : subscribedMetrics;

          if (filteredMetrics.length === 0) {
            const available = allDefinitions.map((d) => d.metadata.name).join(', ');
            throw new Error(
              `No followed metrics found matching: ${metricNames?.join(', ')}. ` +
                `Available followed metrics: ${available}`,
            );
          }

          // Step 5: build metric contexts from subscribed metrics + their definitions
          const metricContexts = filteredMetrics
            .map((metric) => {
              const def = defById.get(metric.definition_id);
              if (!def) return null;
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
            })
            .filter((ctx) => ctx !== null);

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
