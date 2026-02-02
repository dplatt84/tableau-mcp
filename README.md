# Tableau MCP Server with OAuth2 & Agentforce Support

A production-ready Tableau MCP (Model Context Protocol) server with OAuth2 client_credentials authentication, optimized for deployment to Heroku and compatible Agentforce MCP Client Beta.

## What This Repository Provides

This is a ready-to-deploy fork of the [official Tableau MCP server](https://github.com/tableau/tableau-mcp) with the following enhancements:

- **OAuth2 Protection**: Secure MCP server with `client_credentials` grant type
- **Heroku Ready**: Pre-configured for instant Heroku deployment
- **Tableau Cloud Compatible**: Fixed hostname validation for Tableau Cloud pods
- **MCP Discovery Endpoint**: Helps clients discover server capabilities
- **Agentforce Optimized**: Tool descriptions optimized for Agentforce MCP Client Beta

## Quick Navigation
- [Deployment Guide](#deployment) ← You are here
- [Quick Checklist](DEPLOYMENT_CHECKLIST.md) ← Quick reference
- [Agentforce Integration](agentforce/README.md) ← Go here next
- [Troubleshooting](#troubleshooting) ← Having issues?

## Architecture

```
┌─────────────────┐         OAuth2 Layer            ┌──────────────────┐
│   MCP Client    │ ──────────────────────────────> │   MCP Server     │
│   Agentforce    │   (client_credentials)          │    (Heroku)      │
│                 │                                 │                  │
└─────────────────┘                                 └────────┬─────────┘
                                                             │
                                                             │ Direct Trust
                                                             │ (Connected Apps)
                                                             ▼
                                                      ┌──────────────────┐
                                                      │  Tableau Cloud   │
                                                      │                  │
                                                      └──────────────────┘
```

**Flow:**
1. MCP Client requests OAuth token with client credentials
2. Server validates and returns encrypted access token (JWE)
3. Client uses token to call MCP tools
4. Server authenticates to Tableau using Direct Trust (Connected Apps)
5. Server returns Tableau data to client

## Prerequisites

Before you begin, ensure you have:

- **Node.js** 22.7.5 or newer
- **Git** for cloning the repository
- **Heroku CLI** for deployment: `brew install heroku` (macOS)
- **OpenSSL** for generating OAuth keys (usually pre-installed)
- **Tableau Cloud** account with admin access
- **Salesforce org with MCP Client Beta**

---

## Step 1: Set Up Tableau Connected App

You need to create a Connected App in Tableau Cloud for Direct Trust authentication.

### 1.1 Navigate to Connected Apps

**Tableau Cloud:**
1. Sign in to your Tableau Cloud site
2. On the left sidebar, click on **Settings**
3. Navigate to **Connected Apps**
4. Click **New Connected App**


### 1.2 Create Connected App

1. **Name**: `Tableau MCP Server` (or any descriptive name)
2. **Access Level**: Select **All Projects**
3. **Domain Allowlist**: Leave empty

### 1.3 Save Credentials

After creating the Connected App, Tableau will display:

- **Client ID**: Copy this (e.g., `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)
- **Secret ID**: Copy this (e.g., `f9e8d7c6-b5a4-3210-9876-543210fedcba`)
- **Secret Value**: Copy this (e.g., `b5a45nhI2q8NM0VUtnlAq2h+7890lp3210RX0R/Ls4w=`)

**Save these three values securely** - you'll need them for environment configuration.

### 1.4 Note Your Tableau Details

You'll also need:
- **Server URL**: Your Tableau Cloud URL (e.g., `https://your_pod.online.tableau.com`)
- **Site Name**: Your site name (visible in URL: `https://your_pod.online.tableau.com/#/site/your_site_name/...`)
- **Your Username**: Your Tableau username/email (e.g., `user@company.com`)

**Important:** The username must match the `JWT_SUB_CLAIM` environment variable.

---

## Step 2: Generate OAuth Credentials

The MCP server uses OAuth2 to protect access. You need to generate two secrets:

### 2.1 Generate OAuth JWE Private Key

The server uses JWE (JSON Web Encryption) to encrypt access tokens. Generate an RSA private key:

#### Generate Key (OpenSSL 3.x)

```bash
# Generate 2048-bit RSA key
openssl genrsa -out oauth-private-key.pem 2048

# Convert to RSA format
openssl rsa -in oauth-private-key.pem -out oauth-private-key-rsa.pem -traditional

# Verify format (should show: -----BEGIN RSA PRIVATE KEY-----)
head -1 oauth-private-key-rsa.pem
```

**Expected output:** `-----BEGIN RSA PRIVATE KEY-----`

**CRITICAL:** The key MUST be in RSA (PKCS#1) format, not PKCS#8. If you see `-----BEGIN PRIVATE KEY-----`, run the conversion command above with the flag traditional.

#### Format for Heroku

Heroku config vars require newlines as `\n` escape sequences:

```bash
# Convert newlines to \n
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' oauth-private-key-rsa.pem
```

**Example output:**
```
-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA2gv0dYKN56gz...\n-----END RSA PRIVATE KEY-----\n
```

**Copy this entire output** - you'll paste it into the `OAUTH_JWE_PRIVATE_KEY` environment variable.


### 2.2 Generate OAuth Client Secret

Generate a secure random secret for OAuth client authentication:

```bash
# Generate 32-byte random secret, base64 encoded
openssl rand -base64 32 | tr -d '=' | tr '+/' '-_'
```

**Example output:** `aBc123XyZ456DeF789GhI012JkL345MnO678PqR`

**Save this secret** - you'll use it in `OAUTH_CLIENT_ID_SECRET_PAIRS`.

**Choose a client ID** - any identifier for your client (e.g., `mcp-client`, or `agentforce-client`)

---

## Step 3: Clone and Prepare Repository

Clone this repository to your local machine:

```bash
# Clone from Git Soma
git clone https://git.soma.salesforce.com/alaviron/tableau-mcp.git
cd tableau-mcp

```

### Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Build the project
npm run build

# Verify build succeeded
ls -la build/index.js
```

**Expected:** You should see `build/index.js` file created.

---

## Step 4: Deploy to Heroku

### 4.1 Create Heroku App


```bash
# Set your app name once
export HEROKU_APP_NAME="your-tableau-mcp-server"

# Log in to Heroku
heroku login

# Create new Heroku app (choose a unique name)
heroku create $HEROKU_APP_NAME

# Or let Heroku generate a name
heroku create
```

**Save the app URL** (e.g., `https://your-tableau-mcp-server.herokuapp.com`) - you'll need it for `OAUTH_ISSUER`.

### 4.2 Configure Environment Variables

Set all required environment variables in Heroku:

#### Tableau Authentication (Direct Trust)

```bash
heroku config:set AUTH=direct-trust --app $HEROKU_APP_NAME
heroku config:set SERVER=https://your_pod.online.tableau.com --app $HEROKU_APP_NAME
heroku config:set SITE_NAME=your_site_name --app $HEROKU_APP_NAME
heroku config:set JWT_SUB_CLAIM=your-username@company.com --app $HEROKU_APP_NAME
heroku config:set CONNECTED_APP_CLIENT_ID=your-client-id --app $HEROKU_APP_NAME
heroku config:set CONNECTED_APP_SECRET_ID=your-secret-id --app $HEROKU_APP_NAME
heroku config:set CONNECTED_APP_SECRET_VALUE=your-secret-value --app $HEROKU_APP_NAME
```

**Replace with your actual values from Step 1.**

#### MCP OAuth Protection

```bash
heroku config:set TRANSPORT=http --app $HEROKU_APP_NAME
heroku config:set OAUTH_ISSUER=https://your-tableau-mcp-server.herokuapp.com --app $HEROKU_APP_NAME
heroku config:set OAUTH_CLIENT_ID_SECRET_PAIRS="your-client-id:YOUR_GENERATED_SECRET" --app $HEROKU_APP_NAME
```

**Replace:**
- `your-client-id` - Your chosen client ID (e.g., `agentforce-client`)
- `YOUR_GENERATED_SECRET` - The secret from Step 2.2

**Set the OAuth JWE Private Key:**

```bash
# Use the formatted key from Step 2.1
heroku config:set OAUTH_JWE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----\n" --app $HEROKU_APP_NAME
```

**FORMAT FOR HEROKU:** Use the output from `awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' oauth-private-key-rsa.pem` - it must be RSA format with `\n` escape sequences.

#### Server Configuration

```bash
heroku config:set TRUST_PROXY_CONFIG=1 --app $HEROKU_APP_NAME
```

### 4.3 Verify Configuration

```bash
# View all configured variables
heroku config --app $HEROKU_APP_NAME

# Verify critical variables
heroku config:get OAUTH_ISSUER --app $HEROKU_APP_NAME
heroku config:get SERVER --app $HEROKU_APP_NAME
```

### 4.4 Deploy to Heroku

```bash
# Add Heroku remote (if not already added)
heroku git:remote -a $HEROKU_APP_NAME

# Deploy
git push heroku main

# Or deploy from a different branch
git push heroku your-branch:main
```

### 4.5 Monitor Deployment

Watch the deployment logs:

```bash
heroku logs --tail --app $HEROKU_APP_NAME
```

**Look for:** `tableau-mcp v1.14.0 streamable HTTP server available at http://0.0.0.0:3927/tableau-mcp`

**If you see errors about "Failed to create private key"**, verify your RSA key format (see Troubleshooting).

---

## Step 5: Test Your Deployment

### 5.1 Test OAuth Token Endpoint

Request an OAuth token using your client credentials:

```bash
curl -X POST https://your-tableau-mcp-server.herokuapp.com/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=your-client-id&client_secret=YOUR_SECRET"
```

**Expected Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJSU0EtT0FFUC0yNTYiLCJlbmMiOiJBMjU2R0NNIn0...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### 5.2 Test MCP Discovery Endpoint

```bash
curl https://your-tableau-mcp-server.herokuapp.com/.well-known/mcp
```

**Expected Response:**
```json
{
  "name": "tableau-mcp-server",
  "version": "1.14.0",
  "transport": ["streamable-http"],
  "authentication": ["oauth2"],
  "endpoints": {
    "mcp": "/tableau-mcp",
    "oauth_token": "/oauth/token",
    "oauth_authorization": "/oauth/authorize"
  }
}
```

### 5.3 Test MCP Tools Endpoint

**Get an access token first:**

```bash
# Get access token
TOKEN=$(curl -s -X POST https://your-tableau-mcp-server.herokuapp.com/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=your-client-id&client_secret=YOUR_SECRET" \
  | jq -r '.access_token')

# Initialize session
RESPONSE=$(curl -s -i -X POST https://your-tableau-mcp-server.herokuapp.com/tableau-mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 0,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-06-18",
      "capabilities": {
        "elicitation": {}
      },
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    }
  }')

# Extract session ID 
SESSION_ID=$(echo "$RESPONSE" | grep -i "^mcp-session-id:" | cut -d':' -f2 | tr -d ' \r')

# Use the session ID for tools/list
curl --max-time 30 -N -X POST https://your-tableau-mcp-server.herokuapp.com/tableau-mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $SESSION_ID" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

**Expected:** List of available Tableau MCP tools.

---

## Step 6: Configure MCP Clients


Restart Claude Desktop after updating the configuration.

### Agentforce MCP Client (Beta)

This repository includes optimizations for Agentforce MCP Client Beta:

1. **Register your MCP server** in Agentforce Registry:
   - Server URL: `https://your-tableau-mcp-server.herokuapp.com`
   - Authentication: OAuth2 Client Credentials
   - Client ID and Secret from Step 2.2

2. **Tool descriptions** are optimized to meet Agentforce's ~1,300 character limit
3. **Single-line formatting** required by current Beta validation
4. **Metadata normalization** handles description formatting automatically

**Note:** These optimizations address temporary Beta limitations. See [`.cursor/howto/Tableau MCP Server x Agentforce MCP Client integration.md`](.cursor/howto/Tableau%20MCP%20Server%20x%20Agentforce%20MCP%20Client%20integration.md) for detailed integration guide.

---

## Deployment Complete: Next Steps

Your MCP server is now running on Heroku. Next, configure Agentforce to use it:

**Continue to [Agentforce Integration Guide](agentforce/README.md)**

That guide will walk you through:
- Salesforce org provisioning
- MCP server registration in Agentforce
- Agent topic configuration (copy-paste from topics/ folder)

---

## Troubleshooting

### Issue 1: "Failed to create private key" Error

**Symptom:** Heroku app crashes with `Fatal error when starting the server: Failed to create private key`

**Cause:** The OAuth JWE private key is not in the correct RSA (PKCS#1) format.

**Solution:**

```bash
# Check your key format
head -1 oauth-private-key.pem

# If you see "-----BEGIN PRIVATE KEY-----" (PKCS#8), convert it:
openssl rsa -in oauth-private-key.pem -out oauth-private-key-rsa.pem -traditional

# Verify RSA format
head -1 oauth-private-key-rsa.pem
# Should show: -----BEGIN RSA PRIVATE KEY-----

# Format for Heroku
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' oauth-private-key-rsa.pem

# Update Heroku config
heroku config:set OAUTH_JWE_PRIVATE_KEY="$(awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' oauth-private-key-rsa.pem)" --app $HEROKU_APP_NAME

# Restart app
heroku restart --app $HEROKU_APP_NAME
```

### Issue 2: Invalid OAuth Token Request

**Symptom:** `400 Bad Request` when requesting OAuth token

**Check:**
1. Client ID and secret match `OAUTH_CLIENT_ID_SECRET_PAIRS`
2. No extra spaces in credentials
3. Format is `client_id:secret` (colon separator)

**Test:**
```bash
# Verify config
heroku config:get OAUTH_CLIENT_ID_SECRET_PAIRS --app $HEROKU_APP_NAME
```

### Issue 3: Tableau Authentication Fails

**Symptom:** OAuth token works but MCP tool calls fail with Tableau auth errors

**Check:**
1. `JWT_SUB_CLAIM` matches your actual Tableau username
2. Connected App credentials are correct
3. User has appropriate permissions in Tableau
4. Server URL and site name are correct

**Debug:**
```bash
heroku logs --tail --app $HEROKU_APP_NAME | grep -i tableau
```

### Issue 4: MCP Client Can't Connect

**Check:**
1. Heroku app is running: `heroku ps --app $HEROKU_APP_NAME`
2. Server URL is correct (no trailing slash): `https://app.herokuapp.com/tableau-mcp`
3. OAuth issuer matches Heroku URL
4. Discovery endpoint works: `curl https://app.herokuapp.com/.well-known/mcp`

### Quick Verification Script

Save as `verify-deployment.sh`:

```bash
#!/bin/bash
APP_NAME="$1"
CLIENT_ID="$2"
CLIENT_SECRET="$3"

if [ -z "$APP_NAME" ] || [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ]; then
  echo "Usage: ./verify-deployment.sh APP_NAME CLIENT_ID CLIENT_SECRET"
  exit 1
fi

URL="https://$APP_NAME.herokuapp.com"

echo "=== Testing Heroku App: $URL ==="
echo ""

echo "1. Testing discovery endpoint..."
curl -s "$URL/.well-known/mcp" | jq '.'
echo ""

echo "2. Testing OAuth token endpoint..."
TOKEN=$(curl -s -X POST "$URL/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=$CLIENT_ID&client_secret=$CLIENT_SECRET" \
  | jq -r '.access_token')

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
  echo "OAuth token obtained"
else
  echo "Failed to obtain OAuth token"
  exit 1
fi

echo ""
echo "3. Testing MCP tools list..."
# Initialize session first
RESPONSE=$(curl -s -i -X POST "$URL/tableau-mcp" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{"elicitation":{}},"clientInfo":{"name":"verify-script","version":"1.0.0"}}}')

SESSION_ID=$(echo "$RESPONSE" | grep -i "^mcp-session-id:" | cut -d':' -f2 | tr -d ' \r')

curl -s --max-time 30 -N -X POST "$URL/tableau-mcp" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $SESSION_ID" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  | jq '.result.tools | length'

echo ""
echo "=== All tests completed ==="
```

Run with:
```bash
chmod +x verify-deployment.sh
./verify-deployment.sh $HEROKU_APP_NAME your-client-id YOUR_SECRET
```

---

## What's Different from Upstream

This repository includes the following enhancements over the [official Tableau MCP server](https://github.com/tableau/tableau-mcp):

1. **OAuth2 Client Credentials Flow** - Secure MCP server access
2. **Tableau Cloud Hostname Validation Fix** - Allows different pod hostnames
3. **MCP Discovery Endpoint** - Helps clients discover server capabilities
4. **`/mcp` Route Handlers** - Compatibility with clients that append `/mcp`
5. **Agentforce Optimizations** - Tool descriptions optimized for Beta constraints
6. **Heroku Configuration** - Pre-configured `Procfile` and `app.json`

**Code changes:**
- [`src/server/oauth/callback.ts`](src/server/oauth/callback.ts) - Flexible Tableau Cloud validation
- [`src/server/oauth/.well-known/mcp-discovery.ts`](src/server/oauth/.well-known/mcp-discovery.ts) - Discovery endpoint
- [`src/server/express.ts`](src/server/express.ts) - `/mcp` route handlers

---

## Additional Resources

### Documentation

- [Official Tableau MCP Documentation](https://tableau.github.io/tableau-mcp/)
- [MCP Specification](https://modelcontextprotocol.io/)
- [OAuth 2.0 Client Credentials](https://oauth.net/2/grant-types/client-credentials/)
- [Heroku Node.js Support](https://devcenter.heroku.com/articles/nodejs-support)

---

## Example Prompts

Once configured, try these prompts with your MCP client:

### Content Discovery

```
Find me the most viewed workbook within the last year.
```

### Data Querying

```
For the Superstore Datasource, what are the top 5 states with the most sales in 2025?
```

### Advanced Analysis

```
Do an RFM analysis on the Superstore datasource. Which customers need re-engagement?
```

### View Access

```
Show me an image of the "Performance" view from the "Regional Sales" workbook.
```

---

## Support

For issues or questions:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review Heroku logs: `heroku logs --tail --app $HEROKU_APP_NAME`
3. Verify environment variables: `heroku config --app $HEROKU_APP_NAME`
4. Test endpoints manually using curl commands above

---

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE.txt](LICENSE.txt) file for details.

---

## Acknowledgments

- Based on the official [Tableau MCP Server](https://github.com/tableau/tableau-mcp)
- OAuth2 implementation inspired by [Xavier Lengellé's MCP for Agentforce guide](https://docs.google.com/document/d/1liCQNo_b4HKm-rsK4EjTWBxlUJFjbP-JTAhUzCNJBhk/edit)
- Developed and tested by the Tableau QBranch team at Salesforce
