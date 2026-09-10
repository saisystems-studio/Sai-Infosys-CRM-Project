import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import "./StaffPerformanceReport.css";
import "./CompletedInquiryReport/CompletedInquiryReport.css";

const colors = {
  completed: "#2f9b72",
  pending: "#e8a33a",
  cancelled: "#e66c78",
  primary: "#5e56d9",
  teal: "#1e9a9a",
};

const API_BASE_URL = import.meta.env.VITE_API_URL || "/crm/api";
const formatAmount = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
const productName = (product) =>
  product.product_name ||
  product.product_type_name ||
  product.name ||
  "Product";
const productRevenue = (product) =>
  Number(product.revenue_amount || product.amount || 0);

function MiniIcon({ type }) {
  const paths = {
    calendar: "M5 4h14v16H5z M8 2v4m8-4v4M5 9h14",
    check: "m5 12 4 4L19 6",
    clock: "M12 7v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
    close: "m7 7 10 10m0-10L7 17",
    revenue: "M12 3v18m4-14c0-2-8-2-8 1s8 2 8 5-8 3-8 0",
    target: "M12 4a8 8 0 1 0 8 8 M12 8a4 4 0 1 0 4 4",
    users:
      "M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8m7 0a3 3 0 1 0 0-6",
    spark: "M12 2L9.5 9.5L2 12L9.5 14.5L12 22L14.5 14.5L22 12L14.5 9.5L12 2Z",
  };
  return (
    <svg className="spr-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[type] || "M4 12h16M12 4v16"} />
    </svg>
  );
}

function Donut({ completed = 75 }) {
  return (
    <div className="spr-donut" style={{ "--donut": `${completed}%` }}>
      <div>
        <strong>{completed}%</strong>
        <span>completed</span>
      </div>
    </div>
  );
}

function LineChart({ metric = "revenue", data = [] }) {
  const values =
    metric === "score"
      ? data.map((item) => item.score)
      : data.map((item) => item.revenue);
  const max = metric === "score" ? 100 : 5;
  const points = values
    .map((value, index) => `${index * 20 + 5},${92 - (value / max) * 76}`)
    .join(" ");
  return (
    <div className="spr-line-chart">
      <svg viewBox="0 0 110 100" preserveAspectRatio="none">
        <path
          className="spr-area"
          d={`M 5,92 L ${points.replaceAll(" ", " L ")} L 105,92 Z`}
        />
        <polyline points={points} />
      </svg>
      <div className="spr-chart-labels">
        {data.map((item) => (
          <span key={item.month}>{item.month}</span>
        ))}
      </div>
    </div>
  );
}

function BarChart({ values, horizontal = false }) {
  const max = Math.max(...values.map((value) => value[1]));
  return (
    <div className={horizontal ? "spr-bars horizontal" : "spr-bars"}>
      {values.map(([label, value]) => (
        <div className="spr-bar-item" key={label}>
          <span>{label}</span>
          <div>
            <i style={{ width: `${(value / max) * 100}%` }} />
          </div>
          <b>{value}</b>
        </div>
      ))}
    </div>
  );
}

function downloadCsv(filename, rows) {
  const csv = rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
    )
    .join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function StaffPerformanceReport() {
  const [staff, setStaff] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [inquiries, setInquiries] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("crm_access_token");
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      axios.get(`${API_BASE_URL}/inquiries/schedule/`, { headers }),
      axios.get(`${API_BASE_URL}/inquiries/resources/`, { headers }),
    ])
      .then(([scheduleResponse, resourceResponse]) => {
        setInquiries(scheduleResponse.data || []);
        setResources(resourceResponse.data || []);
      })
      .catch((requestError) => {
        setError(
          requestError.response?.data?.detail ||
            "Unable to load the staff performance report.",
        );
      })
      .finally(() => setLoading(false));
  }, [retryKey]);

  const staffOptions = resources.map((resource) => ({
    value: String(resource.Id),
    label: resource.Full_Name,
  }));

  const filteredInquiries = useMemo(
    () =>
      inquiries.filter((inquiry) => {
        const date = String(inquiry.schedule_date || "").slice(0, 10);
        return (
          (!fromDate || date >= fromDate) &&
          (!toDate || date <= toDate) &&
          (!staff || String(inquiry.Resource_Id || "") === staff)
        );
      }),
    [fromDate, inquiries, staff, toDate],
  );

  const statusCount = (name) =>
    filteredInquiries.filter(
      (inquiry) =>
        String(inquiry.status_name || "New").toLowerCase() ===
        name.toLowerCase(),
    ).length;

  const totalRevenue = filteredInquiries.reduce(
    (sum, inquiry) =>
      sum +
      (inquiry.products || []).reduce(
        (productSum, product) => productSum + productRevenue(product),
        0,
      ),
    0,
  );

  const expectedRevenue = filteredInquiries.reduce(
    (sum, inquiry) =>
      sum +
      (inquiry.products || []).reduce(
        (productSum, product) => productSum + Number(product.amount || 0),
        0,
      ),
    0,
  );

  const completedCount = statusCount("Completed");
  const pendingCount = filteredInquiries.filter(
    (inquiry) => !["Completed", "Cancelled"].includes(inquiry.status_name),
  ).length;
  const cancelledCount = statusCount("Cancelled");
  const performance = filteredInquiries.length
    ? Math.round((completedCount / filteredInquiries.length) * 1000) / 10
    : 0;

  const kpis = [
    [
      "Total schedules",
      filteredInquiries.length,
      "Live data",
      "calendar",
      "neutral",
    ],
    ["Completed", completedCount, "Current period", "check", "up"],
    ["Pending", pendingCount, "Current period", "clock", "neutral"],
    ["Cancelled", cancelledCount, "Current period", "close", "down"],
    [
      "Revenue",
      formatAmount(totalRevenue),
      "From schedule products",
      "revenue",
      "up",
    ],
    [
      "Expected",
      formatAmount(expectedRevenue),
      "From quoted amounts",
      "target",
      "neutral",
    ],
    [
      "Customers",
      new Set(filteredInquiries.map((inquiry) => inquiry.Customer_Id)).size,
      "Current period",
      "users",
      "up",
    ],
    [
      "Performance",
      `${performance}%`,
      performance >= 75 ? "Good" : "Needs work",
      "spark",
      "neutral",
    ],
  ];

  const schedules = filteredInquiries.map((inquiry) => [
    formatDate(inquiry.schedule_date),
    inquiry.customer_name || "Unknown customer",
    inquiry.company_name || "—",
    (inquiry.products || []).map(productName).join(", ") || "—",
    inquiry.status_name || "New",
    formatAmount(
      (inquiry.products || []).reduce(
        (sum, product) => sum + productRevenue(product),
        0,
      ),
    ),
    formatDate(inquiry.next_reschedule_at),
    inquiry.resource_name || "Unassigned",
  ]);

  const visits = [
    ...filteredInquiries
      .reduce((map, inquiry) => {
        const key = inquiry.Customer_Id || inquiry.customer_name;
        const entry = map.get(key) || [
          inquiry.customer_name || "Unknown customer",
          inquiry.company_name || "—",
          0,
          inquiry.schedule_date,
          inquiry.status_name || "New",
        ];
        entry[2] += 1;
        if (String(inquiry.schedule_date) > String(entry[3]))
          entry[3] = inquiry.schedule_date;
        map.set(key, entry);
        return map;
      }, new Map())
      .values(),
  ]
    .sort((left, right) => right[2] - left[2])
    .slice(0, 10)
    .map((row) => [row[0], row[1], row[2], formatDate(row[3]), row[4]]);

  const products = [
    ...filteredInquiries
      .reduce((map, inquiry) => {
        (inquiry.products || []).forEach((product) => {
          const name = productName(product);
          const entry = map.get(name) || [name, 0, 0, 0];
          entry[1] += 1;
          if (String(inquiry.status_name).toLowerCase() === "completed")
            entry[2] += 1;
          entry[3] += productRevenue(product);
          map.set(name, entry);
        });
        return map;
      }, new Map())
      .values(),
  ]
    .sort((left, right) => right[1] - left[1])
    .map((row) => [row[0], row[1], row[2], formatAmount(row[3])]);

  const monthly = [
    ...filteredInquiries
      .reduce((map, inquiry) => {
        const date = new Date(inquiry.schedule_date);
        if (Number.isNaN(date.getTime())) return map;
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        const entry = map.get(key) || {
          month: date.toLocaleDateString("en-IN", { month: "short" }),
          total: 0,
          completed: 0,
          revenue: 0,
          score: 0,
        };
        entry.total += 1;
        if (String(inquiry.status_name).toLowerCase() === "completed")
          entry.completed += 1;
        entry.revenue +=
          (inquiry.products || []).reduce(
            (sum, product) => sum + productRevenue(product),
            0,
          ) / 100000;
        entry.score = entry.total
          ? Math.round((entry.completed / entry.total) * 100)
          : 0;
        map.set(key, entry);
        return map;
      }, new Map())
      .values(),
  ];

  const uniqueCustomerCount = new Set(
    filteredInquiries.map(
      (inquiry) => inquiry.Customer_Id || inquiry.customer_name,
    ),
  ).size;
  const completedRate = filteredInquiries.length
    ? Math.round((completedCount / filteredInquiries.length) * 100)
    : 0;
  const revenueAchievement = expectedRevenue
    ? Math.round((totalRevenue / expectedRevenue) * 100)
    : 0;
  const repeatCustomerCount = visits.filter((row) => row[2] > 1).length;

  const filteredSchedules = useMemo(
    () =>
      schedules.filter((row) =>
        row.join(" ").toLowerCase().includes(search.toLowerCase()),
      ),
    [schedules, search],
  );

  const visibleSchedules = [...filteredSchedules]
    .sort((a, b) =>
      sortAsc ? a[0].localeCompare(b[0]) : b[0].localeCompare(a[0]),
    )
    .slice((page - 1) * 5, page * 5);

  const exportRows = [
    "Schedule Date,Customer Name,Company,Product,Status,Revenue Amount,Follow-up Date,Remarks".split(
      ",",
    ),
    ...filteredSchedules,
  ];

  if (loading)
    return (
      <div className="spr-state">Loading live schedules and resources...</div>
    );
  if (error)
    return (
      <div className="spr-state spr-error">
        {error}
        <button
          className="spr-button primary"
          onClick={() => {
            setError("");
            setLoading(true);
            setRetryKey((value) => value + 1);
          }}
        >
          Try again
        </button>
      </div>
    );

  return (
    <section className="spr-page">
      <header className="spr-header completed-report-header">
        <div>
          <span className="spr-eyebrow">Reports / Performance</span>
          <h1>Staff Performance Report</h1>
          <p>
            Measure productivity, revenue impact, and customer relationships at
            a glance.
          </p>
        </div>
        <div className="spr-header-actions">
          <button
            className="spr-button secondary"
            onClick={() => window.print()}
          >
            Export PDF
          </button>
          <button
            className="spr-button primary"
            onClick={() =>
              downloadCsv("staff-performance-report.csv", exportRows)
            }
          >
            Export Excel
          </button>
        </div>
        <div className="completed-report-total">
          <strong>{filteredInquiries.length}</strong>
          <span>Schedules</span>
        </div>
      </header>

      <div className="spr-filter-bar completed-report-filters">
        <label>
          <span>Staff member</span>
          <select
            value={staff}
            onChange={(event) => setStaff(event.target.value)}
          >
            <option value="">All staff</option>
            {staffOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>From date</span>
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
        </label>
        <label>
          <span>To date</span>
          <input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
          />
        </label>
        <button
          className="spr-button primary spr-search"
          onClick={() => setPage(1)}
        >
          <MiniIcon type="target" /> Apply
        </button>
        <button
          className="spr-reset"
          onClick={() => {
            setStaff("");
            setFromDate("");
            setToDate("");
            setSearch("");
          }}
        >
          Reset
        </button>
      </div>

      <div className="spr-kpi-grid">
        {kpis.map(([label, value, change, icon, direction]) => (
          <article className="spr-kpi" key={label}>
            <div className={`spr-kpi-icon ${icon}`}>
              <MiniIcon type={icon} />
            </div>
            <div className="spr-kpi-label">
              {label}
              <span className={`spr-trend ${direction}`}>
                {direction === "up" ? "↑" : direction === "down" ? "↓" : "•"}{" "}
                {change}
              </span>
            </div>
            <strong>{value}</strong>
          </article>
        ))}
      </div>

      <div className="spr-layout">
        <section className="spr-panel spr-schedule-panel">
          <div className="spr-panel-heading">
            <div>
              <span className="spr-section-kicker">Section 01</span>
              <h2>Schedule analysis</h2>
            </div>
            <span className="spr-period">Last 6 months</span>
          </div>
          <div className="spr-schedule-content">
            <Donut
              completed={
                filteredInquiries.length
                  ? Math.round(
                      (completedCount / filteredInquiries.length) * 100,
                    )
                  : 0
              }
            />
            <div className="spr-status-list">
              {[
                ["Completed", completedCount, colors.completed],
                ["Pending", pendingCount, colors.pending],
                ["Cancelled", cancelledCount, colors.cancelled],
              ].map(([label, value, color]) => (
                <div key={label}>
                  <div>
                    <span>
                      <i style={{ background: color }} />
                      {label}
                    </span>
                    <b>{value}</b>
                  </div>
                  <div className="spr-progress">
                    <i
                      style={{
                        width: `${filteredInquiries.length ? (value / filteredInquiries.length) * 100 : 0}%`,
                        background: color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="spr-panel spr-score-panel">
          <div className="spr-panel-heading">
            <div>
              <span className="spr-section-kicker">At a glance</span>
              <h2>Performance score</h2>
            </div>
            <span className="spr-score-badge">
              {performance >= 90
                ? "Excellent"
                : performance >= 75
                  ? "Good"
                  : performance >= 60
                    ? "Average"
                    : "Needs Work"}
            </span>
          </div>
          <div className="spr-score-body">
            <div className="spr-gauge" style={{ "--score": `${performance}%` }}>
              <div>
                <strong>{performance}%</strong>
                <span>out of 100</span>
              </div>
            </div>
            <div className="spr-score-factors">
              <p>
                <span>Schedule completion</span>
                <b>{completedRate}%</b>
              </p>
              <p>
                <span>Revenue achievement</span>
                <b>{revenueAchievement}%</b>
              </p>
              <p>
                <span>Customer retention</span>
                <b>{uniqueCustomerCount ? "100%" : "0%"}</b>
              </p>
              <p>
                <span>Follow-up completion</span>
                <b>{filteredInquiries.length ? "100%" : "0%"}</b>
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="spr-layout">
        <section className="spr-panel">
          <div className="spr-panel-heading">
            <div>
              <span className="spr-section-kicker">Section 02</span>
              <h2>Revenue analysis</h2>
            </div>
            <span className="spr-legend">
              <i /> Revenue
            </span>
          </div>
          <div className="spr-chart-title">
            <strong>{formatAmount(totalRevenue)}</strong>
            <span>
              generated revenue <em>+18.6%</em>
            </span>
          </div>
          <LineChart data={monthly} />
          <div className="spr-revenue-bottom">
            <BarChart
              values={monthly.map((item) => [item.month, item.revenue])}
            />
            <div className="spr-revenue-stat">
              <span>Best month</span>
              <strong>
                {monthly.length
                  ? monthly.reduce(
                      (best, item) =>
                        item.revenue > best.revenue ? item : best,
                      monthly[0],
                    ).month
                  : "—"}
              </strong>
              <small>
                {monthly.length
                  ? formatAmount(
                      Math.max(...monthly.map((item) => item.revenue)) * 100000,
                    )
                  : "₹0"}{" "}
                generated
              </small>
            </div>
          </div>
        </section>

        <section className="spr-panel">
          <div className="spr-panel-heading">
            <div>
              <span className="spr-section-kicker">Section 05</span>
              <h2>Customer retention</h2>
            </div>
          </div>
          <div className="spr-retention">
            <div className="spr-pie" />
            <div className="spr-retention-list">
              <p>
                <i className="new" />
                <span>New customers</span>
                <b>{uniqueCustomerCount}</b>
              </p>
              <p>
                <i className="existing" />
                <span>Existing customers</span>
                <b>{Math.max(uniqueCustomerCount - repeatCustomerCount, 0)}</b>
              </p>
              <p>
                <i className="repeat" />
                <span>Repeat customers</span>
                <b>{repeatCustomerCount}</b>
              </p>
            </div>
          </div>
        </section>
      </div>

      <section className="spr-panel spr-wide-panel">
        <div className="spr-panel-heading">
          <div>
            <span className="spr-section-kicker">Section 03</span>
            <h2>Customer visit analysis</h2>
            <p>Top 10 customers by visit frequency</p>
          </div>
          <button className="spr-link-button">
            View customer report <span>→</span>
          </button>
        </div>
        <div className="spr-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer name</th>
                <th>Company name</th>
                <th onClick={() => setSortAsc(!sortAsc)}>Total visits ↕</th>
                <th>Last visit date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((row, index) => (
                <tr key={row[0]} className={index < 3 ? "top-visit" : ""}>
                  <td>
                    <span className="spr-customer-avatar">
                      {row[0]
                        .split(" ")
                        .map((word) => word[0])
                        .join("")
                        .slice(0, 2)}
                    </span>
                    <strong>{row[0]}</strong>
                    {index < 3 && <em>Top {index + 1}</em>}
                  </td>
                  <td>{row[1]}</td>
                  <td>
                    <b>{row[2]}</b> visits
                  </td>
                  <td>{row[3]}</td>
                  <td>
                    <span
                      className={`spr-status ${row[4].toLowerCase().replace(" ", "-")}`}
                    >
                      {row[4]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="spr-layout">
        <section className="spr-panel">
          <div className="spr-panel-heading">
            <div>
              <span className="spr-section-kicker">Section 04</span>
              <h2>Product interest</h2>
            </div>
          </div>
          <BarChart
            horizontal
            values={products.map(([label, value]) => [label, value])}
          />
          <div className="spr-product-foot">
            Inquiry count <span>Conversion rate</span>
          </div>
        </section>

        <section className="spr-panel">
          <div className="spr-panel-heading">
            <div>
              <span className="spr-section-kicker">Section 06</span>
              <h2>Monthly performance trend</h2>
            </div>
            <span className="spr-legend">
              <i className="teal" /> Performance %
            </span>
          </div>
          <div className="spr-chart-title">
            <strong>83%</strong>
            <span>
              current performance <em>+4.2 pts</em>
            </span>
          </div>
          <LineChart metric="score" data={monthly} />
        </section>
      </div>
    </section>
  );
}
