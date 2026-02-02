# Tableau MCP Server - Agentforce Integration Guide

Complete guide for integrating the OAuth2-protected Tableau MCP server with Agentforce MCP Client Beta.

## Overview

This guide walks you through the complete setup process for using the Tableau MCP server with Agentforce, including:

1. Salesforce org provisioning and permissions
2. MCP server registration in Agentforce Registry
3. Agent topic configuration with production-tested instructions
4. Beta limitations and workarounds

**Prerequisite:** You must first deploy the MCP server to Heroku following the [main README](../README.md).

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1: Salesforce Org Setup](#step-1-salesforce-org-setup)
3. [Step 2: Register MCP Server](#step-2-register-mcp-server)
4. [Step 3: Configure Agent Topics](#step-3-configure-agent-topics)
5. [Testing](#testing)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:

- **Deployed MCP server to Heroku** (see [main README](../README.md))
- **Heroku app URL** (e.g., `https://your-app.herokuapp.com`)
- **OAuth client credentials** from deployment
- **Salesforce CLI** installed: `npm install -g @salesforce/cli`
- **Access to Salesforce org provisioning** (OrgFarm)

---

## Step 1: Salesforce Org Setup

### 1.1 Provision Salesforce Org

1. Go to [OrgFarm](https://orgfarm.salesforce.com/farms)
2. Provision one org on **SDB3** from template:
   - **Template:** `Agentforce - AIPlatform:Test1 DC:Test002`
3. Save the org credentials

### 1.2 Enable Required Permissions

Enable the following org permissions in **[BlackTab Elevator](https://btpermissionelevatoridp.my.salesforce.com/)**:

- `ApiCatalogMcpPilot`
- `AgentforceMcpSupportPilot`
- `ModelContextProtocolSupport`
- `MCPService`

### 1.3 Create Employee Agent

1. In your Salesforce org, create a new **Employee Agent** in Agent Builder
2. Name it (e.g., "Tableau MCP")
3. Save the agent

### 1.4 Update Agent Planner Type

The agent needs to use the concurrent multi-agent orchestration planner for best results with topics.

**Authorize your org:**
```bash
# For SDB orgs, get your org domain URL in Setup, Company Settings, My Domain
# The domain will likely look like https://orgfarm-123456789.test1.my.pc-rnd.salesforce.com
sf org login web --alias YOUR_ORG_ALIAS --instance-url YOUR_ORG_DOMAIN_URL
```

**Query for your agent's planner:**

```bash
sf data query -q "SELECT Id, PlannerType, DeveloperName FROM GenAiPlannerDefinition" --target-org YOUR_ORG_ALIAS
```

**Example output:**
```
┌────────────────────┬──────────────────┬───────────────────────────┐
│ ID                 │ PLANNERTYPE      │ DEVELOPERNAME             │
├────────────────────┼──────────────────┼───────────────────────────┤
│ 16jSB000000YaYvYAK │ AiCopilot__ReAct │ Agentforce_Employee_Agent │
└────────────────────┴──────────────────┴───────────────────────────┘
```

**Update the planner type:**

```bash
sf data update record \
  --sobject GenAiPlannerDefinition \
  --record-id YOUR_RECORD_ID \
  --values "PlannerType=Atlas__ConcurrentMultiAgentOrchestration" \
  --target-org YOUR_ORG_ALIAS
```

**Expected output:** `Successfully updated record: YOUR_RECORD_ID`

---

## Step 2: Register MCP Server

### 2.1 Navigate to Agentforce Registry

1. In your Salesforce org, go to **Setup**
2. Search for "Agentforce" in Quick Find
3. Navigate to **Agentforce Registry**

### 2.2 Register Your MCP Server

Click **New**, then **Register MCP Server** and configure:

**Server Details:**
- **Name:** `Tableau MCP Server`
- **Description:** `Tableau Cloud MCP server`
- **Server URL:** `https://your-app.herokuapp.com/tableau-mcp`

**Authentication:**
- **Type:** OAuth2 Client Credentials
- **Token URL:** `https://your-app.herokuapp.com/oauth/token`
- **Scope:** Leave blank
- **Client ID:** Your OAuth client ID from Heroku deployment
- **Client Secret:** Your OAuth client secret from Heroku deployment

### 2.3 Verify Server Registration

After registering, the system will:
1. Connect to your server
2. Discover available tools
3. Import tool metadata into External Service Registration

**Expected result:** List of Tableau MCP tools discovered.

### 2.4 Fix Annotations Mismatch (Beta Workaround)

To bypass `annotations_mismatch` errors in Agentforce Beta, set all tool `annotations` to `null` in the External Service Registration metadata.

**Create a new SFDX project** (if you haven't already)
```bash
sf project generate --name TableauMCP

# Navigate into the project
cd TableauMCP
```

**List External Service Registrations and retrieve your MCP server's metadata**
```bash
# List all registrations to find your DeveloperName
sf data query --query "SELECT Id, DeveloperName, MasterLabel FROM ExternalServiceRegistration" --use-tooling-api --target-org YOUR_ORG_ALIAS

# Retrieve the External Service Registration metadata (replace YOUR_DEVELOPER_NAME with actual name)
sf project retrieve start --metadata ExternalServiceRegistration:YOUR_DEVELOPER_NAME --target-org YOUR_ORG_ALIAS
```

**Set annotations to null** (required for Beta)
```bash
# Replace annotations objects with null (handles HTML-encoded JSON in XML)
python3 -c "
import html, json, re
from pathlib import Path

xml_path = Path('force-app/main/default/externalServiceRegistrations/YOUR_DEVELOPER_NAME.externalServiceRegistration-meta.xml')
content = xml_path.read_text()

schema_match = re.search(r'<schema>(.*?)</schema>', content, re.DOTALL)
if schema_match:
    decoded = html.unescape(schema_match.group(1))
    schema = json.loads(decoded)
    
    for tool in schema.get('tools', []):
        if 'annotations' in tool:
            tool['annotations'] = None
    
    new_schema = json.dumps(schema, separators=(',', ':'))
    encoded = html.escape(new_schema, quote=True)
    new_content = content.replace(schema_match.group(0), f'<schema>{encoded}</schema>')
    xml_path.write_text(new_content)
    print('✓ Updated annotations to null')
"
```

> **Note:** This sets `annotations` to `null` (not removed) which is required by Salesforce's schema validation.

**Deploy the modified metadata back to Salesforce**
```bash
sf project deploy start --metadata ExternalServiceRegistration:YOUR_DEVELOPER_NAME --target-org YOUR_ORG_ALIAS
``` 
---

## Step 3: Configure Agent Topics

### 3.1 Understanding "Compensated Instructions"

Tool descriptions are limited to ~1,300 characters. This truncates the rich context that MCP tools provide.

We use compensated instructions, detailed topic-level instructions that provide the context lost from tool description truncation, including:
- Proper tool sequencing patterns
- Field validation rules
- Error prevention strategies
- Multi-step workflows

### 3.2 Quick Start: 3 Essential Topics

For a production-ready setup, configure these 3 core topics:

#### Topic 1: Content Discovery & Search

**When to use:** See [`classification.md`](topics/01_content_discovery/classification.md) for trigger patterns

**Tools to add:** See [`actions.md`](topics/01_content_discovery/actions.md) for complete list

**Instructions:** Copy-paste entire contents of [`instructions.md`](topics/01_content_discovery/instructions.md) into Agent Builder

**Example use cases:**
- "What workbooks are available in the Finance project?"
- "Find all dashboards related to sales"
- "Show me recent content"

---

#### Topic 2: Data Source Exploration & Querying

**When to use:** See [`classification.md`](topics/02_data_exploration/classification.md) for trigger patterns

**Tools to add:** See [`actions.md`](topics/02_data_exploration/actions.md) for complete list

**Instructions:** Copy-paste entire contents of [`instructions.md`](topics/02_data_exploration/instructions.md) into Agent Builder

**Example use cases:**
- "What are total sales by region for the Superstore datasource?"
- "Show me top 10 customers by revenue"
- "Do an RFM analysis. Which customers need re-engagement?"

---

#### Topic 3: Workbook & Dashboard Viewing

**When to use:** See [`classification.md`](topics/03_workbook_dashboards/classification.md) for trigger patterns

**Tools to add:** See [`actions.md`](topics/03_workbook_dashboards/actions.md) for complete list

**Instructions:** Copy-paste entire contents of [`instructions.md`](topics/03_workbook_dashboards/instructions.md) into Agent Builder

**Example use cases:**
- "Show me the Performance dashboard"
- "Export data from the Sales view"
- "Get a screenshot of the Regional Analysis dashboard"

---

### 3.3 How to Configure Topics

For each topic:

1. **Create Topic** in Agent Builder
   - Click **Add Topic**
   - Name it (e.g., "Content Discovery")
   - Paste the topic's `classification.md` and `scope.md` 

2. **Add Instructions**
   - Open the topic's `instructions.md` file
   - Copy the **entire contents**
   - Paste into the Agent Builder **Instructions** field
   - Save

3. **Add Tools**
   - Open the topic's `actions.md` file
   - Add each listed tool to the topic in Agent Builder
   - Ensure all tools are included before testing

4. **Test**
   - Use the example use cases listed above
   - Verify the agent follows the workflow correctly

---

## Testing

### Test with Example Prompts

#### Content Discovery
```
What content is in the Samples project?
```

**Expected:** Agent calls list tools and shows workbooks, views, and datasources.

#### Data Exploration
```
What drives down profitability? Use the Superstore datasource.
```

**Expected:** Agent follows metadata-first workflow:
1. Calls `list-datasources` to find Superstore
2. Calls `get-datasource-metadata` to get field definitions
3. Calls `query-datasource` with correct field names and aggregations
4. Provides analysis of results

#### Dashboard Viewing
```
What does Performance view from the Superstore workbook tell us? Show me the data.
```

**Expected:** Agent:
1. Finds the workbook
2. Gets view data
3. Summarizes insights from the data

### Advanced Testing
```
Do an RFM analysis. Which customers need re-engagement?
```

**Expected:** Agent performs recency-frequency-monetary analysis using multiple queries with proper aggregations.

---

## Troubleshooting

### Tools Showing as invalidatedTools

**Check:**
- Annotations set to null in External Service Registration
- Tool descriptions <1,300 characters
- No special characters or newlines in descriptions

### Agent Not Following Metadata-First Workflow

**Solution:** Ensure Data Exploration Topic instructions are properly configured.

**Check:**
- `get-datasource-metadata` tool is added to agent
- Data Exploration Topic instructions emphasize ALWAYS calling metadata first
- Agent planner type is `Atlas__ConcurrentMultiAgentOrchestration`

### OAuth Authentication Failures

**Solution:** Verify OAuth credentials.

**Check:**
- Token URL is correct: `https://your-app.herokuapp.com/oauth/token`
- Client ID and secret match Heroku config
- MCP server is running on Heroku
- Test token endpoint manually:
  ```bash
  curl -X POST https://your-app.herokuapp.com/oauth/token \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=client_credentials&client_id=YOUR_ID&client_secret=YOUR_SECRET"
  ```

### Query Failures

**Common causes:**
1. **Metadata not called first** - Verify Data Exploration Topic instructions
2. **Incorrect field names** - Agent using wrong case or spelling
3. **Wrong aggregation** - Dimensions vs measures confused

**Solution:** Review Data Exploration Topic instructions, emphasize field validation.

### Tools Not Discovered

**Check:**
- MCP server URL is correct
- OAuth credentials valid
- Discovery endpoint returns valid response:
  ```bash
  curl https://your-app.herokuapp.com/.well-known/mcp
  ```

---

## Additional Resources

### Integration Documentation
- [Main README](../README.md) - Heroku deployment guide
- [Official Tableau MCP Documentation](https://tableau.github.io/tableau-mcp/)

### Support
- [Tableau MCP GitHub](https://github.com/tableau/tableau-mcp)
- [Salesforce Internal Slack](https://salesforce.enterprise.slack.com/archives/C08QYBH8AE5) - #tab-dev-mcp-project

---

## Acknowledgments

This integration architecture is based on:
- SDB3 testing with Agentforce MCP Client Beta
- Xavier Lengellé's [MCP for Agentforce guide](https://docs.google.com/document/d/1liCQNo_b4HKm-rsK4EjTWBxlUJFjbP-JTAhUzCNJBhk/edit)
