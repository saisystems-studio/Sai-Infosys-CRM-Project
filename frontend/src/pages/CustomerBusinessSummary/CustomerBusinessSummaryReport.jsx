import axios from "axios";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  ThemeProvider,
  createTheme,
  Autocomplete,
} from "@mui/material";
import {
  FiCheckCircle,
  FiClock,
  FiDollarSign,
  FiEye,
  FiMessageSquare,
  FiSearch,
} from "react-icons/fi";
import {
  buildReport,
  buildTaskRows,
  dateLabel,
  money,
  validateFilters,
} from "./reportModel";
import { DataTable, ExportButtons, Section, StatusBadge } from "./ReportComponents";
import { downloadReport } from "./reportExport";
import "../CompletedInquiryReport/CompletedInquiryReport.css";
import "./CustomerBusinessSummaryReport.css";

const apiUrl = import.meta.env.VITE_API_URL || "/crm/api";

const theme = createTheme({
  palette: {
    primary: { main: "#595bd4" },
    text: { primary: "#272b44", secondary: "#778096" },
  },
  typography: {
    fontFamily: '"Inter", "Segoe UI", sans-serif',
    button: { textTransform: "none", fontWeight: 600 },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { boxShadow: "none", padding: "5px 12px", fontSize: "12px" },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: { "& .MuiInputBase-root": { fontSize: "12px", height: "34px" } },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: "#eef0f6", fontSize: 12, padding: "7px 10px" },
        head: {
          background: "#f8f9fc",
          color: "#69738b",
          fontWeight: 600,
          whiteSpace: "nowrap",
          fontSize: 11,
          padding: "7px 10px",
        },
      },
    },
  },
});

const inquiryColumns = [
  { key: "date", label: "Date", render: dateLabel },
  { key: "recordType", label: "Type" },
  { key: "product", label: "Product Name" },
  {
    key: "status",
    label: "Status",
    render: (value) => <StatusBadge value={value} />,
  },
  { key: "expectedRevenue", label: "Amount", numeric: true, render: money },
  {
    key: "revenueAmount",
    label: "Revenue Amount",
    numeric: true,
    render: money,
  },
];

const taskTime = (value) =>
  value && !Number.isNaN(Date.parse(value))
    ? new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "?";

const taskColumns = [
  { key: "date", label: "Date", render: dateLabel },
  { key: "product", label: "Product" },
  { key: "start", label: "Task Start", render: taskTime },
  { key: "end", label: "Task End Time", render: taskTime },
  { key: "duration", label: "Duration", sortable: false },
  { key: "remark", label: "Remark" },
];

function Kpi({ title, value, icon, note, tone = "purple", children }) {
  return (
    <div className={`cbs-kpi ${tone}`}>
      <div className="cbs-kpi-top">
        <span className="cbs-kpi-icon">{icon}</span>
        <span>{title}</span>
      </div>
      <div className="cbs-kpi-value">
        {children || <strong>{value}</strong>}
      </div>
      <small>{note}</small>
    </div>
  );
}

export default function CustomerBusinessSummaryReport() {
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState(null);
  const [filters, setFilters] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const detailRequest = useRef(0);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [selectedBill, setSelectedBill] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [exporting, setExporting] = useState("");

  useEffect(() => {
    const loadReportData = async () => {
      try {
        const response = await axios.get(
          `${apiUrl}/customer-business-summary/`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("crm_access_token")}`,
            },
          },
        );
        const result = response.data;
        setData(result);
        const dates = [
          ...result.inquiries,
          ...result.schedules,
          ...result.transactions,
          ...(result.productBills || []),
        ]
          .map((row) => row.date)
          .filter(Boolean)
          .sort();
        const initialFilters = {
          customerId: result.customers[0]?.id || "",
          from: dates[0] || new Date().toISOString().slice(0, 10),
          to: dates.at(-1) || new Date().toISOString().slice(0, 10),
        };
        setDraft(initialFilters);
        setFilters(initialFilters);
        // Set initial input value to company name only
        const initialCustomer = result.customers.find(
          (c) => c.id === initialFilters.customerId,
        );
        if (initialCustomer) {
          setInputValue(initialCustomer.company);
        }
      } catch (error) {
        setLoadError(
          error.response?.data?.detail ||
            error.message ||
            "Unable to load customer report data.",
        );
      }
    };
    loadReportData();
  }, []);

  const report = useMemo(
    () => (data && filters ? buildReport(data, filters) : null),
    [data, filters],
  );

  if (loadError)
    return (
      <Alert severity="error" className="cbs-alert">
        {loadError}
      </Alert>
    );
  if (!report || !draft)
    return (
      <main className="cbs-report">
        <div className="cbs-empty">Loading customer report...</div>
      </main>
    );
  if (!report.customer)
    return (
      <main className="cbs-report">
        <div className="cbs-empty">No customers found in the database.</div>
      </main>
    );

  const reportKey = `${filters.customerId}-${filters.from}-${filters.to}`;
  const changed = Object.keys(draft).some((key) => draft[key] !== filters[key]);
  const field = (key) => (event) =>
    setDraft({ ...draft, [key]: event.target.value });

  const selectCustomer = (event, newValue) => {
    const customerId = newValue?.id || "";
    setDraft({ ...draft, customerId });
    // Clearing the picker edits the draft; keep the last valid report visible.
    if (newValue) setFilters({ ...filters, customerId });
    setError("");
    setSelectedInquiry(null);
    setDetailError("");
    // Update input value to show just the company name
    if (newValue) {
      setInputValue(newValue.company);
    } else {
      setInputValue("");
    }
  };

  const applyFilters = (event) => {
    event.preventDefault();
    const message = validateFilters(draft, data.customers);
    setError(message);
    if (!message) setFilters({ ...draft });
  };

  const handleExport = async (format) => {
    setExporting(format);
    try {
      await downloadReport(format, report);
    } finally {
      setExporting("");
    }
  };

  const closeDetails = () => {
    detailRequest.current += 1;
    setDetailOpen(false);
    setDetailLoading(false);
    setSelectedInquiry(null);
    setSelectedBill(null);
    setDetailError("");
  };

  const selectInquiry = async (inquiry) => {
    const requestId = ++detailRequest.current;
    setDetailOpen(true);
    setSelectedInquiry(null);
    setSelectedBill(null);
    setDetailError("");
    if (inquiry.recordType === "Product Billing") {
      setSelectedBill(inquiry);
      setDetailLoading(false);
      return;
    }
    setDetailLoading(true);
    try {
      const response = await axios.get(
        `${apiUrl}/inquiries/${inquiry.id.replace("i-", "")}/task-detail/`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("crm_access_token")}`,
          },
        },
      );
      const detail = response.data;
      if (requestId === detailRequest.current) setSelectedInquiry(detail);
    } catch (detailLoadError) {
      if (requestId === detailRequest.current)
        setDetailError(
          detailLoadError.response?.data?.detail || detailLoadError.message,
        );
    } finally {
      if (requestId === detailRequest.current) setDetailLoading(false);
    }
  };

  // Get the currently selected customer for display
  const selectedCustomer = data.customers.find(
    (c) => c.id === draft.customerId,
  );

  return (
    <ThemeProvider theme={theme}>
      <main className="cbs-report">
        <header className="cbs-page-heading spr-header completed-report-header">
          <div>
            <span className="spr-eyebrow">Reports / Customer intelligence</span>
            <h1>Customer Business Summary Report</h1>
            <p>
              A complete view of your customer's journey, value, and next
              opportunity.
            </p>
          </div>
          <div className="completed-report-total">
            <strong>{report.inquiries.length}</strong>
            <span>Inquiries</span>
          </div>
        </header>

        <form className="cbs-filters" onSubmit={applyFilters}>
          <Autocomplete
            id="customer-autocomplete"
            className="cbs-customer-select"
            size="small"
            options={data.customers}
            getOptionLabel={(option) => option.company} // Only show company name in input
            value={selectedCustomer || null}
            inputValue={inputValue}
            onInputChange={(event, newInputValue) => {
              setInputValue(newInputValue);
            }}
            onChange={selectCustomer}
            isOptionEqualToValue={(option, value) => option.id === value?.id}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Customer"
                size="small"
                placeholder="Type to search customer..."
                InputLabelProps={{ shrink: !!inputValue || undefined }}
              />
            )}
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    fontSize: "12px",
                    padding: "4px 0",
                  }}
                >
                  <strong style={{ fontSize: "13px" }}>{option.company}</strong>
                  <span style={{ color: "#778096", fontSize: "11px" }}>
                    {option.name}
                  </span>
                </div>
              </li>
            )}
            ListboxProps={{
              style: {
                fontSize: "12px",
                maxHeight: "200px",
              },
            }}
            noOptionsText="No customers found"
            disableClearable={false}
            freeSolo={false}
            filterOptions={(options, state) => {
              // Custom filter to search both company and name
              const searchTerm = state.inputValue.toLowerCase().trim();
              if (!searchTerm) return options;
              return options.filter(
                (option) =>
                  option.company.toLowerCase().includes(searchTerm) ||
                  option.name.toLowerCase().includes(searchTerm),
              );
            }}
          />

          <TextField
            label="From Date"
            type="date"
            size="small"
            value={draft.from}
            onChange={field("from")}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{
              "& .MuiInputBase-root": { height: "34px", fontSize: "12px" },
              width: "150px",
            }}
          />
          <TextField
            label="To Date"
            type="date"
            size="small"
            value={draft.to}
            onChange={field("to")}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{
              "& .MuiInputBase-root": { height: "34px", fontSize: "12px" },
              width: "150px",
            }}
          />
          <Button
            variant="contained"
            type="submit"
            startIcon={<FiSearch />}
            size="small"
          >
            Search
          </Button>
          <ExportButtons onExport={handleExport} busy={exporting} />
        </form>

        {error && (
          <Alert severity="error" className="cbs-alert">
            {error}
          </Alert>
        )}

        <div className="cbs-period" aria-live="polite">
          <span>
            <span className="cbs-live-dot" /> {report.customer.company}{" "}
            <span className="cbs-period-divider">|</span>{" "}
            {dateLabel(filters.from)} – {dateLabel(filters.to)}
          </span>
          <span>
            {changed
              ? "Unapplied changes — click Search"
              : "Live database records · All amounts in INR"}
          </span>
        </div>

        <div className="cbs-kpi-grid">
          <Kpi
            title="Total Inquiries"
            value={report.inquiries.length}
            icon={<FiMessageSquare />}
            note="Customer requests in this period"
          />
          <Kpi
            title="Completed Inquiries"
            value={report.completedInquiries.length}
            icon={<FiCheckCircle />}
            note="Completed customer inquiries"
            tone="green"
          />
          <Kpi
            title="In Progress Inquiries"
            value={report.inProgressInquiries.length}
            icon={<FiClock />}
            note="Inquiries with active work"
            tone="blue"
          />
          <Kpi
            title="Not Started Inquiries"
            value={report.notStartedInquiries.length}
            icon={<FiMessageSquare />}
            note="No task activity recorded"
            tone="amber"
          />
          <Kpi
            title="Total Revenue"
            value={money(report.totalRevenue)}
            icon={<FiDollarSign />}
            note="Recorded payments in this period"
            tone="green"
          />
        </div>

        <Section>
          <DataTable
            key={reportKey}
            rows={report.summaryRows}
            fixedPageSize={10}
            columns={[
              ...inquiryColumns,
              {
                key: "action",
                label: "Action",
                sortable: false,
                render: (_, inquiry) => (
                  <IconButton
                    size="small"
                    color="primary"
                    aria-label={`View ${inquiry.product || "inquiry"} details`}
                    title={inquiry.recordType === "Product Billing" ? "View product bill details" : "View inquiry details"}
                    onClick={() => selectInquiry(inquiry)}
                  >
                    <FiEye size={18} />
                  </IconButton>
                ),
              },
            ]}
            title="inquiries and product bills"
          />
        </Section>

        <Dialog
          open={detailOpen}
          onClose={closeDetails}
          fullWidth
          maxWidth="lg"
          aria-labelledby="cbs-detail-title"
        >
          <DialogTitle id="cbs-detail-title">{selectedBill ? "Product Billing Details" : "Inquiry Details"}</DialogTitle>
          <DialogContent dividers>
            {selectedBill && <>
              <div className="cbs-detail-summary">
                <strong>{report.customer.company || report.customer.name} · Bill #{selectedBill.billId}</strong>
                <StatusBadge value={selectedBill.status} />
              </div>
              <DataTable rows={[selectedBill]} fixedPageSize={10} title="Product bill details" columns={[
                { key: "date", label: "Bill Date", render: dateLabel },
                { key: "product", label: "Product" },
                { key: "serialNumber", label: "Serial Number", render: value => value || "—" },
                { key: "quantity", label: "Quantity", numeric: true },
                { key: "rate", label: "Rate", numeric: true, render: money },
                { key: "gst", label: "GST", numeric: true, render: money },
                { key: "expectedRevenue", label: "Bill Total", numeric: true, render: money },
                { key: "totalPaid", label: "Total Paid", numeric: true, render: money },
                { key: "balance", label: "Balance", numeric: true, render: money },
              ]} />
              <p>Revenue Amount in the report includes payments recorded in the selected period. Total Paid and Balance show all payments for this bill.</p>
            </>}
            {detailLoading && (
              <div role="status">Loading inquiry details...</div>
            )}
            {detailError && <Alert severity="error">{detailError}</Alert>}
            {selectedInquiry && (
              <>
                <div className="cbs-detail-summary">
                  <strong>{selectedInquiry.customer_name}</strong>
                  <StatusBadge value={selectedInquiry.status_name} />
                </div>
                {selectedInquiry.task_progress?.length ? (
                  <DataTable
                    rows={buildTaskRows(selectedInquiry)}
                    fixedPageSize={10}
                    columns={taskColumns}
                    title="Inquiry task details"
                  />
                ) : (
                  <div className="cbs-empty">
                    No task records found for this inquiry.
                  </div>
                )}
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDetails}>Close</Button>
          </DialogActions>
        </Dialog>

        <footer className="cbs-footer">
          <span>Sai Infosys CRM · Customer intelligence</span>
          <span>Database records · Selected-period metrics · INR</span>
        </footer>
      </main>
    </ThemeProvider>
  );
}
