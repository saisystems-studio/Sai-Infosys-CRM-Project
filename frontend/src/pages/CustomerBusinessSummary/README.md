# Customer Business Summary Report

React + Material UI report with Recharts, real XLSX workbooks (ExcelJS), and paginated PDF downloads (jsPDF/AutoTable). The report is lazy-loaded from the dashboard and export libraries load on demand.

## Open the report

- The CRM Reports menu loads the report from `/crm/api/customer-business-summary/`. Apply backend migrations using the project's configured Python environment: `python manage.py migrate`. Migration `0016_customer_business_summary_report_menu` adds the menu. Only Super Admin can access the report.

## Data contract and calculations

The report uses authorized API responses backed by the CRM database. It does not generate or display sample records. In this schema, schedule rows are represented by `InquiryDetails_tbl.Shedule_Date` and `Status_Id`; there is no `ScheduleDetails_tbl` table.

All metrics are for the selected customer and inclusive From/To period. Inquiry counts use inquiry dates; schedule counts use appointment dates and their recorded status; revenue uses transaction dates. Timeline events use their own occurrence dates. Customer profile and created date remain lifetime attributes; last follow-up and last inquiry/schedule refer to the selected period.

- Revenue is summed only from `PaymentDetail_tbl.Amount`, never from inquiry estimates or duplicated timeline events.
- The summary grid combines inquiries and product bills, with a Type column identifying their source. Bills use their creation date for the inclusive customer/date filters; inquiry counts remain inquiry-only. Billing payments contribute to Total Revenue by payment date, including payments for bills created outside the selected period. The bill detail dialog shows lifetime Total Paid and Balance; grid Revenue Amount uses only payments within the selected period.
- Expected revenue is the sum of selected inquiry estimates. Achievement = current / expected × 100, or N/A when expected is zero. Numeric achievement can exceed 100%; progress displays cap at 100%.
- Repeat inquiries = max(inquiry count - 1, 0). Repeat visits = max(completed appointment count - 1, 0). Visits and completed tasks both count completed appointments in this demo schema.
- Products interested counts unique products in inquiries. Product/resource totals also include relevant schedules and payments, even without a new inquiry in the period.
- Most interested product sorts by inquiry count, then revenue, then name for deterministic ties.

### Engagement assumptions

The requested weights do not specify component normalization. This implementation makes the following demo assumptions visible in the UI and exports:

| Component              | Weight | Normalization                                                             |
| ---------------------- | ------ | ------------------------------------------------------------------------- |
| Repeat inquiry         | 30%    | Three repeat inquiries earns full credit                                  |
| Completed schedules    | 30%    | Completed / all schedules                                                 |
| Revenue contribution   | 25%    | Current / expected revenue, capped at 100%                                |
| Activity participation | 15%    | Calendar months with an activity / months touched by the reporting period |

Missing denominators contribute zero. The weighted score is rounded to an integer before applying thresholds: 90+ Highly Engaged, 75+ Active Customer, 60+ Moderate Customer, otherwise Low Engagement. Adjust normalization in `reportModel.js` when business targets are agreed.

## Exports and verification

Top exports include all selected-period report sections in eight Excel worksheets or PDF sections. Detailed-table exports include every row matching that table's search and sort, across all pages. Charts are represented by their underlying data in the PDF. All monetary values are INR; spreadsheet cells retain numeric types. Strings are written as text rather than formulas.

Run `node --test src/pages/CustomerBusinessSummary/*.test.js`, `npm.cmd run build`, and `npx.cmd eslint src/pages/CustomerBusinessSummary` from `frontend`.
