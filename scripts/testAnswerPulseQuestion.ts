import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import dotenv from 'dotenv';

dotenv.config({ path: 'env.list' });

const env: Record<string, string> = {
  PATH: process.env.PATH ?? '',
  TRANSPORT: 'stdio',
  SERVER: process.env.SERVER ?? '',
  SITE_NAME: process.env.SITE_NAME ?? '',
  PAT_NAME: process.env.PAT_NAME ?? '',
  PAT_VALUE: process.env.PAT_VALUE ?? '',
  DEFAULT_LOG_LEVEL: 'debug',
  DANGEROUSLY_DISABLE_OAUTH: 'true',
};

const transport = new StdioClientTransport({
  command: 'node',
  args: ['build/index.js'],
  env,
});

const client = new Client({ name: 'test-client', version: '1.0.0' });

async function main() {
  console.log('Connecting...');
  await client.connect(transport);

  console.log('\nListing tools...');
  const { tools } = await client.listTools();
  console.log(tools.map((t) => t.name).join('\n'));

  console.log('\nCalling answer-pulse-question...');
  const result = await client.callTool({
    name: 'answer-pulse-question',
    arguments: {
      question: 'Summarize revenue',
      metricNames: ['Revenue'],
    },
  });

  console.log('\nResult:');
  console.log(JSON.stringify(result, null, 2));

  await client.close();
}

main().catch(console.error);
