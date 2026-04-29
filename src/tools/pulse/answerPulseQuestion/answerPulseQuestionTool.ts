import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { getConfig } from '../../../config.js';
import { useRestApi } from '../../../restApiInstance.js';
import {
  actionTypeEnumSchema,
  PulseInsightBriefResponse,
} from '../../../sdks/tableau/types/pulse.js';
import { Server } from '../../../server.js';
import { getTableauAuthInfo } from '../../../server/oauth/getTableauAuthInfo.js';
import { Tool } from '../../tool.js';

const paramsSchema = {
  question: z.string(),
  actionType: actionTypeEnumSchema.exclude(['ACTION_TYPE_UNDEFINED']).default('ACTION_TYPE_SUMMARIZE'),
  metricNames: z.array(z.string()).optional(),
};

export const getAnswerPulseQuestionTool = (server: Server): Tool<typeof paramsSchema> => {
  const tool = new Tool({
    server,
    name: 'answer-pulse-question',
    description: `
Answer a natural language question about Tableau Pulse metrics using an AI-generated insight brief.
Handles all orchestration automatically: finds the relevant metrics, assembles the context, and
returns a conversational answer.

Provide a plain English question. Optionally narrow which metrics are included by name.
If no metric names are provided, all metrics from the same datasource are included for richer context.

**Parameters:**
- \`question\` (required): The natural language question to answer. Examples:
    - "Why did revenue drop last month?"
    - "What's driving the change in support cases?"
    - "What should I focus on to improve performance?"
    - "Summarize what's happening across my metrics"
- \`actionType\` (optional): How to respond. Defaults to \`ACTION_TYPE_SUMMARIZE\`.
    - \`ACTION_TYPE_SUMMARIZE\`: Summarize the metric — best for "what's happening with X?"
    - \`ACTION_TYPE_ANSWER\`: Answer a specific question — best for "why did X change?"
    - \`ACTION_TYPE_ADVISE\`: Give recommendations — best for "what should I focus on?"
- \`metricNames\` (optional): Array of metric names to include in the context. If omitted, all
    available metrics are included. Use this to focus the answer on specific metrics. Examples:
    - ["Revenue"]
    - ["Revenue", "Number of Orders"]

**Use cases:**
- Summarize a metric: question "Summarize revenue", actionType ACTION_TYPE_SUMMARIZE, metricNames ["Revenue"]
- Targeted question: question "Why did CSAT drop?", actionType ACTION_TYPE_ANSWER, metricNames ["CSAT Score"]
- Cross-metric advice: question "What should I focus on?", actionType ACTION_TYPE_ADVISE (uses all metrics)
`,
    paramsSchema,
    annotations: {
      title: 'Answer Pulse Question',
      readOnlyHint: true,
      openWorldHint: false,
    },
    callback: async (
      { question, actionType, metricNames },
      { requestId, authInfo, signal },
    ): Promise<CallToolResult> => {
      const config = getConfig();

      return await tool.logAndExecute<PulseInsightBriefResponse>({
        requestId,
        authInfo,
        args: { question, actionType, metricNames },
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

          // Step 2: filter to requested metric names, or default to all
          const filteredDefs = metricNames
            ? definitions.filter((d) =>
                metricNames.some((name) => name.toLowerCase() === d.metadata.name.toLowerCase()),
              )
            : definitions;

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
            throw new Error('Could not retrieve metric instances for any of the matched definitions.');
          }

          // Step 4: call the insight brief
          const briefResult = await useRestApi({
            config,
            requestId,
            server,
            jwtScopes: ['tableau:insight_brief:create'],
            signal,
            authInfo: getTableauAuthInfo(authInfo),
            callback: async (restApi) =>
              restApi.pulseMethods.generatePulseInsightBrief({
                language: 'LANGUAGE_EN_US',
                locale: 'LOCALE_EN_US',
                messages: [
                  {
                    action_type: actionType,
                    content: question,
                    role: 'ROLE_USER',
                    metric_group_context_resolved: true,
                    metric_group_context: metricContexts,
                  },
                ],
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
              ({ viz: _viz, facts: _facts, table: _table, ...rest }) => rest,
            ),
          },
        }),
      });
    },
  });

  return tool;
};
