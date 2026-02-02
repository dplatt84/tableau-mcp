## Critical Workflow Pattern: METADATA-FIRST ⚠️

**THE GOLDEN RULE**: ALWAYS call `get-datasource-metadata` BEFORE calling `query-datasource`.

This is non-negotiable. Skipping metadata retrieval is the #1 cause of query failures.

### Why Metadata First?

1. **Field names are case-sensitive**: You must use EXACT field names from metadata
2. **Field types determine usage**: Dimensions vs Measures require different handling
3. **Aggregation validation**: Measures require aggregation functions, dimensions don't
4. **Available fields**: Not all fields visible in Tableau UI are queryable
5. **Parameter discovery**: Parameters must be from the datasource definition

### Standard Query Workflow

```
1. Find Datasource
   └─> list-datasources (flexible filter or no filter)
   
2. Extract LUID
   └─> Get datasource LUID from results
   
3. Get Metadata ⚠️ MANDATORY
   └─> get-datasource-metadata (using LUID)
   
4. Review Metadata
   └─> Extract field names (EXACT case)
   └─> Identify dimensions vs measures
   └─> Note data types
   └─> Check available parameters
   
5. Construct Query
   └─> Use EXACT field names from step 4
   └─> Apply aggregation to measures only
   └─> No aggregation on dimensions
   └─> Validate filter syntax
   
6. Execute Query
   └─> query-datasource (using LUID and validated query)
   
7. Present Results
   └─> Format and explain results to user
```

---

## Tool 1: list-datasources

### Purpose
Retrieves published datasources from a Tableau site. Use for discovering, listing, or searching for datasources before querying.

### When to Use
- User asks "what datasources are available", "list datasources", "find datasources"
- User mentions a datasource by name (you need to find its LUID)
- User wants to explore available datasources
- Before querying: you need the datasource LUID

### Parameters
- `filter` (optional): Field:operator:value expression(s)
- `pageSize` (optional): Results per page
- `limit` (optional): Maximum results to return

### Filter Fields Available
`authenticationType`, `connectionTo`, `connectionType`, `contentUrl`, `createdAt`, `databaseName`, `description`, `favoritesTotal`, `hasAlert`, `hasEmbeddedPassword`, `hasExtracts`, `isCertified`, `isConnectable`, `isPublished`, `name`, `ownerDomain`, `ownerEmail`, `ownerName`, `projectName`, `serverName`, `size`, `tableName`, `tags`, `type`, `updatedAt`

### Operators
- `eq`: equals (exact match)
- `gt`: greater than
- `gte`: greater than or equal
- `lt`: less than
- `lte`: less than or equal
- `in`: list membership

### Filter Syntax
- Format: `field:operator:value`
- Multiple filters: comma-separated (e.g., `name:eq:Superstore,projectName:eq:Finance`)
- Case-sensitive matching
- Date format: ISO 8601 (e.g., `2023-01-01T00:00:00Z`)
- Wildcards: asterisk (*) for pattern matching
- Values cannot contain special characters or commas

### Filtering Strategy: PREFER FLEXIBLE OVER STRICT

**⚠️ IMPORTANT**: Don't assume exact datasource names. Start broad and narrow down.

#### Use STRICT Filters (exact match with `eq`) ONLY When:
- User provides the exact datasource name and you're highly confident it matches exactly
- You've already seen the datasource name in previous results
- User specifies precise criteria (e.g., "the datasource called 'Superstore'")

#### Use FLEXIBLE Filters or NO FILTERS When:
- User provides partial or approximate names (e.g., "something with sales")
- User is exploring or discovering datasources
- You're unsure of exact spelling, case, or spacing
- Previous strict filter returned no results (fallback strategy)
- User asks to "list all" or "show me what's available"

#### Flexible Filtering Strategies:
1. **No filter**: Empty filter lists ALL datasources (best for discovery)
2. **Broader criteria**: Filter by project or owner instead of exact name
3. **Progressive refinement**: Start with no filter, then narrow based on results

#### Fallback Chain When Datasource Not Found:
```
1. Try strict filter: name:eq:ExactName
   └─> If no results:
   
2. Try no filter: list all datasources
   └─> Search results manually for matches
   └─> Present options to user for selection
   
3. If still no match:
   └─> Try broader filter: projectName:eq:ProjectName
   └─> Or show user all available datasources
```

### Examples

**Empty filter** (lists all - RECOMMENDED for discovery):
```json
{
  "filter": ""
}
```

**Strict exact name match** (only if confident):
```json
{
  "filter": "name:eq:Superstore"
}
```

**Filter by project** (broader, safer):
```json
{
  "filter": "projectName:eq:Finance"
}
```

**Combined filters**:
```json
{
  "filter": "projectName:eq:Finance,isCertified:eq:true,createdAt:gt:2023-01-01T00:00:00Z"
}
```

### What It Returns
Array of datasource objects containing:
- `id` (LUID) - **Required for metadata and querying**
- `name` - Datasource name
- `projectName` - Project location
- `ownerName` - Owner information
- `description` - Datasource description
- `isCertified` - Certification status
- `isConnectable` - Whether it can be queried
- `hasExtracts` - Extract status
- Timestamps: `createdAt`, `updatedAt`

### Error Handling

**Datasource not found with strict filter**:
1. Fallback: List all datasources (no filter)
2. Search results manually or present options to user
3. Check for case sensitivity or spelling variations

**Access denied**:
- Inform user they don't have permission
- Suggest contacting site administrator

**Invalid filter syntax**:
- Review filter format
- Ensure field names match supported fields
- Check operators are valid
- Ensure values don't contain special characters

**No results**:
- Always fallback to no-filter listing to show what's actually available
- Present available datasources to user for clarification

---

## Tool 2: get-datasource-metadata ⚠️ MANDATORY BEFORE QUERYING

### Purpose
Retrieves comprehensive metadata for a datasource including all fields, their data types, roles, descriptions, and parameters. This tool enriches basic VizQL metadata with additional context from Tableau's Metadata API.

### When to Use
- **ALWAYS before calling query-datasource** (non-negotiable)
- User asks "what fields are available", "what's in this datasource", "what can I query"
- User wants to understand datasource structure
- User needs to know available parameters

### Parameters
- `datasourceLuid` (required): The LUID from list-datasources results

### What It Returns

**Fields Array** - All queryable fields with:
- `name` - Field name (**case-sensitive, use EXACTLY as shown**)
- `dataType` - Data type: `string`, `int`, `float`, `date`, `datetime`, `bool`, etc.
- `dataCategory` - `dimension` or `measure`
- `role` - Field role in Tableau: `dimension`, `measure`, `unknown`
- `aggregation` - Default aggregation for measures: `sum`, `avg`, `count`, etc.
- `description` - Field description (if available)
- `isHidden` - Whether field is hidden

**Parameters Array** - Dynamic values for queries:
- `name` - Parameter name
- `dataType` - Parameter data type
- `currentValue` - Current parameter value
- `allowableValues` - List of allowed values (for LIST parameters)

### Field Type Rules (CRITICAL)

#### Dimensions
- **No aggregation required**
- Use for grouping and segmentation
- Examples: Region, Category, Product Name, Date (as grouping level)
- Query usage: Include as-is in fields array

#### Measures
- **MUST have aggregation function**
- Aggregation functions: `SUM`, `AVG`, `COUNT`, `MIN`, `MAX`, `COUNTD`, `MEDIAN`, `STDEV`, `VARIANCE`
- Examples: Sales, Profit, Quantity, Revenue
- Query usage: Include with `function` property

#### Calculated Fields
- Can be dimensions or measures (check `dataCategory`)
- Follow same rules as dimensions/measures
- Use Tableau syntax

### Metadata Review Checklist

Before constructing a query, review metadata and verify:

1. **Field names**: Copy EXACT names (case-sensitive)
2. **Field types**: Identify which are dimensions, which are measures
3. **Data types**: Note data types for filter construction
4. **Aggregations**: Confirm which aggregation functions are appropriate
5. **Parameters**: Check if parameters are needed for the query
6. **Hidden fields**: Exclude hidden fields from queries

### Example Metadata Usage

**User asks**: "Show me total sales by region"

**Metadata review**:
```
Fields found:
- "Region" → dataCategory: dimension, dataType: string
- "Sales" → dataCategory: measure, dataType: float, aggregation: sum

Query construction:
- Region: Use as-is (dimension, no aggregation)
- Sales: Use with SUM function (measure, requires aggregation)
```

**Result**: Query with Region (no function) and Sales (function: SUM)

### Error Handling

**Invalid datasource LUID**:
- Verify LUID from list-datasources results
- LUIDs are UUIDs (36 characters, case-sensitive)
- Re-run list-datasources if LUID seems incorrect

**Datasource not found**:
- Ensure datasource is published
- Check datasource is connectable (`isConnectable: true`)
- Verify user has access permissions

**Access denied**:
- User doesn't have permission to access datasource
- Contact site administrator for access

---

## Tool 3: query-datasource

### Purpose
Executes VizQL queries against Tableau datasources to answer business questions. Returns aggregated, filtered, and sorted data.

### When to Use
- User asks business questions requiring data analysis
- User wants aggregated data (totals, averages, counts)
- User needs filtered or sorted data
- User requests top N analysis

### Prerequisites (MUST COMPLETE FIRST)
1. Datasource LUID obtained (from list-datasources)
2. Metadata retrieved (from get-datasource-metadata)
3. Field names verified (EXACT match from metadata)
4. Field types identified (dimension vs measure)
5. Query constructed and validated

### Parameters

**Required**:
- `datasourceLuid` (string): Datasource LUID
- `query` (object): VizQL query specification

**Query Object Structure**:
```json
{
  "fields": [...],          // Required: Fields to query
  "filters": [...],         // Optional: Data filters
  "parameters": [...]       // Optional: Parameter values
}
```

### Query Construction: Step-by-Step

#### Step 1: Define Fields

Each field object can have:
- `fieldCaption` (string, required): EXACT field name from metadata (case-sensitive)
- `function` (string, ONLY for measures): Aggregation function
- `fieldAlias` (string, optional): Custom display name for the field
- `sortDirection` (string, optional): Sort order ("ASC" or "DESC")
- `sortPriority` (number, optional): Sort priority (1 = primary sort, 2 = secondary, etc.)
- `maxDecimalPlaces` (number, optional): Decimal precision for numeric fields
- `binSize` (number, optional): Create bins for continuous data (measures only)
- `calculation` (string, optional): Tableau calculation formula for custom fields

**Dimension Example** (no function):
```json
{
  "fieldCaption": "Region",
  "fieldAlias": "Sales Region"
}
```

**Measure Example** (requires function):
```json
{
  "fieldCaption": "Sales",
  "function": "SUM",
  "fieldAlias": "Total Sales",
  "sortDirection": "DESC",
  "sortPriority": 1,
  "maxDecimalPlaces": 2
}
```

**Bin Field Example** (create distribution ranges):
```json
{
  "fieldCaption": "Sales",
  "binSize": 1000,
  "fieldAlias": "Sales Range",
  "sortDirection": "ASC",
  "sortPriority": 1
}
```

**Calculated Field Example** (custom formula):
```json
{
  "fieldCaption": "Profit Margin",
  "calculation": "SUM([Profit]) / SUM([Sales])",
  "fieldAlias": "Margin %"
}
```

**Aggregation Functions**:
- `SUM` - Sum of values
- `AVG` - Average
- `COUNT` - Count of records
- `COUNTD` - Count distinct
- `MIN` - Minimum value
- `MAX` - Maximum value
- `MEDIAN` - Median value
- `STDEV` - Standard deviation
- `VARIANCE` - Variance
- `TRUNC_YEAR`, `TRUNC_QUARTER`, `TRUNC_MONTH`, `TRUNC_WEEK`, `TRUNC_DAY` - Date truncation functions

#### Step 2: Add Filters (Optional)

All filters require a `field` object wrapper and support optional `context` property:

**SET Filter** - Filter to specific values:
```json
{
  "field": {"fieldCaption": "Region"},
  "filterType": "SET",
  "values": ["East", "West"],
  "exclude": false
}
```

**QUANTITATIVE Filter** - Numeric ranges:
```json
{
  "field": {"fieldCaption": "Sales"},
  "filterType": "QUANTITATIVE_NUMERICAL",
  "quantitativeFilterType": "RANGE",
  "min": 1000,
  "max": 5000,
  "includeNulls": false
}
```

Quantitative filter types: `RANGE`, `MIN`, `MAX`, `ONLY_NULL`, `ONLY_NON_NULL`

**DATE Filter** - Relative time periods:
```json
{
  "field": {"fieldCaption": "Order Date"},
  "filterType": "DATE",
  "periodType": "MONTHS",
  "dateRangeType": "LASTN",
  "rangeN": 6
}
```

Date range types: `CURRENT`, `LAST`, `NEXT`, `TODATE`, `LASTN`, `NEXTN`

Period types: `MINUTES`, `HOURS`, `DAYS`, `WEEKS`, `MONTHS`, `QUARTERS`, `YEARS`

**TOP Filter** - Top or bottom N by measure:
```json
{
  "field": {"fieldCaption": "Customer Name"},
  "filterType": "TOP",
  "howMany": 10,
  "direction": "TOP",
  "fieldToMeasure": {"fieldCaption": "Sales", "function": "SUM"}
}
```

**Filter Context** (advanced):
- `context: true` - Filter applies to overall query context (dimension/scope filters)
- `context: false` - Filter applies after context (ranking/limiting filters)
- Use context when combining dimension filters with TOP filters for "top N within a category" queries

#### Step 3: Add Parameters (Optional)

Parameters are dynamic values that control calculations or filters:

```json
[
  {
    "name": "Select Region",
    "value": "East"
  }
]
```

Parameter types (from metadata):
- `LIST` - Select from list
- `ANY_VALUE` - Any value
- `QUANTITATIVE_RANGE` - Numeric range
- `QUANTITATIVE_DATE` - Date range

### Data Volume Management (CRITICAL)

**Best Practices**:
1. **Prefer aggregation** over row-level data
2. **Profile first**: Run COUNT when unsure about volume
3. **Use TOP filters** for top N queries
4. **Apply filters** to reduce data (SET, QUANTITATIVE, DATE)
5. **Avoid row-level queries** unless specifically needed
6. **Suggest aggregation** when counts exceed 10,000

**Profiling Strategy**:
```
1. Count total records:
   └─> Query with COUNT(*) to get total volume
   
2. Count by key dimensions:
   └─> Query with dimension + COUNT to see cardinality
   
3. Apply aggregation or filters:
   └─> Based on volume, aggregate or filter data
```

**When to profile**:
- Querying all records without filters
- High-cardinality fields without filters
- User asks for "all data" or "everything"
- Unsure about data volume

### Complete Query Examples

**Example 1: Total Sales by Region**

User: "What are total sales by region?"

Metadata:
- Region: dimension, string
- Sales: measure, real

Query:
```json
{
  "datasourceLuid": "abc123...",
  "query": {
    "fields": [
      {
        "fieldCaption": "Region"
      },
      {
        "fieldCaption": "Sales",
        "function": "SUM",
        "fieldAlias": "Total Sales",
        "sortDirection": "DESC",
        "sortPriority": 1
      }
    ]
  }
}
```

**Example 2: Top 10 Customers by Revenue**

User: "Show me top 10 customers by revenue"

Metadata:
- Customer Name: dimension, string
- Revenue: measure, real

Query:
```json
{
  "datasourceLuid": "abc123...",
  "query": {
    "fields": [
      {
        "fieldCaption": "Customer Name"
      },
      {
        "fieldCaption": "Revenue",
        "function": "SUM",
        "fieldAlias": "Total Revenue",
        "sortDirection": "DESC",
        "sortPriority": 1
      }
    ],
    "filters": [
      {
        "field": {"fieldCaption": "Customer Name"},
        "filterType": "TOP",
        "howMany": 10,
        "direction": "TOP",
        "fieldToMeasure": {"fieldCaption": "Revenue", "function": "SUM"}
      }
    ]
  }
}
```

**Example 3: Sales by Category for Specific Regions**

User: "Show me sales by category for East and West regions"

Metadata:
- Category: dimension, string
- Region: dimension, string
- Sales: measure, real

Query:
```json
{
  "datasourceLuid": "abc123...",
  "query": {
    "fields": [
      {
        "fieldCaption": "Category"
      },
      {
        "fieldCaption": "Sales",
        "function": "SUM",
        "sortDirection": "DESC",
        "sortPriority": 1
      }
    ],
    "filters": [
      {
        "field": {"fieldCaption": "Region"},
        "filterType": "SET",
        "values": ["East", "West"]
      }
    ]
  }
}
```

### Common Error Patterns & Solutions

**Error: Field not found**
- **Cause**: Field name doesn't match metadata exactly (case-sensitive)
- **Solution**: Copy field name EXACTLY from metadata, verify case

**Error: Invalid aggregation**
- **Cause**: Applied aggregation to dimension OR missing aggregation on measure
- **Solution**: Review metadata, apply function only to measures

**Error: Query too large**
- **Cause**: Querying too much data without filters or aggregation
- **Solution**: Apply filters, use aggregation, or profile first with COUNT

**Error: Invalid filter syntax**
- **Cause**: Missing field object wrapper or wrong filter type
- **Solution**: Wrap filter fields in `{"field": {"fieldCaption": "..."}}` structure

**Error: Unrecognized keys**
- **Cause**: Using deprecated properties like `dataType` on fields or separate `sorting` array
- **Solution**: Remove `dataType`, put `sortDirection`/`sortPriority` on field objects directly

**Error: Datasource not connectable**
- **Cause**: Datasource has `isConnectable: false`
- **Solution**: Inform user datasource cannot be queried, contact administrator

**Error: Missing required parameter**
- **Cause**: Query uses calculation that requires parameter, but parameter not provided
- **Solution**: Include required parameters from metadata in query

### Validation Checklist Before Calling

Before executing query-datasource, verify:

1. **Datasource LUID** is valid (from list-datasources)
2. **Metadata retrieved** (from get-datasource-metadata)
3. **All field names** match metadata EXACTLY (case-sensitive)
4. **Dimensions have NO function**
5. **Measures HAVE function** (SUM, AVG, COUNT, etc.)
6. **Sort properties on field objects** (not separate sorting array)
7. **Filter syntax** uses field object wrapper: `{"field": {"fieldCaption": "..."}}`
8. **Parameters** are provided if needed
9. **Data volume** is reasonable or profiled

---

## Complete Workflow Examples

### Example 1: Basic Aggregation Query

**User Request**: "Show me total sales and profit by region for the Superstore datasource"

**Step 1: Find Datasource**
```
Call: list-datasources
Filter: "" (empty - list all to avoid case issues)
Result: Find "Superstore" datasource, extract LUID
```

**Step 2: Get Metadata** ⚠️ MANDATORY
```
Call: get-datasource-metadata
LUID: "abc-123-def-456"
Result: Review fields:
  - "Region" → dimension, string
  - "Sales" → measure, real, aggregation: sum
  - "Profit" → measure, real, aggregation: sum
```

**Step 3: Construct Query**
```json
{
  "datasourceLuid": "abc-123-def-456",
  "query": {
    "fields": [
      {
        "fieldCaption": "Region"
      },
      {
        "fieldCaption": "Sales",
        "function": "SUM",
        "sortDirection": "DESC",
        "sortPriority": 1
      },
      {
        "fieldCaption": "Profit",
        "function": "SUM"
      }
    ]
  }
}
```

**Step 4: Execute Query**
```
Call: query-datasource with above query
Result: Returns aggregated sales and profit by region, sorted by sales
```

**Step 5: Present Results**
```
"Here are the total sales and profit by region for Superstore:

Region    | Total Sales  | Total Profit
----------|--------------|-------------
West      | $725,457     | $108,418
East      | $678,781     | $91,522
Central   | $501,240     | $39,706
South     | $391,721     | $46,749
```

---

### Example 2: Filtered Analysis with Top N

**User Request**: "What are the top 5 products by profit in the Technology category?"

**Step 1: Find Datasource**
```
Call: list-datasources
Filter: "" (list all)
Result: User confirms datasource, extract LUID
```

**Step 2: Get Metadata** ⚠️ MANDATORY
```
Call: get-datasource-metadata
Result: Review fields:
  - "Product Name" → dimension, string
  - "Category" → dimension, string
  - "Profit" → measure, real
```

**Step 3: Construct Query**
```json
{
  "datasourceLuid": "abc-123-def-456",
  "query": {
    "fields": [
      {
        "fieldCaption": "Product Name"
      },
      {
        "fieldCaption": "Profit",
        "function": "SUM",
        "sortDirection": "DESC",
        "sortPriority": 1
      }
    ],
    "filters": [
      {
        "field": {"fieldCaption": "Category"},
        "filterType": "SET",
        "values": ["Technology"]
      },
      {
        "field": {"fieldCaption": "Product Name"},
        "filterType": "TOP",
        "howMany": 5,
        "direction": "TOP",
        "fieldToMeasure": {
          "fieldCaption": "Profit",
          "function": "SUM"
        }
      }
    ]
  }
}
```

**Step 4: Execute & Present**
```
Top 5 Technology products by profit:

1. Canon imageCLASS 2200: $25,199
2. Hewlett Packard LaserJet: $18,807
3. GBC DocuBind P400: $17,012
4. Cisco TelePresence: $16,887
5. Motorola Smart Phone: $15,453
```

---

### Example 3: Error Recovery - Datasource Not Found

**User Request**: "Query the sales datasource for revenue by month"

**Step 1: Try Strict Filter**
```
Call: list-datasources
Filter: "name:eq:Sales"
Result: No datasources found
```

**Step 2: Fallback to No Filter**
```
Call: list-datasources
Filter: "" (empty)
Result: Returns all datasources:
  - "Superstore"
  - "Regional Sales"
  - "Sales Dashboard Data"
  - "Finance Quarterly"
```

**Step 3: Present Options to User**
```
"I couldn't find a datasource named exactly 'Sales', but I found these datasources that might match:
1. Regional Sales
2. Sales Dashboard Data

Which datasource would you like to query?"
```

**Step 4: User Confirms**
```
User: "Regional Sales"
```

**Step 5: Continue with Confirmed Datasource**
```
Extract LUID for "Regional Sales"
Continue to metadata retrieval...
```

---

## Key Principles (Summary)

1. **ALWAYS GET METADATA FIRST** - Never query without metadata
2. **EXACT FIELD NAMES** - Case-sensitive, copy from metadata exactly
3. **FIELD TYPE RULES** - Measures need aggregation, dimensions don't
4. **FLEXIBLE DISCOVERY** - Start with no filter or broad filters
5. **PROFILE LARGE QUERIES** - COUNT first when unsure about volume
6. **VALIDATE BEFORE CALLING** - Check all fields, types, and syntax
7. **FALLBACK STRATEGIES** - Multiple attempts with broader filters
8. **PRESENT OPTIONS** - Show user choices when ambiguous

---

## Error Prevention Checklist

Before every query-datasource call:

- [ ] Datasource LUID obtained from list-datasources
- [ ] Metadata retrieved with get-datasource-metadata
- [ ] All field names copied EXACTLY from metadata (case-sensitive)
- [ ] Dimensions identified (no function)
- [ ] Measures identified (function required)
- [ ] Sort properties on field objects (sortDirection, sortPriority) NOT separate sorting array
- [ ] Filters use field object wrapper: `{"field": {"fieldCaption": "..."}}`
- [ ] No `dataType` property on field objects
- [ ] Parameters included if needed
- [ ] Data volume considered (profile if needed)
- [ ] Query structure validated

**If ANY checkbox is unchecked, DO NOT call query-datasource.**
