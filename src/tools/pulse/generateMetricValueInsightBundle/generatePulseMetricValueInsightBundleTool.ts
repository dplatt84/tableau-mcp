import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { Err } from 'ts-results-es';
import z from 'zod';

import { getConfig } from '../../../config.js';
import { useRestApi } from '../../../restApiInstance.js';
import { PulseDisabledError } from '../../../sdks/tableau/methods/pulseMethods.js';
import {
  pulseBundleRequestSchema,
  PulseBundleResponse,
  pulseInsightBundleTypeEnum,
} from '../../../sdks/tableau/types/pulse.js';
import { Server } from '../../../server.js';
import { getTableauAuthInfo } from '../../../server/oauth/getTableauAuthInfo.js';
import { Tool } from '../../tool.js';
import { getPulseDisabledError } from '../getPulseDisabledError.js';

const paramsSchema = {
  bundleRequest: pulseBundleRequestSchema,
  bundleType: z.optional(z.enum(pulseInsightBundleTypeEnum)),
};

export type GeneratePulseMetricValueInsightBundleError =
  | {
      type: 'feature-disabled';
      reason: PulseDisabledError;
    }
  | {
      type: 'datasource-not-allowed';
      message: string;
    };

export const getGeneratePulseMetricValueInsightBundleTool = (
  server: Server,
): Tool<typeof paramsSchema> => {
  const generatePulseMetricValueInsightBundleTool = new Tool({
    server,
    name: 'generate-pulse-metric-value-insight-bundle',
    description: `
    Generates an insight bundle for current aggregated value for Pulse Metric using Tableau REST API. Requires full information of Pulse Metric and Pulse Metric Definition. PARAMETERS: bundleRequest required request to generate bundle. Most information comes from other tools that retrieve Pulse Metric and Pulse Metric Definition. Set options: output_format OUTPUT_FORMAT_HTML time_zone UTC language LANGUAGE_EN_US locale LOCALE_EN_US. bundleType optional type default ban. ban basic insight bundle with current aggregated value period over period change highest ranked insight for each filterable dimension. springboard springboard insight bundle with current value period over period change highest ranked insight. basic similar to springboard focused on low bandwidth dimensions with small value sets. detail insights on performance over time summary visualization of highs lows trends breakdowns of top contributors for each filterable dimension followup insights. EXAMPLES: Generate default insight bundle provide bundleRequest with bundle_request version 1 options input metadata metric definition specification. Generate specific bundle type set bundleType to ban springboard basic or detail.
    `,
    paramsSchema,
    annotations: {
      title: 'Generate Pulse Metric Value Insight Bundle',
      readOnlyHint: true,
      openWorldHint: false,
    },
    callback: async (
      { bundleRequest, bundleType },
      { requestId, authInfo, signal },
    ): Promise<CallToolResult> => {
      const config = getConfig();
      return await generatePulseMetricValueInsightBundleTool.logAndExecute<
        PulseBundleResponse,
        GeneratePulseMetricValueInsightBundleError
      >({
        requestId,
        authInfo,
        args: { bundleRequest, bundleType },
        callback: async () => {
          const { datasourceIds } = config.boundedContext;
          if (datasourceIds) {
            const datasourceLuid =
              bundleRequest.bundle_request.input.metric.definition.datasource.id;

            if (!datasourceIds.has(datasourceLuid)) {
              return new Err({
                type: 'datasource-not-allowed',
                message: [
                  'The set of allowed metric insights that can be queried is limited by the server configuration.',
                  'Generating the Pulse Metric Value Insight Bundle is not allowed because the definition is derived',
                  `from the data source with LUID ${datasourceLuid}, which is not in the allowed set of data sources.`,
                ].join(' '),
              });
            }
          }

          const result = await useRestApi({
            config,
            requestId,
            server,
            jwtScopes: ['tableau:insights:read'],
            signal,
            authInfo: getTableauAuthInfo(authInfo),
            callback: async (restApi) =>
              await restApi.pulseMethods.generatePulseMetricValueInsightBundle(
                bundleRequest,
                bundleType ?? 'ban',
              ),
          });

          if (result.isErr()) {
            return new Err({
              type: 'feature-disabled',
              reason: result.error,
            });
          }

          return result;
        },
        constrainSuccessResult: (insightBundle) => {
          return {
            type: 'success',
            result: insightBundle,
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

  return generatePulseMetricValueInsightBundleTool;
};
