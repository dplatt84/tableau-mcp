import { exportedForTesting as serverExportedForTesting } from './server.js';
import { getQueryDatasourceTool } from './tools/queryDatasource/queryDatasource.js';
import { toolNames } from './tools/toolName.js';
import { toolFactories } from './tools/tools.js';
import { normalizeDescription } from './utils/normalizeDescription.js';
import { Provider } from './utils/provider.js';

const { Server } = serverExportedForTesting;

describe('server', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      INCLUDE_TOOLS: undefined,
      EXCLUDE_TOOLS: undefined,
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should register tools', async () => {
    const server = getServer();
    await server.registerTools();

    const tools = toolFactories.map((toolFactory) => toolFactory(server));
    for (const tool of tools) {
      const resolvedDescription = await Provider.from(tool.description);
      expect(server.tool).toHaveBeenCalledWith(
        tool.name,
        normalizeDescription(resolvedDescription),
        expect.any(Object),
        expect.any(Object),
        expect.any(Function),
      );
    }
  });

  it('should register tools filtered by includeTools', async () => {
    process.env.INCLUDE_TOOLS = 'query-datasource';
    const server = getServer();
    await server.registerTools();

    const tool = getQueryDatasourceTool(server);
    const resolvedDescription = await Provider.from(tool.description);
    expect(server.tool).toHaveBeenCalledWith(
      tool.name,
      normalizeDescription(resolvedDescription),
      expect.any(Object),
      expect.any(Object),
      expect.any(Function),
    );
  });

  it('should register tools filtered by excludeTools', async () => {
    process.env.EXCLUDE_TOOLS = 'query-datasource';
    const server = getServer();
    await server.registerTools();

    const tools = toolFactories.map((toolFactory) => toolFactory(server));
    for (const tool of tools) {
      const resolvedDescription = await Provider.from(tool.description);
      if (tool.name === 'query-datasource') {
        expect(server.tool).not.toHaveBeenCalledWith(
          tool.name,
          normalizeDescription(resolvedDescription),
          expect.any(Object),
          expect.any(Object),
          expect.any(Function),
        );
      } else {
        expect(server.tool).toHaveBeenCalledWith(
          tool.name,
          normalizeDescription(resolvedDescription),
          expect.any(Object),
          expect.any(Object),
          expect.any(Function),
        );
      }
    }
  });

  it('should throw error when no tools are registered', async () => {
    const sortedToolNames = [...toolNames].sort((a, b) => a.localeCompare(b)).join(', ');
    process.env.EXCLUDE_TOOLS = sortedToolNames;
    const server = getServer();

    const sentences = [
      'No tools to register',
      `Tools available = [${toolNames.join(', ')}]`,
      `EXCLUDE_TOOLS = [${sortedToolNames}]`,
      'INCLUDE_TOOLS = []',
    ];

    for (const sentence of sentences) {
      await expect(server.registerTools).rejects.toThrow(sentence);
    }
  });

  it('should register request handlers', async () => {
    const server = getServer();
    server.server.setRequestHandler = vi.fn();
    server.registerRequestHandlers();

    expect(server.server.setRequestHandler).toHaveBeenCalled();
  });
});

function getServer(): InstanceType<typeof Server> {
  const server = new Server();
  server.tool = vi.fn();
  return server;
}
