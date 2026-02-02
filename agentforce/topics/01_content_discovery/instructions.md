## Tool Selection Guide

Choose the right tool based on user intent:

| User Intent | Best Tool | Why |
|-------------|-----------|-----|
| "Find content about X" (broad search) | `search-content` | Searches across all content types |
| "List workbooks" or "Find workbooks" | `list-workbooks` | Specific to workbooks |
| "List views/dashboards" | `list-views` | Specific to views |
| "List datasources" | `list-datasources` | Specific to datasources |
| "Most popular/viewed content" | `search-content` with orderBy | Supports popularity sorting |
| "What's downstream from this table?" | `search-content` with filters | Supports downstream counts |
| Mixed content types | `search-content` | Best for cross-type discovery |

**General Rule**: Use `search-content` for broad discovery or when content type is unclear. Use specific list tools when user explicitly mentions workbooks, views, or datasources.

---

## Tool 1: search-content

### Purpose
Searches across all supported content types for objects relevant to search terms and filters. Most powerful tool for general discovery.

### When to Use
- User wants to search broadly across multiple content types
- User asks "find content about X"
- User wants to sort by popularity or usage metrics
- User needs to find downstream workbook dependencies
- Content type is not specified or multiple types are relevant

### Content Types Searchable
- `datasource` - Published datasources
- `workbook` - Workbooks
- `view` - Views/dashboards within workbooks
- `project` - Projects
- `lens` - Tableau Lenses (Ask Data)
- `virtualconnection` - Virtual connections
- `collection` - Collections
- `flow` - Tableau Prep flows
- `datarole` - Data roles
- `table` - Database tables
- `database` - Databases

### Parameters

**`terms`** (optional): Search query string
- If omitted, searches everything within filter bounds
- Use keywords relevant to content names, descriptions, tags

**`filter`** (optional): Filter object with:
- `contentTypes` (array): Limit to specific content types
- `ownerIds` (array of integers): Filter by owner IDs
- `modifiedTime`: Range or array of ISO 8601 date-times
  - Range: `{ startDate: "2023-01-01T00:00:00Z", endDate: "2023-12-31T23:59:59Z" }`
  - Array: `["2023-01-01T00:00:00Z", "2023-06-01T00:00:00Z"]`

**`limit`** (optional): Number of results (default: 100, max: 2000)

**`orderBy`** (optional): Array of sort objects
- `method`: Sorting method
  - `hitsTotal` - Total views (all time)
  - `hitsSmallSpanTotal` - Views last month
  - `hitsMediumSpanTotal` - Views last 3 months
  - `hitsLargeSpanTotal` - Views last year
  - `downstreamWorkbookCount` - Number of downstream workbooks (requires contentTypes filter)
- `sortDirection`: `asc` or `desc` (default: `asc`)
- First element is primary sort; subsequent are tiebreakers
- If omitted, sorts by relevance score (descending)

### Examples

**Broad search across all content**:
```json
{
  "terms": "sales revenue"
}
```

**Search for workbooks and views only**:
```json
{
  "terms": "quarterly report",
  "filter": {
    "contentTypes": ["workbook", "view"]
  }
}
```

**Find most popular content**:
```json
{
  "terms": "dashboard",
  "orderBy": [
    {
      "method": "hitsTotal",
      "sortDirection": "desc"
    }
  ],
  "limit": 20
}
```

**Find recent datasources**:
```json
{
  "filter": {
    "contentTypes": ["datasource"],
    "modifiedTime": {
      "startDate": "2024-01-01T00:00:00Z"
    }
  },
  "orderBy": [
    {
      "method": "hitsSmallSpanTotal",
      "sortDirection": "desc"
    }
  ]
}
```

**Find tables with most downstream usage**:
```json
{
  "terms": "customer",
  "filter": {
    "contentTypes": ["table", "database"]
  },
  "orderBy": [
    {
      "method": "downstreamWorkbookCount",
      "sortDirection": "desc"
    }
  ]
}
```

### What It Returns

Array of content items with common fields:
- `type` - Content type
- `title` - Item title/name
- `luid` - Unique identifier (use for subsequent tool calls)
- `ownerId`, `ownerName` - Owner information
- `projectId`, `projectName` - Project location
- `containerName` - Container/project name
- `modifiedTime` - Last modification timestamp
- `totalViewCount` - Total views (`hitsTotal`)
- `viewCountLastMonth` - Views in last month
- `favoritesTotal` - Number of favorites

**Type-specific fields**:
- Datasources: `isConnectable`, `isCertified`, `hasExtracts`, `connectedWorkbooksCount`, etc.
- Workbooks: `workbookDescription`, `hasExtracts`, `extractCreationPending`
- Views: `sheetType`, `caption`, `parentWorkbookName`, `locationName`
- Tables/Databases: `downstreamWorkbookCount`

### Best Practices

1. **Use specific content types** when possible to narrow results
2. **Sort by popularity** to find most-used content
3. **Use date filters** to find recent or outdated content
4. **Extract LUIDs** for use with other tools (get-workbook, get-datasource-metadata, etc.)
5. **Present top results** to user, offer to show more if needed

---

## Tool 2: list-workbooks

### Purpose
Retrieves workbooks on a Tableau site with metadata. Use when user specifically asks about workbooks.

### When to Use
- User explicitly asks for workbooks: "list workbooks", "show me workbooks"
- User wants to browse workbooks in a project
- User needs workbook metadata (views, descriptions, tags)
- Following up after search-content identifies workbooks

### Parameters
- `filter` (optional): Field:operator:value expression(s)
- `pageSize` (optional): Results per page
- `limit` (optional): Maximum results to return

### Filter Fields Available
`createdAt`, `contentUrl`, `displayTabs`, `favoritesTotal`, `hasAlerts`, `hasExtracts`, `name`, `ownerDomain`, `ownerEmail`, `ownerName`, `projectName`, `sheetCount`, `size`, `subscriptionTotal`, `tags`, `updatedAt`

### Operators
`eq` (equals), `gt`, `gte`, `lt`, `lte`, `in`

### Filter Syntax
- Format: `field:operator:value`
- Multiple filters: comma-separated
- Case-sensitive
- Date format: ISO 8601

### Examples

**List all workbooks**:
```json
{
  "filter": ""
}
```

**Workbooks in Finance project**:
```json
{
  "filter": "projectName:eq:Finance"
}
```

**Workbooks with extracts**:
```json
{
  "filter": "hasExtracts:eq:true"
}
```

**Recent workbooks with high favorites**:
```json
{
  "filter": "createdAt:gt:2024-01-01T00:00:00Z,favoritesTotal:gt:10"
}
```

### What It Returns

Array of workbook objects:
- `id` (LUID) - Workbook identifier
- `name` - Workbook name
- `description` - Workbook description
- `contentUrl` - URL path
- `project` - Project information
- `showTabs` - Whether tabs are displayed
- `defaultViewId` - Default view LUID
- `tags` - Array of tags
- `views` - Array of view objects (may be populated)
- `createdAt`, `updatedAt` - Timestamps

**Use the workbook LUID** with `get-workbook` to retrieve full details including views.

---

## Tool 3: list-views

### Purpose
Retrieves views (sheets/dashboards) across a Tableau site. Use when user asks about views or dashboards.

### When to Use
- User explicitly asks for views/dashboards: "list views", "show me dashboards"
- User wants to find specific sheets or dashboards
- User needs view metadata including usage statistics
- Following up after search-content identifies views

### Parameters
- `filter` (optional): Field:operator:value expression(s)
- `pageSize` (optional): Results per page
- `limit` (optional): Maximum results to return

### Filter Fields Available
`caption`, `contentUrl`, `createdAt`, `favoritesTotal`, `fields`, `hitsTotal`, `name`, `ownerDomain`, `ownerEmail`, `ownerName`, `projectName`, `sheetNumber`, `sheetType`, `tags`, `title`, `updatedAt`, `viewUrlname`, `workbookDescription`, `workbookName`

### Operators
`eq` (equals), `gt`, `gte`, `lt`, `lte`, `in`

### Filter Syntax
Same as list-workbooks (field:operator:value, comma-separated, case-sensitive)

### Examples

**List all views**:
```json
{
  "filter": ""
}
```

**Views in specific workbook**:
```json
{
  "filter": "workbookName:eq:Superstore"
}
```

**Popular dashboards**:
```json
{
  "filter": "sheetType:eq:dashboard,hitsTotal:gt:1000"
}
```

**Views by owner in project**:
```json
{
  "filter": "ownerName:eq:Sarah,projectName:eq:Marketing"
}
```

### What It Returns

Array of view objects:
- `id` (LUID) - View identifier
- `name` - View name
- `createdAt`, `updatedAt` - Timestamps
- `workbook` - Reference to parent workbook (with `id`)
- `project` - Project reference
- `owner` - Owner reference
- `tags` - Array of tags
- `usage.totalViewCount` - Total views (usage statistics included)

**Use the view LUID** with `get-view-image` or `get-view-data` to extract view content.

---

## Tool 4: list-datasources

### Purpose
Retrieves published datasources from a Tableau site. Use when user asks about datasources.

**Note**: This tool is also used in Topic 2 (Data Exploration). Here we focus on discovery aspects.

### When to Use (Discovery Context)
- User explicitly asks for datasources: "list datasources", "what datasources exist"
- User wants to browse available data sources
- User needs to find datasources by project, owner, or certification
- Following up after search-content identifies datasources

### Parameters
- `filter` (optional): Field:operator:value expression(s)
- `pageSize` (optional): Results per page
- `limit` (optional): Maximum results to return

### Filter Fields Available
`authenticationType`, `connectionTo`, `connectionType`, `contentUrl`, `createdAt`, `databaseName`, `description`, `favoritesTotal`, `hasAlert`, `hasEmbeddedPassword`, `hasExtracts`, `isCertified`, `isConnectable`, `isPublished`, `name`, `ownerDomain`, `ownerEmail`, `ownerName`, `projectName`, `serverName`, `size`, `tableName`, `tags`, `type`, `updatedAt`

### Examples

**List all datasources**:
```json
{
  "filter": ""
}
```

**Certified datasources only**:
```json
{
  "filter": "isCertified:eq:true"
}
```

**Datasources in project**:
```json
{
  "filter": "projectName:eq:Finance"
}
```

**Connectable datasources with extracts**:
```json
{
  "filter": "isConnectable:eq:true,hasExtracts:eq:true"
}
```

### What It Returns

Array of datasource objects:
- `id` (LUID) - Datasource identifier
- `name` - Datasource name
- `projectName` - Project location
- `ownerName` - Owner
- `description` - Datasource description
- `isCertified` - Certification status
- `isConnectable` - Whether queryable
- `hasExtracts` - Extract status
- `createdAt`, `updatedAt` - Timestamps

**For discovery**: Present datasource information to user
**For querying**: Pass LUID to Topic 2 (Data Exploration) workflow

---

## Cross-Tool Workflows

### Workflow 1: Broad Search → Specific Action

**User**: "Find content about quarterly sales"

**Steps**:
1. Call `search-content` with terms: "quarterly sales"
2. Review results (may include workbooks, views, datasources)
3. Present results to user with content types
4. Based on user selection:
   - Workbook → Use Topic 3 (`get-workbook`)
   - View → Use Topic 3 (`get-view-image`)
   - Datasource → Use Topic 2 (`get-datasource-metadata` → query)

---

### Workflow 2: Project Exploration

**User**: "What content exists in the Finance project?"

**Steps**:
1. Call `list-workbooks` with filter: `projectName:eq:Finance`
2. Call `list-views` with filter: `projectName:eq:Finance`
3. Call `list-datasources` with filter: `projectName:eq:Finance`
4. Present comprehensive project overview:
   - X workbooks
   - Y views/dashboards
   - Z datasources
5. Offer to show details for any specific content

---

### Workflow 3: Popular Content Discovery

**User**: "Show me the most viewed dashboards"

**Steps**:
1. Call `search-content`:
   - Filter: `contentTypes: ["view"]`
   - OrderBy: `hitsTotal` desc
   - Limit: 10
2. Present top 10 views with view counts
3. Offer to show images or data for specific views

---

### Workflow 4: Owner-Based Discovery

**User**: "What has Sarah created recently?"

**Steps**:
1. First need to find Sarah's owner ID:
   - Call `list-workbooks` with filter: `ownerName:eq:Sarah` (get 1 result)
   - Extract `ownerId` from result
2. Call `search-content`:
   - Filter: `ownerIds: [<Sarah's ID>]`, `modifiedTime: { startDate: "2024-01-01T00:00:00Z" }`
   - OrderBy: `modifiedTime` desc
3. Present recent content by Sarah across all types

---

## Filtering Best Practices

### 1. Start Broad, Narrow Down
- Begin with no filter or minimal filters
- Present results to user
- Refine based on user feedback

### 2. Use Flexible Matching
- Don't assume exact names (case-sensitive!)
- Use broader filters (project, owner) when unsure
- Present options when multiple matches

### 3. Combine Filters Strategically
- Combine complementary filters: `projectName:eq:Finance,isCertified:eq:true`
- Use date ranges for recent content: `createdAt:gt:2024-01-01T00:00:00Z`
- Filter by tags for categorized content: `tags:eq:sales`

### 4. Handle No Results Gracefully
- Fallback to broader filters
- Try no filter to show all available content
- Present what's available and ask user to clarify

---

## Presentation Guidelines

When presenting discovery results:

### For Workbooks
Show:
- Name
- Project
- Description (if available)
- Number of views/sheets
- Created/Updated dates
- Owner
- Tags

### For Views
Show:
- Name
- Parent workbook
- Project
- View count (popularity)
- Sheet type (dashboard, sheet)
- Owner

### For Datasources
Show:
- Name
- Project
- Certified status
- Connectable status (important for querying)
- Description
- Owner

### For Search Results
Show:
- Content type
- Name/Title
- Project/Location
- Popularity metrics (if sorted by usage)
- Relevance (if search by terms)

**Always offer follow-up actions**: "Would you like to see [workbook details / view image / datasource fields]?"

---

## Error Handling

**No results found**:
1. Try broader filters
2. Try no filter (list all)
3. Inform user and show what's available
4. Suggest alternative search terms or filters

**Access denied**:
- Inform user they don't have permission to view certain content
- Show content they can access
- Suggest contacting administrator for access

**Invalid filter syntax**:
- Review filter format
- Ensure field names are correct
- Check operators are valid
- Ensure values don't contain special characters

**Too many results**:
- Use limit to show top N results
- Suggest more specific filters to user
- Offer pagination if needed

---

## Key Principles

1. **Right tool for the job**: Use search-content for broad discovery, specific list tools when content type is known
2. **Start broad**: Use minimal or no filters initially, refine based on results
3. **Extract IDs**: Always extract LUIDs for use with subsequent tools
4. **Present clearly**: Show relevant metadata to help user identify content
5. **Offer actions**: Suggest what user can do next with discovered content
6. **Handle empty results**: Always fallback to showing what's available
7. **Cross-reference**: Use discovery results to transition to other topics (exploration, viewing, analytics)
