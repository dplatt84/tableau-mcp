## Tool Relationships

```
Discovery             Viewing 
     ↓                   ↓
list-workbooks  ──→  get-workbook
                         ↓
                    (views array)
                         ↓
list-views      ──→  view IDs  ──→  get-view-image
                         ↓
                    get-view-data
```

---

## Tool 1: list-workbooks (Discovery)

**See Topic 1 for full details**. In the context of workbook viewing:

### When to Use
- User mentions a workbook name but you need the workbook ID
- User asks "what workbooks exist" before specifying which to view
- Prerequisite to get-workbook

### Quick Usage
```json
{
  "filter": "name:eq:Superstore"  // Or "" for all
}
```

### Result
Extract `id` (workbook LUID) for use with `get-workbook`

---

## Tool 2: get-workbook

### Purpose
Retrieves comprehensive information about a specific workbook, including all views with enhanced usage statistics.

### When to Use
- User asks for workbook details or wants to see what's in a workbook
- User wants to explore views within a workbook
- Following up after list-workbooks identifies a workbook
- User asks "what views are in [workbook]?"
- Prerequisite to get view IDs for viewing or exporting

### Parameters
- `workbookId` (required): Workbook LUID from list-workbooks

### What It Returns

Comprehensive workbook object:
- `id` - Workbook LUID
- `name` - Workbook name
- `description` - Workbook description
- `contentUrl` - URL path
- `webpageUrl` - Full web URL
- `showTabs` - Whether tabs are displayed
- `project` - Project information (id, name)
- `owner` - Owner information (id, name)
- `tags` - Array of tags
- `createdAt`, `updatedAt` - Timestamps
- **`views`** - Array of view objects with:
  - `id` - View LUID (use with get-view-image or get-view-data)
  - `name` - View name
  - `contentUrl` - View URL path
  - `createdAt`, `updatedAt` - Timestamps
  - `viewUrlName` - URL-friendly name
  - `usage.totalViewCount` - View count (usage statistics)

**Special Feature**: Automatically enriches views with usage statistics (total view counts) that aren't in the base API response.

### Workflow Pattern

1. Find workbook (if LUID not known):
   ```
   list-workbooks → extract workbook ID
   ```

2. Get workbook details:
   ```
   get-workbook(workbookId)
   ```

3. Review views array:
   ```
   Extract view IDs and names
   ```

4. For each view user wants to see:
   ```
   get-view-image(viewId) OR get-view-data(viewId)
   ```

### Example Usage

**User**: "What views are in the Superstore workbook?"

**Steps**:
1. Call `list-workbooks` with filter: `name:eq:Superstore`
2. Extract workbook ID
3. Call `get-workbook` with workbook ID
4. Present views:
   ```
   The Superstore workbook contains 5 views:
   1. Overview (12,453 views)
   2. Sales Performance (8,921 views)
   3. Regional Analysis (6,334 views)
   4. Product Details (4,112 views)
   5. Profit Trends (3,087 views)
   
   Would you like to see any of these dashboards?
   ```

### Best Practices

1. **Always present view list** to user before fetching images
2. **Show usage statistics** to highlight popular views
3. **Extract view IDs** for subsequent calls
4. **Offer to show multiple views** if user is interested
5. **Include workbook context** (project, owner, description) in presentation

---

## Tool 3: list-views (Discovery)

**See Topic 1 for full details**. In the context of viewing:

### When to Use
- User asks for views across workbooks or projects
- User wants to find a specific view without knowing its workbook
- Alternative to get-workbook when searching broadly for views

### Quick Usage
```json
{
  "filter": "workbookName:eq:Superstore,name:eq:Overview"
}
```

### Result
Extract `id` (view LUID) for use with `get-view-image` or `get-view-data`

---

## Tool 4: get-view-image

### Purpose
Retrieves a high-resolution rendered image (screenshot) of a view or dashboard. Use this to show users what dashboards look like.

### When to Use
- User asks to "see", "show", "display", "view" a dashboard or view
- User wants a screenshot or image of a visualization
- User wants to preview a view visually
- Presenting dashboard content to users

### Parameters
- `viewId` (required): View LUID from get-workbook or list-views
- `width` (optional): Image width in pixels (default: 800)
- `height` (optional): Image height in pixels (default: 800)

### Image Specifications
- Format: PNG
- Resolution: High quality (automatically requested)
- Base64 encoded
- Configurable dimensions

### Dimension Guidelines

**Default (800x800)**:
- Good for: Preview thumbnails, chat displays, quick views

**Medium (1200x800)**:
- Good for: Standard dashboards, balanced view

**Large (1920x1080)**:
- Good for: High-resolution displays, detailed dashboards, presentations

**Custom**:
- Match dashboard aspect ratio for best results
- Typical dashboard: 1024x768, 1280x720, 1920x1080

### Workflow Pattern

1. Find view ID:
   ```
   get-workbook → extract view ID
   OR
   list-views → extract view ID
   ```

2. Get view image:
   ```
   get-view-image(viewId, width, height)
   ```

3. Present image to user with context

### Examples

**Standard dashboard image**:
```json
{
  "viewId": "abc-123-def-456",
  "width": 1200,
  "height": 800
}
```

**High-resolution presentation**:
```json
{
  "viewId": "abc-123-def-456",
  "width": 1920,
  "height": 1080
}
```

**Mobile-friendly preview**:
```json
{
  "viewId": "abc-123-def-456",
  "width": 600,
  "height": 800
}
```

### Best Practices

1. **Choose appropriate dimensions**:
   - Use larger sizes for detailed dashboards
   - Use smaller sizes for quick previews
   - Consider dashboard aspect ratio

2. **Provide context**:
   - Include view name
   - Include workbook name
   - Mention when image was captured

3. **Handle multiple views**:
   - Fetch images sequentially if showing multiple dashboards
   - Present one at a time with clear labels

4. **Set user expectations**:
   - Mention it's a snapshot (not interactive)
   - Note current date/time context if dashboard is time-sensitive

### Error Handling

**View not found**:
- Verify view ID from get-workbook or list-views
- Check view still exists and is published

**Access denied**:
- User doesn't have permission to view this content
- Verify workbook/project access
- Suggest contacting administrator

**View unavailable**:
- View may be in workbook that's being edited
- Wait and retry
- Check if workbook is published

---

## Tool 5: get-view-data

### Purpose
Exports the underlying data from a view as CSV format. Use this to give users the raw data behind a visualization.

### When to Use
- User asks to "export", "download", "get data from" a view
- User wants the raw data behind a dashboard
- User needs CSV format data
- User wants to analyze view data externally

### Parameters
- `viewId` (required): View LUID from get-workbook or list-views

### What It Returns
CSV string containing:
- Column headers (field names)
- Data rows
- All data visible in the view (respects view filters)

### Workflow Pattern

1. Find view ID:
   ```
   get-workbook → extract view ID
   OR
   list-views → extract view ID
   ```

2. Export view data:
   ```
   get-view-data(viewId)
   ```

3. Present data to user (formatted or as download)

### Example Usage

**User**: "Export the data from the Sales Performance view in Superstore"

**Steps**:
1. Find Superstore workbook:
   ```
   list-workbooks(filter: "name:eq:Superstore")
   ```

2. Get workbook with views:
   ```
   get-workbook(workbookId)
   ```

3. Find "Sales Performance" view in views array, extract view ID

4. Export data:
   ```
   get-view-data(viewId)
   ```

5. Present CSV data:
   ```
   "Here's the data from the Sales Performance view:
   
   Region,Sales,Profit
   East,678781,91522
   West,725457,108418
   Central,501240,39706
   South,391721,46749
   
   [Additional rows...]
   
   The data contains X rows and Y columns."
   ```

### Data Characteristics

**What's included**:
- All fields visible in the view
- Data respects view-level filters
- Aggregated data (if view shows aggregations)
- Formatted values

**What's NOT included**:
- Row-level data (if view shows aggregated data)
- Hidden fields
- Data outside view filters
- Calculations not in view

### Best Practices

1. **Describe the data**:
   - Mention number of rows and columns
   - Highlight key fields
   - Note any view-level filters that apply

2. **Format for readability**:
   - Show preview (first few rows)
   - Mention total row count
   - Offer to show more if truncated

3. **Set expectations**:
   - Explain data is from the view (not raw datasource)
   - Note view filters apply
   - Mention aggregation level if applicable

4. **Consider size**:
   - Large views may have lots of data
   - Preview first, offer full export
   - Warn if data is very large

---

## Complete Workflows

### Workflow 1: View Specific Dashboard

**User**: "Show me the Executive Overview dashboard"

**Steps**:

1. **Find the view**:
   ```
   Option A: list-views(filter: "name:eq:Executive Overview")
   Option B: list-workbooks → get-workbook → find view in list
   ```

2. **Extract view ID**

3. **Get view image**:
   ```
   get-view-image(viewId, width: 1200, height: 800)
   ```

4. **Present to user**:
   ```
   "Here's the Executive Overview dashboard:
   
   [Display image]
   
   From workbook: [workbook name]
   Project: [project name]
   Last updated: [timestamp]
   Total views: [view count]
   
   Would you like to see the data behind this dashboard?"
   ```

---

### Workflow 2: Explore Workbook and View Multiple Dashboards

**User**: "Show me the dashboards in the Q4 Sales workbook"

**Steps**:

1. **Find workbook**:
   ```
   list-workbooks(filter: "name:eq:Q4 Sales")
   Extract workbook ID
   ```

2. **Get workbook details**:
   ```
   get-workbook(workbookId)
   Review views array
   ```

3. **Present view options**:
   ```
   "The Q4 Sales workbook contains 4 dashboards:
   1. Summary Dashboard (2,341 views)
   2. Regional Breakdown (1,823 views)
   3. Product Performance (1,456 views)
   4. Trends Analysis (987 views)
   
   Which would you like to see?"
   ```

4. **User selects views** (e.g., "1 and 3")

5. **Get images**:
   ```
   get-view-image(view1Id, width: 1200, height: 800)
   get-view-image(view3Id, width: 1200, height: 800)
   ```

6. **Present both dashboards** with labels

---

### Workflow 3: Dashboard Image + Data Export

**User**: "Show me the Sales Trends dashboard and export its data"

**Steps**:

1. **Find view**:
   ```
   list-views(filter: "name:eq:Sales Trends")
   Extract view ID
   ```

2. **Get view image**:
   ```
   get-view-image(viewId, width: 1200, height: 800)
   ```

3. **Present image**:
   ```
   "Here's the Sales Trends dashboard:
   [Display image]
   ```

4. **Get view data**:
   ```
   get-view-data(viewId)
   ```

5. **Present data**:
   ```
   And here's the underlying data:
   
   [CSV preview with first 10 rows]
   
   The complete dataset has [X] rows and [Y] columns.
   ```

---

### Workflow 4: Project Dashboard Gallery

**User**: "Show me all dashboards in the Marketing project"

**Steps**:

1. **List views in project**:
   ```
   list-views(filter: "projectName:eq:Marketing,sheetType:eq:dashboard")
   ```

2. **Present view list** with usage stats

3. **User selects top N** (or you offer to show top 3)

4. **Get images for selected views**:
   ```
   For each selected view:
     get-view-image(viewId, width: 1000, height: 667)
   ```

5. **Present gallery** with view names and metadata

---

## Presentation Best Practices

### When Presenting Workbook Information

Include:
- Workbook name
- Project location
- Number of views/sheets
- Description (if available)
- Owner
- Last updated date
- List of views with usage statistics

Example:
```
Workbook: Superstore Analysis
Project: Sales & Marketing
Owner: Sarah Johnson
Last updated: 2024-01-15
Contains 5 views:

1. Overview Dashboard (12,453 views) ⭐ Most popular
2. Sales Performance (8,921 views)
3. Regional Analysis (6,334 views)
4. Product Details (4,112 views)
5. Profit Trends (3,087 views)

Which view would you like to see?
```

### When Presenting View Images

Include:
- View name
- Parent workbook name
- Project location
- Last updated date
- Usage statistics
- Image dimensions used
- Offer to export data

Example:
```
Executive Overview Dashboard
From: Q4 Sales Report workbook
Project: Executive Reporting
Last updated: 2024-01-20
Total views: 2,341

[Display image at 1200x800]

This is a snapshot as of [current date/time].
Would you like to export the data behind this dashboard?
```

### When Presenting Exported Data

Include:
- View name and workbook context
- Number of rows and columns
- Field names (column headers)
- Preview of data (first 5-10 rows)
- Note about filters or aggregation
- Offer to show more

Example:
```
Data from Sales Performance view (Superstore workbook):

Columns: Region, Sales, Profit, Orders
Rows: 4 (aggregated by region)

Region    | Sales      | Profit    | Orders
----------|------------|-----------|-------
East      | $678,781   | $91,522   | 2,848
West      | $725,457   | $108,418  | 3,203
Central   | $501,240   | $39,706   | 1,956
South     | $391,721   | $46,749   | 1,687

Note: Data is aggregated by region (sum of sales, sum of profit, count of orders)
```

---

## Error Handling

### Workbook Not Found
1. Try flexible filtering (no filter, list all)
2. Present available workbooks to user
3. Ask user to clarify which workbook

### View Not Found
1. Get workbook and show available views
2. Check spelling and case sensitivity
3. Present view options to user

### Access Denied (Workbook or View)
- Inform user they don't have permission
- Verify project access
- Suggest contacting administrator
- Show accessible workbooks/views instead

### Image Generation Failed
- View may be unavailable or being edited
- Retry after brief wait
- Offer to export data instead
- Check view is published

### Data Export Failed
- User may not have download permissions
- View may be restricted
- Suggest viewing image instead
- Contact administrator for permissions

---

## Integration with Other Topics

### From Content Discovery
- Use list-workbooks and list-views to find content
- Extract IDs and transition to viewing workflow

### To Data Exploration
- If user wants to query datasource underlying a view
- Transition to datasource exploration workflow
- Note: View data ≠ datasource query (view shows aggregated/filtered data)

### From Pulse topics
- Pulse metrics may reference views or dashboards
- Use view IDs from Pulse context to display dashboards

---

## Key Principles

1. **Workbook first, then views**: Get workbook details to see all available views
2. **Present options**: Show view list before fetching images
3. **Appropriate dimensions**: Choose image size based on use case
4. **Context matters**: Always include workbook and project context
5. **Usage statistics**: Highlight popular views to guide user
6. **Offer both**: Image for visual, data export for analysis
7. **Handle errors gracefully**: Fallback to listing available content
8. **Clear presentation**: Format data and images with clear labels and metadata
