import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { Ok } from 'ts-results-es';
import { z } from 'zod';

import { BoundedContext, getConfig } from '../../config.js';
import { useRestApi } from '../../restApiInstance.js';
import { View } from '../../sdks/tableau/types/view.js';
import { Server } from '../../server.js';
import { getTableauAuthInfo } from '../../server/oauth/getTableauAuthInfo.js';
import { paginate } from '../../utils/paginate.js';
import { ConstrainedResult, Tool } from '../tool.js';
import { parseAndValidateViewsFilterString } from './viewsFilterUtils.js';

const paramsSchema = {
  filter: z.string().optional(),
  pageSize: z.number().gt(0).optional(),
  limit: z.number().gt(0).optional(),
};

export const getListViewsTool = (server: Server): Tool<typeof paramsSchema> => {
  const listViewsTool = new Tool({
    server,
    name: 'list-views',
    description: `
    Retrieves a list of views on a Tableau site including their metadata such as name, owner, and the workbook they are found in. Supports optional filtering via field:operator:value expressions. Use this tool to list search or filter Tableau views. FILTER FIELDS: caption contentUrl createdAt favoritesTotal fields hitsTotal name ownerDomain ownerEmail ownerName projectName sheetNumber sheetType tags title updatedAt viewUrlname workbookDescription workbookName. OPERATORS: eq equals gt greater than gte greater equal in list lt less than lte less equal. SYNTAX: Format field:operator:value multiple filters comma-separated case-sensitive. Date format ISO 8601 like 2023-01-01T00:00:00Z. Wildcards use star for matching. Values cannot contain special chars or commas. Filter expressions cannot contain ampersands or commas even if encoded. Multiple expressions combined with logical AND. EXAMPLES: Empty filter lists all. name:eq:Overview filters by name. projectName:eq:Finance filters by project. Combined name:eq:Overview,projectName:eq:Finance,createdAt:gt:2023-01-01T00:00:00Z.
    `,
    paramsSchema,
    annotations: {
      title: 'List Views',
      readOnlyHint: true,
      openWorldHint: false,
    },
    callback: async (
      { filter, pageSize, limit },
      { requestId, authInfo, signal },
    ): Promise<CallToolResult> => {
      const config = getConfig();
      const validatedFilter = filter ? parseAndValidateViewsFilterString(filter) : undefined;

      return await listViewsTool.logAndExecute({
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
                const views = await paginate({
                  pageConfig: {
                    pageSize,
                    limit: config.maxResultLimit
                      ? Math.min(config.maxResultLimit, limit ?? Number.MAX_SAFE_INTEGER)
                      : limit,
                  },
                  getDataFn: async (pageConfig) => {
                    const { pagination, views: data } =
                      await restApi.viewsMethods.queryViewsForSite({
                        siteId: restApi.siteId,
                        filter: validatedFilter ?? '',
                        includeUsageStatistics: true,
                        pageSize: pageConfig.pageSize,
                        pageNumber: pageConfig.pageNumber,
                      });

                    return { pagination, data };
                  },
                });

                return views;
              },
            }),
          );
        },
        constrainSuccessResult: (views) =>
          constrainViews({ views, boundedContext: config.boundedContext }),
      });
    },
  });

  return listViewsTool;
};

export function constrainViews({
  views,
  boundedContext,
}: {
  views: Array<View>;
  boundedContext: BoundedContext;
}): ConstrainedResult<Array<View>> {
  if (views.length === 0) {
    return {
      type: 'empty',
      message: 'No views were found. Either none exist or you do not have permission to view them.',
    };
  }

  const { projectIds, workbookIds } = boundedContext;
  if (projectIds) {
    views = views.filter((view) => (view.project?.id ? projectIds.has(view.project.id) : false));
  }

  if (workbookIds) {
    views = views.filter((view) => (view.workbook?.id ? workbookIds.has(view.workbook.id) : false));
  }

  if (views.length === 0) {
    return {
      type: 'empty',
      message: [
        'The set of allowed views that can be queried is limited by the server configuration.',
        'While views were found, they were all filtered out by the server configuration.',
      ].join(' '),
    };
  }

  return {
    type: 'success',
    result: views,
  };
}
