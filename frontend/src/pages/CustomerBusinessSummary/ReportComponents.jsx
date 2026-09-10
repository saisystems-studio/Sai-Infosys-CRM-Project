import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
} from "@mui/material";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FiDownload, FiFileText } from "react-icons/fi";
import { clamp, filterAndSort } from "./reportModel";

const palette = ["#5a5bd6", "#34a897", "#efb04f", "#df748c"];

export function Section({
  title,
  eyebrow,
  subtitle,
  action,
  children,
  className = "",
}) {
  return (
    <Paper
      component="section"
      elevation={0}
      className={`cbs-section ${className}`}
    >
      <div className="cbs-section-heading">
        <div>
          {eyebrow && <span className="cbs-eyebrow">{eyebrow}</span>}
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </Paper>
  );
}

export function Gauge({
  value,
  color = "#5a5bd6",
  size = 100,
  label = "Score",
}) {
  return (
    <Box className="cbs-gauge" sx={{ width: size, height: size }}>
      <CircularProgress
        variant="determinate"
        value={100}
        size={size}
        thickness={4}
        sx={{ color: "#edf0f6", position: "absolute" }}
        aria-hidden="true"
      />
      <CircularProgress
        variant="determinate"
        value={clamp(value)}
        size={size}
        thickness={4}
        sx={{
          color,
          position: "absolute",
          "& .MuiCircularProgress-circle": { strokeLinecap: "round" },
        }}
        aria-label={label}
      />
      <div>
        <strong style={{ color, fontSize: size < 80 ? 17 : 25 }}>
          {value == null ? "N/A" : `${value}%`}
        </strong>
        {size >= 100 && <small>{label}</small>}
      </div>
    </Box>
  );
}

export function Meter({ label, value, detail, color = "#5a5bd6" }) {
  return (
    <div className="cbs-meter">
      <div>
        <span>{label}</span>
        <strong>{detail ?? `${Math.round(value || 0)}%`}</strong>
      </div>
      <LinearProgress
        variant="determinate"
        value={clamp(value)}
        aria-label={label}
        sx={{
          height: 7,
          borderRadius: 8,
          bgcolor: "#eef0f6",
          "& .MuiLinearProgress-bar": { bgcolor: color, borderRadius: 8 },
        }}
      />
    </div>
  );
}

export function StatusBadge({ value }) {
  const tone = ["Completed", "Paid", "Won", "Highly Engaged"].includes(value)
    ? "green"
    : ["Cancelled", "Closed", "Low Engagement"].includes(value)
      ? "rose"
      : ["Pending", "Open", "Moderate Customer", "Warm"].includes(value)
        ? "amber"
        : "purple";
  return (
    <Chip size="small" label={value || "—"} className={`cbs-badge ${tone}`} />
  );
}

export function ExportButtons({ onExport, busy, compact = false }) {
  return (
    <div className="cbs-export-buttons">
      <Button
        size="small"
        variant="outlined"
        startIcon={<FiDownload />}
        disabled={Boolean(busy)}
        onClick={() => onExport("excel")}
      >
        {busy === "excel" ? "Exporting…" : compact ? "Excel" : "Export Excel"}
      </Button>
      <Button
        size="small"
        variant="outlined"
        startIcon={<FiFileText />}
        disabled={Boolean(busy)}
        onClick={() => onExport("pdf")}
      >
        {busy === "pdf" ? "Exporting…" : compact ? "PDF" : "Export PDF"}
      </Button>
    </div>
  );
}

export function DataTable({
  rows,
  columns,
  title,
  onExport,
  busy,
  defaultSort = "date",
  fixedPageSize,
  onRowClick,
}) {
  const [order, setOrder] = useState("desc");
  const [orderBy, setOrderBy] = useState(defaultSort);
  const [page, setPage] = useState(0);
  const [selectedPageSize, setPageSize] = useState(5);
  const pageSize = fixedPageSize ?? selectedPageSize;
  const filtered = filterAndSort(rows, "", orderBy, order);
  const safePage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / pageSize) - 1),
  );
  return (
    <div>
      {onExport && (
        <div className="cbs-table-toolbar">
          <ExportButtons
            compact
            busy={busy}
            onExport={(format) => onExport(format, filtered)}
          />
        </div>
      )}
      <TableContainer>
        <Table size="small" aria-label={title}>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  align={column.numeric ? "right" : "left"}
                  sortDirection={orderBy === column.key ? order : false}
                >
                  {column.sortable === false ? column.label : <TableSortLabel
                    active={orderBy === column.key}
                    direction={orderBy === column.key ? order : "asc"}
                    onClick={() => {
                      setOrder(
                        orderBy === column.key && order === "asc"
                          ? "desc"
                          : "asc",
                      );
                      setOrderBy(column.key);
                      setPage(0);
                    }}
                  >
                    {column.label}
                  </TableSortLabel>}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered
              .slice(safePage * pageSize, (safePage + 1) * pageSize)
              .map((row) => (
                <TableRow
                  key={row.id}
                  hover
                  onClick={() => onRowClick?.(row)}
                  className={onRowClick ? "cbs-clickable-row" : ""}
                >
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      align={column.numeric ? "right" : "left"}
                    >
                      {column.render
                        ? column.render(row[column.key], row)
                        : (row[column.key] ?? "—")}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {!filtered.length && (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <div className="cbs-empty">
                    No matching records. Try another search or reporting period.
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={filtered.length}
        page={safePage}
        onPageChange={(_, next) => setPage(next)}
        rowsPerPage={pageSize}
        rowsPerPageOptions={fixedPageSize ? [] : [5, 10, 25]}
        onRowsPerPageChange={(event) => {
          setPageSize(Number(event.target.value));
          setPage(0);
        }}
      />
    </div>
  );
}

export function Bars({
  data,
  dataKey,
  label,
  horizontal = false,
  color = palette[0],
}) {
  if (!data.some((row) => row[dataKey] > 0))
    return (
      <div className="cbs-empty cbs-chart-empty">
        No {label.toLowerCase()} in this period.
      </div>
    );
  return (
    <div
      className="cbs-chart"
      role="img"
      aria-label={`${label}: ${data.map((row) => `${row.name} ${row[dataKey]}`).join(", ")}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{
            top: 10,
            right: 22,
            bottom: 6,
            left: horizontal ? 10 : -15,
          }}
        >
          <CartesianGrid
            strokeDasharray="3 4"
            vertical={false}
            stroke="#edf0f6"
          />
          <XAxis
            type={horizontal ? "number" : "category"}
            dataKey={horizontal ? undefined : "name"}
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <YAxis
            type={horizontal ? "category" : "number"}
            dataKey={horizontal ? "name" : undefined}
            width={horizontal ? 130 : 45}
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "#f3f4fc" }}
            contentStyle={{ borderRadius: 10, border: "1px solid #e8eaf2" }}
          />
          <Bar
            dataKey={dataKey}
            name={label}
            fill={color}
            radius={horizontal ? [0, 5, 5, 0] : [5, 5, 0, 0]}
            maxBarSize={26}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Distribution({
  data,
  label,
  donut = false,
  format = (value) => value,
}) {
  const total = data.reduce((sum, row) => sum + row.value, 0);
  return (
    <div className="cbs-distribution">
      <div
        className="cbs-pie"
        role="img"
        aria-label={`${label}: ${data.map((row) => `${row.name} ${format(row.value)}`).join(", ")}`}
      >
        {total ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={donut ? "66%" : 0}
                outerRadius="88%"
                paddingAngle={2}
                isAnimationActive={false}
              >
                {data.map((row, index) => (
                  <Cell key={row.name} fill={palette[index % palette.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => format(value)} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="cbs-empty">No data</div>
        )}
        {donut && total > 0 && (
          <div className="cbs-pie-center">
            <strong>{total}</strong>
            <small>schedules</small>
          </div>
        )}
      </div>
      <div className="cbs-legend">
        {data.map((row, index) => (
          <div key={row.name}>
            <span>
              <i style={{ background: palette[index % palette.length] }} />
              {row.name}
            </span>
            <strong>{format(row.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
