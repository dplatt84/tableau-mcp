import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { getConfig } from '../../../config.js';
import { useRestApi } from '../../../restApiInstance.js';
import { pulseMetricDefinitionViewEnum } from '../../../sdks/tableau/types/pulse.js';
import { Server } from '../../../server.js';
import { getTableauAuthInfo } from '../../../server/oauth/getTableauAuthInfo.js';
import { Tool } from '../../tool.js';
import { constrainPulseDefinitions } from '../constrainPulseDefinitions.js';
import { getPulseDisabledError } from '../getPulseDisabledError.js';

const paramsSchema = {
  metricDefinitionIds: z.array(z.string().length(36)).min(1),
  view: z.optional(z.enum(pulseMetricDefinitionViewEnum)),
};

export const getListPulseMetricDefinitionsFromDefinitionIdsTool = (
  server: Server,
): Tool<typeof paramsSchema> => {
  const listPulseMetricDefinitionsFromDefinitionIdsTool = new Tool({
    server,
    name: 'list-pulse-metric-definitions-from-definition-ids',
    description: `
    Retrieves specific Pulse Metric Definitions from a list of metric definition IDs using Tableau REST API. Use when user requests information about specific Pulse Metric Definitions. PARAMETERS: metricDefinitionIds required array of metric definition IDs to retrieve. view optional range of metrics default DEFINITION_VIEW_BASIC. DEFINITION_VIEW_BASIC returns only definition. DEFINITION_VIEW_FULL returns definition and specified number of metrics up to 5. DEFINITION_VIEW_DEFAULT returns definition and default metric. EXAMPLES: Show details for id BBC908D8-29ED-48AB-A78E-ACF8A424C8C3 metricDefinitionIds array with that ID. List from multiple IDs metricDefinitionIds array with multiple IDs. List with default view add view DEFINITION_VIEW_DEFAULT. List with full view add view DEFINITION_VIEW_FULL note response includes up to 5 metrics use another tool for more. List with basic view add view DEFINITION_VIEW_BASIC.
    `,
    paramsSchema,
    annotations: {
      title: 'List Pulse Metric Definitions from Metric Definition IDs',
      readOnlyHint: true,
      openWorldHint: false,
    },
    callback: async (
      { view, metricDefinitionIds },
      { requestId, authInfo, signal },
    ): Promise<CallToolResult> => {
      const config = getConfig();
      return await listPulseMetricDefinitionsFromDefinitionIdsTool.logAndExecute({
        requestId,
        authInfo,
        args: { metricDefinitionIds, view },
        callback: async () => {
          return await useRestApi({
            config,
            requestId,
            server,
            jwtScopes: ['tableau:insight_definitions_metrics:read'],
            signal,
            authInfo: getTableauAuthInfo(authInfo),
            callback: async (restApi) => {
              return await restApi.pulseMethods.listPulseMetricDefinitionsFromMetricDefinitionIds(
                metricDefinitionIds,
                view,
              );
            },
          });
        },
        constrainSuccessResult: (definitions) =>
          constrainPulseDefinitions({ definitions, boundedContext: config.boundedContext }),
        getErrorText: getPulseDisabledError,
      });
    },
  });

  return listPulseMetricDefinitionsFromDefinitionIdsTool;
};
