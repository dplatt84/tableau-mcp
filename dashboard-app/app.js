/**
 * Executive Overview Dashboard - Superstore
 * Bootstrapped from Tableau DanSuperstoreEmbeddedDS Overview
 * Data loaded from /data/superstore.json (or embedded fallback)
 */

// Data - populated by loadData(), used by getFiltered*()
let data = {
  summary: null,
  stateData: [],
  monthlySalesBySegment: [],
  monthlySalesByCategory: [],
};

// Format helpers
const formatCurrency = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

const formatPercent = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(n);

const formatNumber = (n) =>
  new Intl.NumberFormat("en-US").format(Math.round(n));

// Filter state
let filters = {
  region: "all",
  dateStart: "2022-01-01",
  dateEnd: "2025-12-30",
};

// Load data: fetch from JSON file, fall back to embedded
async function loadData() {
  try {
    const res = await fetch("data/superstore.json");
    if (res.ok) {
      const json = await res.json();
      data.summary = json.summary;
      data.stateData = json.stateData ?? [];
      data.monthlySalesBySegment = json.monthlySalesBySegment ?? [];
      data.monthlySalesByCategory = json.monthlySalesByCategory ?? [];
      return;
    }
  } catch (err) {
    console.warn("Could not load data/superstore.json, using embedded data");
  }
  // Fallback to embedded SUPERSTORE_DATA (from data.js)
  if (typeof SUPERSTORE_DATA !== "undefined") {
    data.summary = SUPERSTORE_DATA.summary;
    data.stateData = SUPERSTORE_DATA.stateData ?? [];
    data.monthlySalesBySegment = SUPERSTORE_DATA.monthlySalesBySegment ?? [];
    data.monthlySalesByCategory = SUPERSTORE_DATA.monthlySalesByCategory ?? [];
  }
}

// Apply filters to data
function getFilteredStateData() {
  if (filters.region === "all") return data.stateData;
  return data.stateData.filter((d) => d.region === filters.region);
}

function getFilteredMonthlySegment() {
  return data.monthlySalesBySegment.filter((d) => {
    const m = (d.month || "") + "-01";
    return m >= filters.dateStart && m <= filters.dateEnd;
  });
}

function getFilteredMonthlyCategory() {
  return data.monthlySalesByCategory.filter((d) => {
    const m = (d.month || "") + "-01";
    return m >= filters.dateStart && m <= filters.dateEnd;
  });
}

// Update KPIs
function updateKPIs() {
  const s = data.summary;
  if (!s) return;
  const profitRatio = (s.profit / s.sales) * 100;
  const profitPerOrder = s.profit / s.orderCount;
  const salesPerCustomer = s.sales / s.customerCount;

  document.getElementById("kpi-sales").textContent = formatCurrency(s.sales);
  document.getElementById("kpi-profit").textContent = formatCurrency(s.profit);
  document.getElementById("kpi-profit-ratio").textContent =
    formatPercent(profitRatio / 100);
  document.getElementById("kpi-profit-per-order").textContent =
    formatCurrency(profitPerOrder);
  document.getElementById("kpi-sales-per-customer").textContent =
    formatCurrency(salesPerCustomer);
  document.getElementById("kpi-avg-discount").textContent = formatPercent(
    s.avgDiscount
  );
  document.getElementById("kpi-quantity").textContent = formatNumber(s.quantity);
}

// Map chart (choropleth by profit ratio)
let mapChart = null;

async function initMapChart() {
  const container = document.getElementById("map-chart");
  mapChart = echarts.init(container);

  try {
    const res = await fetch(
      "https://echarts.apache.org/examples/data/asset/geo/USA.json"
    );
    const usaJson = await res.json();
    echarts.registerMap("USA", usaJson);

    const filtered = getFilteredStateData();
    const mapData = filtered.map((d) => ({
      name: d.state,
      value: d.sales > 0 ? (d.profit / d.sales) * 100 : 0,
    }));

    const minVal = mapData.length ? Math.min(...mapData.map((d) => d.value)) : -20;
    const maxVal = mapData.length ? Math.max(...mapData.map((d) => d.value)) : 40;

    const option = {
      tooltip: {
        trigger: "item",
        formatter: (params) => {
          if (params.data)
            return `${params.name}<br/>Profit Ratio: ${params.data.value.toFixed(1)}%`;
          return params.name;
        },
      },
      visualMap: {
        min: Math.min(-20, minVal),
        max: Math.max(40, maxVal),
        text: ["High", "Low"],
        realtime: false,
        calculable: true,
        inRange: {
          color: ["#e15759", "#f28e2b", "#9e9e9e", "#4e79a7"],
        },
        textStyle: { color: "#595959", fontSize: 10 },
      },
      series: [
        {
          name: "Profit Ratio",
          type: "map",
          map: "USA",
          roam: true,
          emphasis: { label: { show: true }, itemStyle: { areaColor: "#4e79a7" } },
          itemStyle: { borderColor: "#e0e0e0", borderWidth: 1 },
          data: mapData,
        },
      ],
    };

    mapChart.setOption(option);
  } catch (err) {
    // Fallback: bar chart by state
    const filtered = getFilteredStateData();
    const sorted = [...filtered]
      .map((d) => ({
        name: d.stateCode,
        value: d.sales > 0 ? (d.profit / d.sales) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);

    mapChart.setOption({
      tooltip: {
        trigger: "axis",
        formatter: (params) =>
          `${params[0].name}: ${params[0].value.toFixed(1)}%`,
      },
      grid: { left: "15%", right: "10%", top: 20, bottom: 20 },
      xAxis: {
        type: "value",
        axisLabel: { formatter: "{value}%", color: "#595959" },
        splitLine: { lineStyle: { color: "#ebebeb" } },
      },
      yAxis: {
        type: "category",
        data: sorted.map((d) => d.name).reverse(),
        axisLabel: { color: "#595959" },
      },
      series: [
        {
          type: "bar",
          data: sorted.map((d) => ({
            value: d.value,
            itemStyle: {
              color: d.value >= 0 ? "#4e79a7" : "#e15759",
            },
          })),
        },
      ],
    });
  }

  window.addEventListener("resize", () => mapChart?.resize());
}

// Segment area charts (3 stacked: Consumer, Corporate, Home Office)
function initSegmentCharts() {
  const container = document.getElementById("segment-chart");
  container.innerHTML = "";
  const segments = ["Consumer", "Corporate", "Home Office"];
  const colors = ["#4e79a7", "#f28e2b", "#59a14f"];

  segments.forEach((seg, i) => {
    const wrapper = document.createElement("div");
    wrapper.className = "segment-chart-wrapper";
    wrapper.style.height = "120px";
    wrapper.style.marginBottom = "1rem";
    const canvas = document.createElement("canvas");
    wrapper.appendChild(canvas);
    container.appendChild(wrapper);

    const chartData = getFilteredMonthlySegment();
    new Chart(canvas, {
      type: "line",
      data: {
        labels: chartData.map((d) => d.month),
        datasets: [
          {
            label: "Sales",
            data: chartData.map((d) => d[seg]),
            borderColor: colors[i],
            backgroundColor: colors[i] + "40",
            fill: true,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: { display: true, text: seg, color: "#595959", font: { size: 11 } },
        },
        scales: {
          x: {
            grid: { color: "#ebebeb" },
            ticks: { color: "#8c8c8c", maxTicksLimit: 8, font: { size: 10 } },
          },
          y: {
            grid: { color: "#ebebeb" },
            ticks: {
              color: "#8c8c8c",
              font: { size: 10 },
              callback: (v) => "$" + (v / 1000) + "k",
            },
          },
        },
      },
    });
  });
}

// Category area charts (3 stacked: Furniture, Office Supplies, Technology)
function initCategoryCharts() {
  const categories = ["Furniture", "Office Supplies", "Technology"];
  const colors = ["#76b7b2", "#edc948", "#b07aa1"];

  const container = document.getElementById("category-chart");
  container.innerHTML = "";

  categories.forEach((cat, i) => {
    const canvas = document.createElement("canvas");
    canvas.height = 120;
    const wrapper = document.createElement("div");
    wrapper.className = "category-chart-wrapper";
    wrapper.style.marginBottom = "1rem";
    container.appendChild(wrapper);
    wrapper.appendChild(canvas);

    const chartData = getFilteredMonthlyCategory();
    new Chart(canvas, {
      type: "line",
      data: {
        labels: chartData.map((d) => d.month),
        datasets: [
          {
            label: "Sales",
            data: chartData.map((d) => d[cat]),
            borderColor: colors[i],
            backgroundColor: colors[i] + "40",
            fill: true,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: cat,
            color: "#595959",
            font: { size: 11 },
          },
        },
        scales: {
          x: {
            grid: { color: "#ebebeb" },
            ticks: { color: "#8c8c8c", maxTicksLimit: 8, font: { size: 10 } },
          },
          y: {
            grid: { color: "#ebebeb" },
            ticks: {
              color: "#8c8c8c",
              font: { size: 10 },
              callback: (v) => "$" + (v / 1000) + "k",
            },
          },
        },
      },
    });
  });
}

// Filter handlers
function setupFilters() {
  document.getElementById("region-filter").addEventListener("change", (e) => {
    filters.region = e.target.value;
    refreshCharts();
  });

  document.getElementById("date-start").addEventListener("change", (e) => {
    filters.dateStart = e.target.value;
    refreshCharts();
  });

  document.getElementById("date-end").addEventListener("change", (e) => {
    filters.dateEnd = e.target.value;
    refreshCharts();
  });
}

function refreshCharts() {
  if (mapChart) {
    initMapChart();
  }
  document.getElementById("segment-chart").innerHTML = "";
  initSegmentCharts();
  document.getElementById("category-chart").innerHTML = "";
  initCategoryCharts();
}

// Init - load data first, then render
async function init() {
  await loadData();
  if (!data.summary) {
    document.body.innerHTML =
      "<p style='padding:2rem;color:#e15759'>No data available. Run <code>npx tsx scripts/exportSuperstoreData.ts</code> to export from Tableau.</p>";
    return;
  }
  updateKPIs();
  setupFilters();
  initMapChart();
  initSegmentCharts();
  initCategoryCharts();
}

document.addEventListener("DOMContentLoaded", init);
