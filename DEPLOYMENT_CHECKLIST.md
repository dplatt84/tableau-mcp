# Quick Start - Deployment Checklist

Use this checklist to deploy your Tableau MCP Server with OAuth2 to Heroku.

## ☑️ Pre-Deployment Checklist

### 1. Tableau Connected App
- [ ] Created Connected App in Tableau Cloud
- [ ] Saved Client ID
- [ ] Saved Secret ID  
- [ ] Saved Secret Value
- [ ] Noted Site URL (e.g., `https://your_pod.online.tableau.com`)
- [ ] Noted Site Name
- [ ] Noted your Tableau username/email

### 2. OAuth Credentials
- [ ] Generated RSA private key: `openssl genrsa -out oauth-private-key.pem 2048`
- [ ] Converted to RSA format: `openssl rsa -in oauth-private-key.pem -out oauth-private-key-rsa.pem -traditional`
- [ ] Verified format shows: `-----BEGIN RSA PRIVATE KEY-----` with `head -1 oauth-private-key-rsa.pem`
- [ ] Formatted for Heroku: `awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' oauth-private-key-rsa.pem`
- [ ] Generated client secret: `openssl rand -base64 32 | tr -d '=' | tr '+/' '-_'`
- [ ] Chose client ID (e.g., `mcp-client`)
- [ ] Added `*.pem` to `.gitignore`

### 3. Repository
- [ ] Cloned repository
- [ ] Installed dependencies: `npm install`
- [ ] Built project: `npm run build`
- [ ] Verified `build/index.js` exists

## ☑️ Deployment Checklist

### 1. Create Heroku App
```bash
export HEROKU_APP_NAME="your-tableau-mcp-server"
heroku login
heroku create $HEROKU_APP_NAME
```

### 2. Set Environment Variables

**Tableau Authentication:**
```bash
heroku config:set AUTH=direct-trust --app $HEROKU_APP_NAME
heroku config:set SERVER=https://your_pod.online.tableau.com --app $HEROKU_APP_NAME
heroku config:set SITE_NAME=your_site_name --app $HEROKU_APP_NAME
heroku config:set JWT_SUB_CLAIM=your-username@company.com --app $HEROKU_APP_NAME
heroku config:set CONNECTED_APP_CLIENT_ID=your-client-id --app $HEROKU_APP_NAME
heroku config:set CONNECTED_APP_SECRET_ID=your-secret-id --app $HEROKU_APP_NAME
heroku config:set CONNECTED_APP_SECRET_VALUE=your-secret-value --app $HEROKU_APP_NAME
```

**MCP OAuth:**
```bash
heroku config:set TRANSPORT=http --app $HEROKU_APP_NAME
heroku config:set OAUTH_ISSUER=https://your-tableau-mcp-server.herokuapp.com --app $HEROKU_APP_NAME
heroku config:set OAUTH_CLIENT_ID_SECRET_PAIRS="your-client-id:YOUR_GENERATED_SECRET" --app $HEROKU_APP_NAME
heroku config:set OAUTH_JWE_PRIVATE_KEY="YOUR_FORMATTED_RSA_KEY_WITH_\n" --app $HEROKU_APP_NAME
```

**Server Config:**
```bash
heroku config:set TRUST_PROXY_CONFIG=1 --app $HEROKU_APP_NAME
```

### 3. Deploy
```bash
heroku git:remote -a $HEROKU_APP_NAME
git push heroku main
```

### 4. Verify
```bash
heroku logs --tail --app $HEROKU_APP_NAME
```

## ☑️ Testing Checklist

### 1. Test OAuth Token
```bash
curl -X POST https://your-tableau-mcp-server.herokuapp.com/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=your-client-id&client_secret=YOUR_SECRET"
```
- [ ] Returns `access_token`
- [ ] Returns `token_type: "Bearer"`
- [ ] Returns `expires_in: 3600`

### 2. Test Discovery
```bash
curl https://your-tableau-mcp-server.herokuapp.com/.well-known/mcp
```
- [ ] Returns server metadata
- [ ] Shows `oauth_token` endpoint
- [ ] Shows `oauth_authorization` endpoint

### 3. Test Tools
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
- [ ] Returns list of Tableau MCP tools

## Resources

- **Full Documentation:** [README.md](README.md)
