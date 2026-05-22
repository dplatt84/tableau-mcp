# Executive Overview Dashboard

A standalone web dashboard bootstrapped from your Tableau **DanSuperstoreEmbeddedDS** Overview visualization. Data is loaded from `data/superstore.json` (exported from Tableau) with embedded fallback.

## Most Utilized Views (from your Tableau site)

| View        | Views | Source                    |
|------------|-------|---------------------------|
| Forecast   | 61    | DanSuperstoreEmbeddedDS   |
| Overview   | 46    | DanSuperstoreEmbeddedDS   |
| Dashboard 1| 20    | DanPCallCenter            |
| Performance| 9     | DanSuperstoreEmbeddedDS   |

This app recreates the **Overview** layout:

- **7 KPI cards**: Sales, Profit, Profit Ratio, Profit per Order, Sales per Customer, Avg. Discount, Quantity
- **Choropleth map**: Profit ratio by US state (or bar chart fallback)
- **Monthly Sales by Segment**: Consumer, Corporate, Home Office (area charts)
- **Monthly Sales by Category**: Furniture, Office Supplies, Technology (area charts)
- **Filters**: Region, Order Date range

## Data source

Data is stored in `data/superstore.json`. To refresh from your Tableau datasource:

```bash
# From project root (uses credentials from ./env)
npm run export-dashboard-data
```

If Tableau auth fails, the script writes fallback sample data so the dashboard still works.

## Run locally

Because the app loads external resources (ECharts, Chart.js, USA GeoJSON), use a local HTTP server:

```bash
# From the dashboard-app directory
npx serve .

# Or from project root
npx serve dashboard-app
```

Then open `http://localhost:3000` (or the port shown).

## Tech stack

- HTML, CSS, vanilla JavaScript
- [ECharts](https://echarts.apache.org/) – map and bar chart
- [Chart.js](https://www.chartjs.org/) – area charts
- Embedded sample data in `data.js`

## Customization

- **Data**: Edit `data.js` to change KPIs, state data, or time series.
- **Styling**: Adjust `styles.css` (colors, typography, layout).
- **Filters**: Filters update the map and charts; extend logic in `app.js` as needed.
