/**
 * Export Superstore data from Tableau datasource to JSON file.
 * Run from project root: npx tsx scripts/exportSuperstoreData.ts
 * Requires env vars (from ./env): SERVER, SITE_NAME, PAT_NAME, PAT_VALUE
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import dotenv from 'dotenv';

// Load env from project root (file named 'env' not '.env')
dotenv.config({ path: join(process.cwd(), 'env') });

import { RestApi } from '../src/sdks/tableau/restApi.js';
import type { QueryOutput } from '../src/sdks/tableau/apis/vizqlDataServiceApi.js';

const SUPERSTORE_DATASOURCE_LUID = '23980b8e-e029-4c51-a269-27acf0787b6c';
const OUTPUT_PATH = join(process.cwd(), 'dashboard-app', 'data', 'superstore.json');

interface SuperstoreExport {
  summary: {
    sales: number;
    profit: number;
    orderCount: number;
    customerCount: number;
    quantity: number;
    avgDiscount: number;
  };
  stateData: Array<{
    state: string;
    stateCode: string;
    sales: number;
    profit: number;
    region: string;
  }>;
  monthlySalesBySegment: Array<Record<string, number | string>>;
  monthlySalesByCategory: Array<Record<string, number | string>>;
}

// US state name to code mapping
function getFallbackData(): SuperstoreExport {
  const fallbackPath = join(process.cwd(), 'dashboard-app', 'data', 'superstore.json');
  if (existsSync(fallbackPath)) {
    try {
      const existing = JSON.parse(
        readFileSync(fallbackPath, 'utf-8'),
      ) as SuperstoreExport;
      if (existing.stateData?.length || existing.monthlySalesBySegment?.length) {
        return existing;
      }
    } catch {
      // ignore parse errors
    }
  }
  // Full sample fallback when no Tableau data available (from data.js)
  return {
    summary: {
      sales: 2326534,
      profit: 292297,
      orderCount: 5123,
      customerCount: 800,
      quantity: 38654,
      avgDiscount: 0.1554,
    },
    stateData: [
      { state: 'Alabama', stateCode: 'AL', sales: 45678, profit: 2345, region: 'South' },
      { state: 'Arizona', stateCode: 'AZ', sales: 89234, profit: 12456, region: 'West' },
      { state: 'California', stateCode: 'CA', sales: 456789, profit: 67890, region: 'West' },
      { state: 'Florida', stateCode: 'FL', sales: 234567, profit: -12345, region: 'South' },
      { state: 'Georgia', stateCode: 'GA', sales: 156789, profit: 12345, region: 'South' },
      { state: 'Illinois', stateCode: 'IL', sales: 198765, profit: 23456, region: 'Central' },
      { state: 'New York', stateCode: 'NY', sales: 267890, profit: -23456, region: 'East' },
      { state: 'Texas', stateCode: 'TX', sales: 198765, profit: -23456, region: 'South' },
      { state: 'Washington', stateCode: 'WA', sales: 145678, profit: 25678, region: 'West' },
    ],
    monthlySalesBySegment: [
      { month: '2022-01', Consumer: 42000, Corporate: 38000, 'Home Office': 22000 },
      { month: '2022-06', Consumer: 55000, Corporate: 50000, 'Home Office': 30000 },
      { month: '2022-12', Consumer: 65000, Corporate: 60000, 'Home Office': 38000 },
      { month: '2023-06', Consumer: 62000, Corporate: 58000, 'Home Office': 35000 },
      { month: '2023-12', Consumer: 72000, Corporate: 68000, 'Home Office': 42000 },
      { month: '2024-06', Consumer: 69000, Corporate: 65000, 'Home Office': 39000 },
      { month: '2024-12', Consumer: 79000, Corporate: 75000, 'Home Office': 46000 },
      { month: '2025-06', Consumer: 74000, Corporate: 70000, 'Home Office': 43000 },
      { month: '2025-12', Consumer: 84000, Corporate: 80000, 'Home Office': 50000 },
    ],
    monthlySalesByCategory: [
      { month: '2022-01', Furniture: 28000, 'Office Supplies': 32000, Technology: 42000 },
      { month: '2022-06', Furniture: 37000, 'Office Supplies': 40000, Technology: 58000 },
      { month: '2022-12', Furniture: 46000, 'Office Supplies': 50000, Technology: 72000 },
      { month: '2023-06', Furniture: 44000, 'Office Supplies': 48000, Technology: 65000 },
      { month: '2023-12', Furniture: 53000, 'Office Supplies': 59000, Technology: 80000 },
      { month: '2024-06', Furniture: 51000, 'Office Supplies': 56000, Technology: 74000 },
      { month: '2024-12', Furniture: 60000, 'Office Supplies': 68000, Technology: 89000 },
      { month: '2025-06', Furniture: 55000, 'Office Supplies': 62000, Technology: 80000 },
      { month: '2025-12', Furniture: 64000, 'Office Supplies': 74000, Technology: 95000 },
    ],
  };
}

const STATE_CODES: Record<string, string> = {
  Alabama: 'AL',
  Arizona: 'AZ',
  Arkansas: 'AR',
  California: 'CA',
  Colorado: 'CO',
  Connecticut: 'CT',
  Delaware: 'DE',
  Florida: 'FL',
  Georgia: 'GA',
  Illinois: 'IL',
  Indiana: 'IN',
  Iowa: 'IA',
  Kansas: 'KS',
  Kentucky: 'KY',
  Louisiana: 'LA',
  Maryland: 'MD',
  Michigan: 'MI',
  Minnesota: 'MN',
  Mississippi: 'MS',
  Missouri: 'MO',
  Nebraska: 'NE',
  Nevada: 'NV',
  'New Jersey': 'NJ',
  'New Mexico': 'NM',
  'New York': 'NY',
  'North Carolina': 'NC',
  Ohio: 'OH',
  Oklahoma: 'OK',
  Oregon: 'OR',
  Pennsylvania: 'PA',
  'South Carolina': 'SC',
  Tennessee: 'TN',
  Texas: 'TX',
  Virginia: 'VA',
  Washington: 'WA',
  Wisconsin: 'WI',
  Wyoming: 'WY',
  'District of Columbia': 'DC',
};

async function runQuery(
  restApi: RestApi,
  query: object,
): Promise<QueryOutput['data'] | null> {
  const result = await restApi.vizqlDataServiceMethods.queryDatasource({
    datasource: { datasourceLuid: SUPERSTORE_DATASOURCE_LUID },
    query,
    options: { returnFormat: 'OBJECTS', debug: true, disaggregate: false },
  });

  if (result.isErr()) {
    console.error('Query failed:', result.error);
    return null;
  }
  return result.value.data ?? null;
}

function aggregateStateData(rows: Record<string, unknown>[]): SuperstoreExport['stateData'] {
  const byState = new Map<
    string,
    { sales: number; profit: number; region: string }
  >();

  for (const row of rows) {
    const state = String(row['State/Province'] ?? row['State'] ?? '');
    if (!state) continue;

    const sales = Number(row['Sales'] ?? row['Total Sales'] ?? 0);
    const profit = Number(row['Profit'] ?? row['Total Profit'] ?? 0);
    const region = String(row['Region'] ?? '');

    const existing = byState.get(state);
    if (existing) {
      existing.sales += sales;
      existing.profit += profit;
    } else {
      byState.set(state, { sales, profit, region });
    }
  }

  return Array.from(byState.entries()).map(([state, { sales, profit, region }]) => ({
    state,
    stateCode: STATE_CODES[state] ?? state.slice(0, 2).toUpperCase(),
    sales,
    profit,
    region: region || 'Unknown',
  }));
}

function aggregateMonthlyByDimension(
  rows: Record<string, unknown>[],
  dimensionKey: string,
  valueKey: string,
): Array<Record<string, number | string>> {
  const byMonth = new Map<string, Record<string, number>>();

  for (const row of rows) {
    const monthRaw = row['Month'] ?? row['Order Date'] ?? row['month'];
    const month =
      typeof monthRaw === 'string'
        ? monthRaw.slice(0, 7)
        : monthRaw instanceof Date
          ? monthRaw.toISOString().slice(0, 7)
          : '';
    if (!month) continue;

    const dim = String(row[dimensionKey] ?? '');
    const val = Number(row[valueKey] ?? row['Sales'] ?? 0);

    if (!byMonth.has(month)) {
      byMonth.set(month, { month });
    }
    const entry = byMonth.get(month)!;
    entry[dim] = (entry[dim] ?? 0) + val;
  }

  return Array.from(byMonth.values()).sort(
    (a, b) => (a.month as string).localeCompare(b.month as string),
  ) as Array<Record<string, number | string>>;
}

async function main() {
  const server = process.env.SERVER;
  const siteName = process.env.SITE_NAME;
  const patName = process.env.PAT_NAME;
  const patValue = process.env.PAT_VALUE;

  if (!server || !siteName || !patName || !patValue) {
    console.error(
      'Missing required env vars: SERVER, SITE_NAME, PAT_NAME, PAT_VALUE. Copy from ./env',
    );
    process.exit(1);
  }

  console.log('Connecting to Tableau...');
  const restApi = new RestApi(server, { maxRequestTimeoutMs: 60000 });

  let signedIn = false;
  try {
    await restApi.signIn({
      type: 'pat',
      patName,
      patValue,
      siteName,
    });
    signedIn = true;
  } catch (err) {
    console.warn('Tableau sign-in failed (check PAT in ./env). Writing fallback data.');
    const fallback = getFallbackData();
    const dir = join(process.cwd(), 'dashboard-app', 'data');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(OUTPUT_PATH, JSON.stringify(fallback, null, 2), 'utf-8');
    console.log('Wrote', OUTPUT_PATH, '(fallback data)');
    process.exit(0);
  }

  try {
    const exportData: Partial<SuperstoreExport> = {};

    // 1. Summary KPIs
    const summaryRows = await runQuery(restApi, {
      fields: [
        { fieldCaption: 'Sales', function: 'SUM', fieldAlias: 'Total Sales' },
        { fieldCaption: 'Profit', function: 'SUM', fieldAlias: 'Total Profit' },
        { fieldCaption: 'Order ID', function: 'COUNT', fieldAlias: 'Order Count' },
        { fieldCaption: 'Customer ID', function: 'COUNTD', fieldAlias: 'Customer Count' },
        { fieldCaption: 'Quantity', function: 'SUM', fieldAlias: 'Total Quantity' },
        { fieldCaption: 'Discount', function: 'AVG', fieldAlias: 'Avg Discount' },
      ],
    });

    if (summaryRows && summaryRows.length > 0) {
      const row = summaryRows[0] as Record<string, unknown>;
      const totalSales = Number(row['Total Sales'] ?? row['Sales'] ?? 0);
      const totalProfit = Number(row['Total Profit'] ?? row['Profit'] ?? 0);
      const orderCount = Number(row['Order Count'] ?? 0);
      const customerCount = Number(row['Customer Count'] ?? 0);
      const quantity = Number(row['Total Quantity'] ?? row['Quantity'] ?? 0);
      const avgDiscount = Number(row['Avg Discount'] ?? row['Discount'] ?? 0);

      exportData.summary = {
        sales: totalSales,
        profit: totalProfit,
        orderCount,
        customerCount,
        quantity,
        avgDiscount,
      };
      console.log('Summary:', exportData.summary);
    }

    // 2. State-level data
    const stateRows = await runQuery(restApi, {
      fields: [
        { fieldCaption: 'State/Province', fieldAlias: 'State' },
        { fieldCaption: 'Region', fieldAlias: 'Region' },
        { fieldCaption: 'Sales', function: 'SUM', fieldAlias: 'Sales' },
        { fieldCaption: 'Profit', function: 'SUM', fieldAlias: 'Profit' },
      ],
    });

    if (stateRows && stateRows.length > 0) {
      exportData.stateData = aggregateStateData(
        stateRows as Record<string, unknown>[],
      );
      console.log('State data:', exportData.stateData.length, 'states');
    }

    // 3. Monthly sales by segment
    const segmentRows = await runQuery(restApi, {
      fields: [
        {
          fieldCaption: 'Order Date',
          function: 'TRUNC_MONTH',
          fieldAlias: 'Month',
          sortDirection: 'ASC',
          sortPriority: 1,
        },
        { fieldCaption: 'Segment', fieldAlias: 'Segment' },
        { fieldCaption: 'Sales', function: 'SUM', fieldAlias: 'Sales' },
      ],
    });

    if (segmentRows && segmentRows.length > 0) {
      exportData.monthlySalesBySegment = aggregateMonthlyByDimension(
        segmentRows as Record<string, unknown>[],
        'Segment',
        'Sales',
      );
      console.log(
        'Monthly by segment:',
        exportData.monthlySalesBySegment.length,
        'months',
      );
    }

    // 4. Monthly sales by category
    const categoryRows = await runQuery(restApi, {
      fields: [
        {
          fieldCaption: 'Order Date',
          function: 'TRUNC_MONTH',
          fieldAlias: 'Month',
          sortDirection: 'ASC',
          sortPriority: 1,
        },
        { fieldCaption: 'Category', fieldAlias: 'Category' },
        { fieldCaption: 'Sales', function: 'SUM', fieldAlias: 'Sales' },
      ],
    });

    if (categoryRows && categoryRows.length > 0) {
      exportData.monthlySalesByCategory = aggregateMonthlyByDimension(
        categoryRows as Record<string, unknown>[],
        'Category',
        'Sales',
      );
      console.log(
        'Monthly by category:',
        exportData.monthlySalesByCategory.length,
        'months',
      );
    }

    // Fallback sample data for any missing sections
    const fallbackSummary = {
      sales: 2326534,
      profit: 292297,
      orderCount: 5123,
      customerCount: 800,
      quantity: 38654,
      avgDiscount: 0.1554,
    };

    // Use fallback sample data when Tableau queries fail or return empty
    const hasData =
      (exportData.stateData?.length ?? 0) > 0 ||
      (exportData.monthlySalesBySegment?.length ?? 0) > 0 ||
      (exportData.monthlySalesByCategory?.length ?? 0) > 0;

    const finalData: SuperstoreExport = hasData
      ? {
          summary: exportData.summary ?? fallbackSummary,
          stateData: exportData.stateData ?? [],
          monthlySalesBySegment: exportData.monthlySalesBySegment ?? [],
          monthlySalesByCategory: exportData.monthlySalesByCategory ?? [],
        }
      : getFallbackData();

    const dir = join(process.cwd(), 'dashboard-app', 'data');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(OUTPUT_PATH, JSON.stringify(finalData, null, 2), 'utf-8');
    console.log('Wrote', OUTPUT_PATH);
  } finally {
    if (signedIn) await restApi.signOut();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
