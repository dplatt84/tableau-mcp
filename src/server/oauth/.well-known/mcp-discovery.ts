import express from 'express';

import { getConfig } from '../../../config.js';
import { serverName, serverVersion } from '../../../server.js';

/**
 * MCP Server Discovery Endpoint
 *
 * Returns metadata about the MCP server including endpoints and capabilities.
 * This helps clients discover how to connect.
 */
export function mcpDiscovery(app: express.Application): void {
  app.get('/.well-known/mcp', (_req, res) => {
    const origin = getConfig().oauth.issuer;
    res.json({
      name: 'tableau-mcp-server',
      version: serverVersion,
      transport: ['streamable-http'],
      authentication: ['oauth2'],
      endpoints: {
        mcp: `/${serverName}`,
        oauth_token: '/oauth/token',
        oauth_authorization: '/oauth/authorize',
      },
    });
  });
}
