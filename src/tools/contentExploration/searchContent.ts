import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { Ok } from 'ts-results-es';
import { z } from 'zod';

import { getConfig } from '../../config.js';
import { useRestApi } from '../../restApiInstance.js';
import {
  orderBySchema,
  searchContentFilterSchema,
} from '../../sdks/tableau/types/contentExploration.js';
import { Server } from '../../server.js';
import { getTableauAuthInfo } from '../../server/oauth/getTableauAuthInfo.js';
import { Tool } from '../tool.js';
import {
  buildFilterString,
  buildOrderByString,
  constrainSearchContent,
  ReducedSearchContentResponse,
  reduceSearchContentResponse,
} from './searchContentUtils.js';

const paramsSchema = {
  terms: z.string().trim().nonempty().optional(),
  limit: z.number().int().min(1).max(2000).default(100).optional(),
  orderBy: orderBySchema.optional(),
  filter: searchContentFilterSchema.optional(),
};

export const getSearchContentTool = (server: Server): Tool<typeof paramsSchema> => {
  const searchContentTool = new Tool({
    server,
    name: 'search-content',
    description: `
    Searches across all supported content types for objects relevant to search terms and filters. PARAMETERS: terms optional string with search terms. If omitted searches everything bound by filters. filter optional limits results by contentTypes lens datasource virtualconnection collection project flow datarole table database view workbook ownerIds array of integers modifiedTime ISO 8601 date-time strings range or array. limit optional number of items default 100 max 2000. orderBy optional sorting method hitsTotal hitsSmallSpanTotal hitsMediumSpanTotal hitsLargeSpanTotal downstreamWorkbookCount. Sort direction asc or desc default asc. Array of objects with method and direction first element primary sorting. If orderBy omitted sorts by relevance score descending. NOTES: contentTypes filter required for downstreamWorkbookCount. ModifiedTime can be range with startDate endDate or array of specific date-times.
    `,
    paramsSchema,
    annotations: {
      title: 'Search Content',
      readOnlyHint: true,
      openWorldHint: false,
    },
    callback: async (
      { terms, limit, orderBy, filter },
      { requestId, authInfo, signal },
    ): Promise<CallToolResult> => {
      const config = getConfig();
      const orderByString = orderBy ? buildOrderByString(orderBy) : undefined;
      const filterString = filter ? buildFilterString(filter) : undefined;
      return await searchContentTool.logAndExecute<Array<ReducedSearchContentResponse>>({
        requestId,
        authInfo,
        args: {},
        callback: async () => {
          return new Ok(
            await useRestApi({
              config,
              requestId,
              server,
              jwtScopes: ['tableau:content:read'],
              signal,
              authInfo: getTableauAuthInfo(authInfo),
              callback: async (restApi) => {
                const response = await restApi.contentExplorationMethods.searchContent({
                  terms,
                  page: 0,
                  limit: config.maxResultLimit
                    ? Math.min(config.maxResultLimit, limit ?? 100)
                    : (limit ?? 100),
                  orderBy: orderByString,
                  filter: filterString,
                });
                return reduceSearchContentResponse(response);
              },
            }),
          );
        },
        constrainSuccessResult: (items) =>
          constrainSearchContent({ items, boundedContext: config.boundedContext }),
      });
    },
  });

  return searchContentTool;
};
