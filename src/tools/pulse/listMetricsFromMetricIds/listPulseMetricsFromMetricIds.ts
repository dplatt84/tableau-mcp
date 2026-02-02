import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { getConfig } from '../../../config.js';
import { useRestApi } from '../../../restApiInstance.js';
import { Server } from '../../../server.js';
import { getTableauAuthInfo } from '../../../server/oauth/getTableauAuthInfo.js';
import { Tool } from '../../tool.js';
import { constrainPulseMetrics } from '../constrainPulseMetrics.js';
import { getPulseDisabledError } from '../getPulseDisabledError.js';

const paramsSchema = {
  metricIds: z.array(z.string().length(36)),
};

export const getListPulseMetricsFromMetricIdsTool = (server: Server): Tool<typeof paramsSchema> => {
  const listPulseMetricsFromMetricIdsTool = new Tool({
    server,
    name: 'list-pulse-metrics-from-metric-ids',
    description: `
    Retrieves published Pulse Metrics from a list of metric IDs using Tableau REST API. Use when user requests to list Pulse Metrics for a list of metric IDs on current site. PARAMETERS: metricIds required array of Pulse Metric IDs to list metrics for. Must be metric IDs not names or metric definition IDs. Example format array with CF32DDCC-362B-4869-9487-37DA4D152552 CF32DDCC-362B-4869-9487-37DA4D152553. For data in Pulse Metric Subscription use the metric_id field. EXAMPLES: List all Pulse Metrics from a list of Pulse Metric IDs. NOTES: Recommended for use with data in Pulse Metric Subscriptions. 00000000-0000-0000-0000-000000000000 is not a valid datasource id. To get valid datasource id retrieve the Pulse Metric Definition for the Pulse Metric which should have valid datasource information.
    `,
    paramsSchema,
    annotations: {
      title: 'List Pulse Metrics from Metric IDs',
      readOnlyHint: true,
      openWorldHint: false,
    },
    callback: async ({ metricIds }, { requestId, authInfo, signal }): Promise<CallToolResult> => {
      const config = getConfig();
      return await listPulseMetricsFromMetricIdsTool.logAndExecute({
        requestId,
        authInfo,
        args: { metricIds },
        callback: async () => {
          return await useRestApi({
            config,
            requestId,
            server,
            jwtScopes: ['tableau:insight_metrics:read'],
            signal,
            authInfo: getTableauAuthInfo(authInfo),
            callback: async (restApi) => {
              return await restApi.pulseMethods.listPulseMetricsFromMetricIds(metricIds);
            },
          });
        },
        constrainSuccessResult: (metrics) =>
          constrainPulseMetrics({ metrics, boundedContext: config.boundedContext }),
        getErrorText: getPulseDisabledError,
      });
    },
  });

  return listPulseMetricsFromMetricIdsTool;
};
