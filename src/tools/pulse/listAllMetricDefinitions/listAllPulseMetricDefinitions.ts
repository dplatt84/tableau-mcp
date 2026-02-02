import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { Ok } from 'ts-results-es';
import { z } from 'zod';

import { getConfig } from '../../../config.js';
import { useRestApi } from '../../../restApiInstance.js';
import {
  PulseMetricDefinition,
  pulseMetricDefinitionViewEnum,
} from '../../../sdks/tableau/types/pulse.js';
import { Server } from '../../../server.js';
import { getTableauAuthInfo } from '../../../server/oauth/getTableauAuthInfo.js';
import { pulsePaginate } from '../../../utils/paginate.js';
import { Tool } from '../../tool.js';
import { constrainPulseDefinitions } from '../constrainPulseDefinitions.js';
import { getPulseDisabledError } from '../getPulseDisabledError.js';

const paramsSchema = {
  view: z.optional(z.enum(pulseMetricDefinitionViewEnum)),
  limit: z.coerce.number().gt(0).optional(),
  pageSize: z.coerce.number().gt(0).optional(),
};

export const getListAllPulseMetricDefinitionsTool = (server: Server): Tool<typeof paramsSchema> => {
  const listAllPulseMetricDefinitionsTool = new Tool({
    server,
    name: 'list-all-pulse-metric-definitions',
    description: `
    Retrieves all published Pulse Metric Definitions using Tableau REST API. Use when user requests to list all Pulse Metric Definitions on current site. PARAMETERS: view optional range of metrics to return default DEFINITION_VIEW_BASIC. DEFINITION_VIEW_BASIC returns only definition. DEFINITION_VIEW_FULL returns definition and specified number of metrics up to 5. DEFINITION_VIEW_DEFAULT returns definition and default metric. limit optional maximum number of definitions to return. pageSize optional number of results per page controls pagination. EXAMPLES: List all definitions. List with default view view DEFINITION_VIEW_DEFAULT. List first 50 limit 50. List with full view view DEFINITION_VIEW_FULL note response includes up to 5 metrics use another tool for more. List with basic view view DEFINITION_VIEW_BASIC.
    `,
    paramsSchema,
    annotations: {
      title: 'List All Pulse Metric Definitions',
      readOnlyHint: true,
      openWorldHint: false,
    },
    callback: async (
      { view, limit, pageSize },
      { requestId, authInfo, signal },
    ): Promise<CallToolResult> => {
      const config = getConfig();
      return await listAllPulseMetricDefinitionsTool.logAndExecute({
        requestId,
        authInfo,
        args: { view, limit, pageSize },
        callback: async () => {
          return await useRestApi({
            config,
            requestId,
            server,
            jwtScopes: ['tableau:insight_definitions_metrics:read'],
            signal,
            authInfo: getTableauAuthInfo(authInfo),
            callback: async (restApi) => {
              const definitions = await pulsePaginate({
                config: {
                  limit: config.maxResultLimit
                    ? Math.min(config.maxResultLimit, limit ?? Number.MAX_SAFE_INTEGER)
                    : limit,
                  pageSize,
                },
                getDataFn: async (pageToken, pageSize) => {
                  const apiResult = await restApi.pulseMethods.listAllPulseMetricDefinitions(
                    view,
                    pageToken,
                    pageSize,
                  );

                  if (apiResult.isOk()) {
                    return new Ok({
                      pagination: apiResult.value.pagination,
                      data: apiResult.value.definitions,
                    });
                  }

                  return apiResult;
                },
              });
              return definitions;
            },
          });
        },
        constrainSuccessResult: (definitions: Array<PulseMetricDefinition>) =>
          constrainPulseDefinitions({ definitions, boundedContext: config.boundedContext }),
        getErrorText: getPulseDisabledError,
      });
    },
  });

  return listAllPulseMetricDefinitionsTool;
};
