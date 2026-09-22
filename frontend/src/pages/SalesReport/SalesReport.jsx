import { useEffect, useState } from "react";
import { authorizedPaymentFetch } from "../paymentPendingApi";
import { getCompletedReportDateRange } from "../CompletedInquiryReport/completedInquiryReport";
import { exportReport } from "../../reportExport";
import "./SalesReport.css";

const API_BASE = import.meta.env.VITE_API_URL || "/crm/api";
const money = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
  });
const displayProductName = (name) => (name === "AMC" ? "New AMC" : name);
const emptyReport = {
  rows: [],
  cards: [],
  products: [],
  resources: [],
  service_counts: { unpaid_service: 0, amc: 0 },
  service_rows: [],
};

export default function SalesReport() {
  const [period, setPeriod] = useState("this-month");
  const [filters, setFilters] = useState(() => ({
    ...getCompletedReportDateRange("this-month"),
    productId: "",
    resourceId: "",
  }));
  const [report, setReport] = useState(emptyReport);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [exporting, setExporting] = useState("");
  const invalidRange =
    period === "custom" && (!filters.fromDate || !filters.toDate)
      ? "Choose both dates to view the report."
      : filters.fromDate && filters.toDate && filters.fromDate > filters.toDate
        ? "From date cannot be after to date."
        : "";

  useEffect(() => {
    if (invalidRange) return;
    const controller = new AbortController();
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          from_date: filters.fromDate,
          to_date: filters.toDate,
          product_id: filters.productId,
          resource_id: filters.resourceId,
        });
        const response = await authorizedPaymentFetch(
          `${API_BASE}/sales-report/?${params}`,
          { signal: controller.signal },
          { apiUrl: API_BASE },
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.detail || "Unable to load Sales report.");
        if (active) setReport(data);
      } catch (requestError) {
        if (active)
          setError(requestError.message || "Unable to load Sales report.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [filters, invalidRange, reload]);

  const changeFilter = (key, value) => {
    setSelectedProduct("");
    setSelectedService("");
    setFilters((current) => ({ ...current, [key]: value }));
  };
  const changePeriod = (value) => {
    setPeriod(value);
    setSelectedProduct("");
    setSelectedService("");
    setFilters((current) => ({
      ...current,
      ...(value === "all"
        ? { fromDate: "", toDate: "" }
        : getCompletedReportDateRange(value)),
    }));
  };
  const serviceRows = report.service_rows
    .filter((row) => row.service_type === selectedService)
    .map((row) => ({
      ...row,
      billing_date: row.completed_date,
      paid_amount: 0,
      remaining_amount: 0,
    }));
  const rows = selectedService
    ? serviceRows
    : report.rows.filter(
        (row) => !selectedProduct || String(row.product_id) === selectedProduct,
      );
  const selectedName = displayProductName(
    report.cards.find((card) => String(card.product_id) === selectedProduct)
      ?.product_name,
  );
  const heading =
    selectedService === "amc"
      ? "AMC services"
      : selectedService === "unpaid_service"
        ? "Unpaid services"
        : selectedName || "All products";
  const totalAmount = report.rows.reduce(
    (sum, row) =>
      sum + Number(row.paid_amount || 0) + Number(row.remaining_amount || 0),
    0,
  );
  const totalRevenue = report.rows.reduce(
    (sum, row) => sum + Number(row.paid_amount || 0),
    0,
  );
  const productSummary = (productId) =>
    report.rows.reduce(
      (summary, row) => {
        if (String(row.product_id) !== String(productId)) return summary;
        const paidAmount = Number(row.paid_amount || 0);
        summary.amount += paidAmount + Number(row.remaining_amount || 0);
        summary.revenueAmount += paidAmount;
        return summary;
      },
      { amount: 0, revenueAmount: 0 },
    );
  const handleExport = async (format) => {
    const serviceExport = Boolean(selectedService);
    setExporting(format);
    try {
      await exportReport({
        format,
        title: "Sales Report",
        filename: "sales-report",
        periodLabel:
          filters.fromDate && filters.toDate
            ? `${filters.fromDate} to ${filters.toDate}`
            : "All time",
        headers: serviceExport
          ? [
              "Completed date",
              "Company name",
              "Product",
              "Resource",
              "Service type",
              "Status",
            ]
          : [
              "Billing date",
              "Company name",
              "Product",
              "Resource",
              "Paid amount",
              "Remaining amount",
            ],
        rows: rows.map((row) =>
          serviceExport
            ? [
                row.billing_date || "",
                row.company_name || "",
                row.product_name || "",
                row.resource_name || "",
                row.service_type === "amc" ? "AMC" : "Unpaid Service",
                "Completed",
              ]
            : [
                row.billing_date || "",
                row.company_name || "",
                row.product_name || "",
                row.resource_name || "",
                Number(row.paid_amount || 0),
                Number(row.remaining_amount || 0),
              ],
        ),
      });
    } finally {
      setExporting("");
    }
  };

  return (
    <section className="sales-report-page">
      <header className="sales-report-header">
        <div>
          <span>PRODUCT BILLING</span>
          <h1>Sales report</h1>
          <p>Explore billed products and their collection balances.</p>
        </div>
      </header>
      <div className="sales-report-filters">
        <label>
          Period
          <select
            value={period}
            onChange={(event) => changePeriod(event.target.value)}
          >
            <option value="today">Today</option>
            <option value="last-7-days">Last 7 days</option>
            <option value="this-month">This month</option>
            <option value="last-month">Last month</option>
            <option value="all">All time</option>
            <option value="custom">Custom period</option>
          </select>
        </label>
        {period === "custom" && (
          <>
            <label>
              From date
              <input
                type="date"
                value={filters.fromDate}
                onChange={(event) =>
                  changeFilter("fromDate", event.target.value)
                }
              />
            </label>
            <label>
              To date
              <input
                type="date"
                value={filters.toDate}
                onChange={(event) => changeFilter("toDate", event.target.value)}
              />
            </label>
          </>
        )}
        <label>
          Resource
          <select
            value={filters.resourceId}
            onChange={(event) => changeFilter("resourceId", event.target.value)}
          >
            <option value="">All resources</option>
            {report.resources.map((resource) => (
              <option key={resource.id} value={resource.id}>
                {resource.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Product
          <select
            value={filters.productId}
            onChange={(event) => changeFilter("productId", event.target.value)}
          >
            <option value="">All products</option>
            {report.products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            setPeriod("this-month");
            setSelectedProduct("");
            setSelectedService("");
            setFilters({
              ...getCompletedReportDateRange("this-month"),
              productId: "",
              resourceId: "",
            });
          }}
        >
          Reset
        </button>
        <div className="report-export-actions">
          <button
            type="button"
            disabled={!rows.length || Boolean(exporting)}
            onClick={() => handleExport("excel")}
          >
            {exporting === "excel" ? "Exporting..." : "Export Excel"}
          </button>
          <button
            type="button"
            disabled={!rows.length || Boolean(exporting)}
            onClick={() => handleExport("pdf")}
          >
            {exporting === "pdf" ? "Exporting..." : "Export PDF"}
          </button>
        </div>
      </div>
      <p className="sales-report-note">
        Billing counts use billing date and bill creator. Service counts use the
        completed schedule date and assigned resource.
      </p>
      {invalidRange ? (
        <p role="status" className="sales-report-state">
          {invalidRange}
        </p>
      ) : loading ? (
        <p role="status" className="sales-report-state">
          Loading sales…
        </p>
      ) : error ? (
        <div role="alert" className="sales-report-state">
          {error}{" "}
          <button type="button" onClick={() => setReload((value) => value + 1)}>
            Retry
          </button>
        </div>
      ) : (
        <>
          <div
            className="sales-report-cards"
            aria-label="Product sales summaries"
          >
            <button
              type="button"
              className={`sales-report-card ${!selectedProduct && !selectedService ? "selected" : ""}`}
              aria-pressed={!selectedProduct && !selectedService}
              onClick={() => {
                setSelectedProduct("");
                setSelectedService("");
              }}
            >
              <span>All products</span>
              <strong>{report.rows.length}</strong>
              <div className="sales-report-card-amounts">
                <small>
                  Amount <b>{money(totalAmount)}</b>
                </small>
                <small>
                  Revenue amount <b>{money(totalRevenue)}</b>
                </small>
              </div>
            </button>
            {report.cards.map((card) => {
              const summary = productSummary(card.product_id);
              return (
                <button
                  type="button"
                  key={card.product_id}
                  className={`sales-report-card ${selectedProduct === String(card.product_id) ? "selected" : ""}`}
                  aria-pressed={selectedProduct === String(card.product_id)}
                  onClick={() => {
                    setSelectedProduct(String(card.product_id));
                    setSelectedService("");
                  }}
                >
                  <span>{displayProductName(card.product_name)}</span>
                  <strong>{card.count}</strong>
                  <div className="sales-report-card-amounts">
                    <small>
                      Amount <b>{money(summary.amount)}</b>
                    </small>
                    <small>
                      Revenue amount <b>{money(summary.revenueAmount)}</b>
                    </small>
                  </div>
                </button>
              );
            })}
            <button
              type="button"
              className={`sales-report-card ${selectedService === "unpaid_service" ? "selected" : ""}`}
              aria-pressed={selectedService === "unpaid_service"}
              onClick={() => {
                setSelectedProduct("");
                setSelectedService("unpaid_service");
              }}
            >
              <span>Unpaid service</span>
              <strong>{report.service_counts?.unpaid_service || 0}</strong>
              <div className="sales-report-card-amounts">
                <small>
                  Amount <b>{money(0)}</b>
                </small>
                <small>
                  Revenue amount <b>{money(0)}</b>
                </small>
              </div>
            </button>
            <button
              type="button"
              className={`sales-report-card ${selectedService === "amc" ? "selected" : ""}`}
              aria-pressed={selectedService === "amc"}
              onClick={() => {
                setSelectedProduct("");
                setSelectedService("amc");
              }}
            >
              <span>AMC Service</span>
              <strong>{report.service_counts?.amc || 0}</strong>
              <div className="sales-report-card-amounts">
                <small>
                  Amount <b>{money(0)}</b>
                </small>
                <small>
                  Revenue amount <b>{money(0)}</b>
                </small>
              </div>
            </button>
          </div>
          <div className="sales-report-grid-heading">
            <h2>{heading}</h2>
            <span>
              {rows.length}{" "}
              {selectedService ? "completed services" : "billed entries"}
            </span>
          </div>
          {rows.length === 0 ? (
            <p className="sales-report-state">
              No {selectedService ? "completed services" : "sales"} match these
              filters.
            </p>
          ) : (
            <div className="sales-report-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>
                      {selectedService ? "Completed date" : "Billing date"}
                    </th>
                    <th>Company name</th>
                    <th>Product</th>
                    <th>Resource</th>
                    <th className="amount">
                      {selectedService ? "Service type" : "Paid amount"}
                    </th>
                    <th className="amount">
                      {selectedService ? "Status" : "Remaining amount"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        {new Date(
                          `${row.billing_date}T00:00:00`,
                        ).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td>{row.company_name || "—"}</td>
                      <td>{row.product_name}</td>
                      <td>{row.resource_name}</td>
                      <td className="amount">
                        {selectedService
                          ? row.service_type === "amc"
                            ? "AMC"
                            : "Unpaid Service"
                          : money(row.paid_amount)}
                      </td>
                      <td className="amount">
                        {selectedService
                          ? "Completed"
                          : money(row.remaining_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {!selectedService && (
                  <tfoot>
                    <tr>
                      <th colSpan="4">Total</th>
                      <td className="amount">
                        {money(
                          rows.reduce(
                            (sum, row) => sum + Number(row.paid_amount),
                            0,
                          ),
                        )}
                      </td>
                      <td className="amount">
                        {money(
                          rows.reduce(
                            (sum, row) => sum + Number(row.remaining_amount),
                            0,
                          ),
                        )}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
