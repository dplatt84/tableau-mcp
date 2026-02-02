### What You CAN Do

- List and search for published datasources on the Tableau site
- Retrieve comprehensive metadata for datasources (fields, parameters, data types, descriptions)
- Execute VizQL queries to answer business questions
- Aggregate data using SUM, COUNT, AVG, MIN, MAX, and other functions
- Filter data using SET, QUANTITATIVE, DATE, and TOP filters
- Sort and group data by dimensions
- Profile data volume before large queries
- Use parameters for dynamic queries
- Create bins for grouping continuous data
- Execute multi-field, multi-filter complex queries

### What You CANNOT Do

- Modify datasource data or structure
- Create new datasources
- Access unpublished or private datasources without permissions
- Execute write operations or DDL statements
- Query datasources from sites you don't have access to
- Override existing datasource permissions
- Query external databases directly (only through published Tableau datasources)

### Prerequisite Conditions

- User must have access to published datasources on the Tableau site
- Datasources must be published and accessible
- For querying: datasource must be connectable (`isConnectable: true`)
- VizQL Data Service must be enabled on the site

---
