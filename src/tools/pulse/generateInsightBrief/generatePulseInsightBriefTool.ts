import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { Err } from 'ts-results-es';

import { getConfig } from '../../../config.js';
import { useRestApi } from '../../../restApiInstance.js';
import { PulseDisabledError } from '../../../sdks/tableau/methods/pulseMethods.js';
import {
  pulseInsightBriefRequestSchema,
  PulseInsightBriefResponse,
} from '../../../sdks/tableau/types/pulse.js';
import { Server } from '../../../server.js';
import { getTableauAuthInfo } from '../../../server/oauth/getTableauAuthInfo.js';
import { Tool } from '../../tool.js';
import { getPulseDisabledError } from '../getPulseDisabledError.js';

const paramsSchema = {
  briefRequest: pulseInsightBriefRequestSchema,
};

export type GeneratePulseInsightBriefError =
  | {
      type: 'feature-disabled';
      reason: PulseDisabledError;
    }
  | {
      type: 'datasource-not-allowed';
      message: string;
    };

export const getGeneratePulseInsightBriefTool = (server: Server): Tool<typeof paramsSchema> => {
  const generatePulseInsightBriefTool = new Tool({
    server,
    name: 'generate-pulse-insight-brief',
    description: `
    Generates insight brief for Pulse Metrics using Tableau REST API. AI-powered conversational insights from natural language questions. INSIGHT BRIEF: AI response with natural language answers summaries advice. BRIEF VS OTHER: Brief AI conversational this endpoint. Detail comprehensive analysis. Ban current value period-over-period change. Breakdown categorical analysis. REQUIREMENTS: Same datasource recommended metrics from same datasource. Complete metric data includes extension_options allowed_dimensions allowed_granularities representation_options sentiment_type currency_code insights_options.settings insight types. Multi-turn include conversation history messages array initial question ROLE_USER assistant ROLE_ASSISTANT follow-up ROLE_USER. PARAMETERS: briefRequest required language locale messages array action_type ACTION_TYPE_ANSWER ACTION_TYPE_SUMMARIZE ACTION_TYPE_ADVISE content role metric_group_context metric_group_context_resolved now optional YYYY-MM-DD HH:MM:SS time_zone optional. USE CASES: Conversational analytics Q&A briefings alerts multi-metric analysis.
    `,
    paramsSchema,
    annotations: {
      title: 'Generate Pulse Insight Brief',
      readOnlyHint: true,
      openWorldHint: false,
    },
    callback: async (
      { briefRequest },
      { requestId, authInfo, signal },
    ): Promise<CallToolResult> => {
      const config = getConfig();
      return await generatePulseInsightBriefTool.logAndExecute<
        PulseInsightBriefResponse,
        GeneratePulseInsightBriefError
      >({
        requestId,
        authInfo,
        args: { briefRequest },
        callback: async () => {
          // Filter out metrics that are not in the allowed datasource set
          const { datasourceIds } = config.boundedContext;
          if (datasourceIds) {
            for (const message of briefRequest.messages) {
              if (message.metric_group_context) {
                message.metric_group_context = message.metric_group_context.filter(
                  (metricContext) =>
                    datasourceIds.has(metricContext.metric.definition.datasource.id),
                );

                // If filtering removed all metrics from this message, return an error
                if (message.metric_group_context.length === 0) {
                  return new Err({
                    type: 'datasource-not-allowed',
                    message: [
                      'The set of allowed metric insights that can be queried is limited by the server configuration.',
                      'One or more messages in the request contain only metrics derived from data sources that are not in the allowed set.',
                    ].join(' '),
                  });
                }
              }
            }
          }

          const result = await useRestApi({
            config,
            requestId,
            server,
            jwtScopes: ['tableau:insight_brief:create'],
            signal,
            authInfo: getTableauAuthInfo(authInfo),
            callback: async (restApi) =>
              await restApi.pulseMethods.generatePulseInsightBrief(briefRequest),
          });

          if (result.isErr()) {
            return new Err({
              type: 'feature-disabled',
              reason: result.error,
            });
          }

          return result;
        },
        constrainSuccessResult: (insightBrief) => {
          return {
            type: 'success',
            result: insightBrief,
          };
        },
        getErrorText: (error) => {
          switch (error.type) {
            case 'feature-disabled':
              return getPulseDisabledError(error.reason);
            case 'datasource-not-allowed':
              return error.message;
          }
        },
      });
    },
  });

  return generatePulseInsightBriefTool;
};
