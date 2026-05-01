import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { Ok } from 'ts-results-es';
import { z } from 'zod';

import { getConfig } from '../../../config.js';
import { useRestApi } from '../../../restApiInstance.js';
import { PulseDisabledError } from '../../../sdks/tableau/methods/pulseMethods.js';
import {
  CreatePulseDefinitionResponse,
  pulseAggregationEnum,
  pulseGranularityEnum,
  pulseNumberFormatTypeEnum,
  pulseSentimentTypeEnum,
} from '../../../sdks/tableau/types/pulse.js';
import { Server } from '../../../server.js';
import { getTableauAuthInfo } from '../../../server/oauth/getTableauAuthInfo.js';
import { Tool } from '../../tool.js';
import { getPulseDisabledError } from '../getPulseDisabledError.js';

const scopeSchema = z.object({
  filters: z
    .array(
      z.object({
        field: z.string().nonempty().describe('Dimension field name from the datasource'),
        values: z
          .array(z.string())
          .min(1)
          .describe('One or more values to filter on (OR logic within a single field)'),
      }),
    )
    .min(1)
    .describe('Filters that define this scoped metric. Multiple filters are AND-ed together.'),
});

const paramsSchema = {
  // ── Phase 1: define ──────────────────────────────────────────────────────
  name: z.string().nonempty().describe('Display name for the metric definition'),

  datasourceId: z
    .string()
    .nonempty()
    .describe(
      'LUID of the published datasource. Use list-datasources to find it if unknown.',
    ),

  measureField: z
    .string()
    .nonempty()
    .describe('Field name to aggregate (e.g. "Sales", "Order ID")'),

  aggregation: z
    .enum(pulseAggregationEnum)
    .describe(
      'Aggregation type: SUM, COUNT, COUNTD, AVG, MIN, MAX, or MEDIAN. ' +
        'Use AGG_TYPE_SUM for revenue/sales, AGG_TYPE_COUNTD for unique counts.',
    ),

  timeDimensionField: z
    .string()
    .nonempty()
    .describe('Date/datetime field used as the time axis (e.g. "Order Date")'),

  allowedDimensions: z
    .array(z.string())
    .optional()
    .describe(
      'Dimension field names users can drill into (e.g. ["Region", "Category", "Segment"]). ' +
        'Empty means no drill-down.',
    ),

  allowedGranularities: z
    .array(z.enum(pulseGranularityEnum))
    .optional()
    .describe(
      'Time granularities available to users. ' +
        'Defaults to DAY/WEEK/MONTH/QUARTER/YEAR if omitted.',
    ),

  numberFormat: z
    .enum(pulseNumberFormatTypeEnum)
    .optional()
    .default('NUMBER_FORMAT_TYPE_NUMBER')
    .describe('Number display format: NUMBER, CURRENCY, or PERCENT'),

  sentimentType: z
    .enum(pulseSentimentTypeEnum)
    .optional()
    .default('SENTIMENT_TYPE_NONE')
    .describe(
      'Whether higher is better (POSITIVE_UP), lower is better (NEGATIVE_UP), or neutral (NONE)',
    ),

  // ── Phase 2: scoped metrics ──────────────────────────────────────────────
  scopes: z
    .array(scopeSchema)
    .optional()
    .describe(
      'Scoped metrics to create after the definition. Each scope is a set of filters ' +
        'that produce a focused view (e.g. Region=West). ' +
        'Omit to create only the default (unfiltered) metric.',
    ),

  // ── Phase 3: confirmation ────────────────────────────────────────────────
  confirm: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'Set to true to actually create the definition and metrics in Tableau. ' +
        'Omit (or false) to receive a preview of what will be created.',
    ),
};

type CreationResult = {
  preview?: object;
  definition?: { id: string; name: string };
  metrics?: Array<{ id: string; filters: unknown; is_newly_created: boolean }>;
  warnings?: string[];
};

export const getCreatePulseMetricDefinitionTool = (server: Server): Tool<typeof paramsSchema> => {
  const tool = new Tool({
    server,
    name: 'create-pulse-metric-definition',
    description: `
Creates a Tableau Pulse metric definition and optional scoped metrics.

When called with \`confirm: false\` (default), returns a JSON preview of the definition and all
scoped metrics that would be created — no changes are made to Tableau.

When called with \`confirm: true\`, creates the definition via the Pulse REST API, then creates
each scoped metric using getOrCreate semantics. Returns the new definition ID and metric IDs.

**Scoped metrics** narrow a definition to specific dimension values. Each scope is a set of
filters that are AND-ed together; multiple values within one filter are OR-ed:
- { filters: [{ field: "Region", values: ["West"] }] }  →  Region = West
- { filters: [{ field: "Region", values: ["East","West"] }] }  →  Region IN (East, West)
- { filters: [{ field: "Region", values: ["West"] }, { field: "Category", values: ["Technology"] }] }  →  Region=West AND Category=Technology

**allowedGranularities** defaults to all five (DAY/WEEK/MONTH/QUARTER/YEAR) if omitted.

**sentimentType**: POSITIVE_UP = higher is better (green), NEGATIVE_UP = lower is better, NONE = neutral.
`,
    paramsSchema,
    annotations: {
      title: 'Create Pulse Metric Definition',
      readOnlyHint: false,
      openWorldHint: false,
    },
    callback: async (
      {
        name,
        datasourceId,
        measureField,
        aggregation,
        timeDimensionField,
        allowedDimensions,
        allowedGranularities,
        numberFormat,
        sentimentType,
        scopes,
        confirm,
      },
      { requestId, authInfo, signal },
    ): Promise<CallToolResult> => {
      const config = getConfig();

      return await tool.logAndExecute<CreationResult, PulseDisabledError>({
        requestId,
        authInfo,
        args: {
          name,
          datasourceId,
          measureField,
          aggregation,
          timeDimensionField,
          allowedDimensions,
          allowedGranularities,
          numberFormat,
          sentimentType,
          scopes,
          confirm,
        },
        getErrorText: getPulseDisabledError,
        callback: async () => {
          const resolvedGranularities =
            allowedGranularities && allowedGranularities.length > 0
              ? allowedGranularities
              : (['GRANULARITY_DAY', 'GRANULARITY_WEEK', 'GRANULARITY_MONTH', 'GRANULARITY_QUARTER', 'GRANULARITY_YEAR'] as const);

          const definitionPayload = {
            name,
            specification: {
              datasource: { id: datasourceId },
              basic_specification: {
                measure: { field: measureField, aggregation },
                time_dimension: { field: timeDimensionField },
                filters: [] as never[],
              },
              is_running_total: false,
            },
            extension_options: {
              allowed_dimensions: allowedDimensions ?? [],
              allowed_granularities: [...resolvedGranularities],
              offset_from_today: 0,
            },
            representation_options: {
              type: numberFormat ?? 'NUMBER_FORMAT_TYPE_NUMBER',
              sentiment_type: sentimentType ?? 'SENTIMENT_TYPE_NONE',
            },
          };

          const scopePayloads = (scopes ?? []).map((scope) => ({
            filters: scope.filters.map((f) => ({
              field: f.field,
              operator: f.values.length === 1 ? 'OPERATOR_EQUAL' : 'OPERATOR_IN',
              categorical_values: f.values.map((v) => ({ string_value: v })),
            })),
          }));

          if (!confirm) {
            return new Ok<CreationResult, PulseDisabledError>({
              preview: {
                definition: definitionPayload,
                scoped_metrics: scopePayloads.map((sp, i) => ({
                  label: `Scope ${i + 1}`,
                  filters: sp.filters,
                })),
                note: 'This is a preview. Call again with confirm: true to create in Tableau.',
              },
            });
          }

          // ── Create the definition ──────────────────────────────────────
          const defResult = await useRestApi({
            config,
            requestId,
            server,
            jwtScopes: ['tableau:insight_definitions_metrics:create'],
            signal,
            authInfo: getTableauAuthInfo(authInfo),
            callback: async (restApi) =>
              restApi.pulseMethods.createPulseMetricDefinition(definitionPayload),
          });

          if (defResult.isErr()) return defResult;

          const createdDef: CreatePulseDefinitionResponse = defResult.value;
          const definitionId = createdDef.definition.metadata.id;

          // ── Create scoped metrics ──────────────────────────────────────
          const warnings: string[] = [];
          const createdMetrics: CreationResult['metrics'] = [];

          for (const sp of scopePayloads) {
            const metricResult = await useRestApi({
              config,
              requestId,
              server,
              jwtScopes: ['tableau:insight_definitions_metrics:update'],
              signal,
              authInfo: getTableauAuthInfo(authInfo),
              callback: async (restApi) =>
                restApi.pulseMethods.createPulseMetric({
                  definition_id: definitionId,
                  specification: { filters: sp.filters },
                }),
            });

            if (metricResult.isErr()) {
              warnings.push(
                `Failed to create scoped metric with filters ${JSON.stringify(sp.filters)}: ${metricResult.error}`,
              );
            } else {
              const m = metricResult.value;
              createdMetrics.push({
                id: m.metric.id,
                filters: m.metric.specification.filters,
                is_newly_created: m.is_metric_created ?? true,
              });
            }
          }

          return new Ok<CreationResult, PulseDisabledError>({
            definition: { id: definitionId, name: createdDef.definition.metadata.name },
            metrics: createdMetrics,
            ...(warnings.length > 0 ? { warnings } : {}),
          });
        },
        constrainSuccessResult: (result) => ({ type: 'success', result }),
      });
    },
  });

  return tool;
};
