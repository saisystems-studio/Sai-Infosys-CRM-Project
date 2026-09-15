import axios from "axios";
import { useEffect, useRef, useState } from "react";
import "./ProductBilling.css";

const API = import.meta.env.VITE_API_URL || "/crm/api";

const empty = {
  contact_number: "",
  customer_id: "",
  customer_name: "",
  company_name: "",
  license_details: "",
  license_options: [],
  license_id: "",
  is_new_license: false,
  license_type_id: "",
  license_admin_id: "",
  license_expiry_date: "",
};

const newProductLine = () => ({
  product_id: "",
  rate: "",
  quantity: "1",
  has_gst: false,
});

export default function ProductBilling() {
  const [form, setForm] = useState(empty);
  const [products, setProducts] = useState([]);
  const [productLines, setProductLines] = useState([newProductLine()]);
  const [licenseTypes, setLicenseTypes] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const activeContactRef = useRef("");

  const headers = {
    Authorization: `Bearer ${localStorage.getItem("crm_access_token")}`,
  };

  const set = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  // Load products
  useEffect(() => {
    Promise.all([
      axios.get(`${API}/product-types/`, { headers }),
      axios.get(`${API}/license-types/`, { headers }),
    ])
      .then(([productResponse, licenseTypeResponse]) => {
        setProducts(productResponse.data || []);
        setLicenseTypes(licenseTypeResponse.data || []);
      })
      .catch(() => setError("Unable to load products."));
  }, []);

  useEffect(() => {
    if (!message) return undefined;

    const timer = window.setTimeout(() => setMessage(""), 2500);
    return () => window.clearTimeout(timer);
  }, [message]);

  // Customer Lookup
  const lookup = async (contactNumber) => {
    setError("");
    try {
      const r = await axios.get(`${API}/product-billing/customer-lookup/`, {
        headers,
        params: { contact_number: contactNumber },
      });
      setForm((current) =>
        current.contact_number === contactNumber
          ? { ...current, ...r.data }
          : current,
      );
    } catch (e) {
      setForm((current) =>
        current.contact_number === contactNumber
          ? { ...current, customer_id: "" }
          : current,
      );
      if (activeContactRef.current === contactNumber) {
        setError(e.response?.data?.detail || "Customer lookup failed.");
      }
    }
  };

  const handleContactNumberChange = (event) => {
    const contactNumber = event.target.value.replace(/\D/g, "").slice(0, 10);
    activeContactRef.current = contactNumber;
    setError("");

    setForm((current) => ({
      ...current,
      contact_number: contactNumber,
      ...(contactNumber.length < 10
        ? {
            customer_id: "",
            customer_name: "",
            company_name: "",
            license_details: "",
            license_options: [],
            license_id: "",
            is_new_license: false,
            license_type_id: "",
            license_admin_id: "",
            license_expiry_date: "",
          }
        : {}),
    }));

    if (contactNumber.length === 10) {
      lookup(contactNumber);
    }
  };

  // Save Bill
  const save = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const r = await axios.post(
        `${API}/product-billing/`,
        { ...form, products: productLines.map((line) => ({
          ...line,
          amount: (Number(line.rate || 0) * Number(line.quantity || 0)).toFixed(2),
        })) },
        { headers },
      );
      setMessage(r.data.detail);
      setForm(empty);
      setProductLines([newProductLine()]);
    } catch (e) {
      setError(e.response?.data?.detail || "Unable to save the product bill.");
    }
  };

  const updateProductLine = (index, key, value) => {
    setProductLines((current) => current.map((line, lineIndex) =>
      lineIndex === index ? { ...line, [key]: value } : line,
    ));
  };
  const removeProductLine = (index) => {
    setProductLines((current) => current.length === 1
      ? current : current.filter((_, lineIndex) => lineIndex !== index));
  };
  const productTotals = productLines.map((line) => {
    const product = products.find((item) => String(item.Id) === String(line.product_id));
    const amount = Number(line.rate || 0) * Number(line.quantity || 0);
    const gstPercentage = Number(product?.gst_percentage || 0);
    const gst = line.has_gst ? (amount * gstPercentage) / 100 : 0;
    return { product, amount, gstPercentage, gst };
  });
  const subtotal = productTotals.reduce((total, line) => total + line.amount, 0);
  const gstAmount = productTotals.reduce((total, line) => total + line.gst, 0);
  const grandTotal = subtotal + gstAmount;

  return (
    <section className="product-billing-page">
      <header>
        <span>Finance / Billing</span>
        <h1>Product Billing</h1>
        <p>Create a bill for an existing customer.</p>
      </header>

      {message && (
        <p className="success billing-toast" role="status">
          {message}
        </p>
      )}

      <div className="billing-layout">
        {/* Main Form Column */}
        <form onSubmit={save} className="billing-form">
          <h2>Customer details</h2>
          <div className="grid customer">
            <label>
              <span>Customer contact number</span>
              <div className="lookup-group">
                <input
                  required
                  value={form.contact_number}
                  onChange={handleContactNumberChange}
                  placeholder="e.g. 9876543210"
                />
              </div>
            </label>
            <Field label="Customer name" value={form.customer_name} readOnly />
            <Field label="Company name" value={form.company_name} readOnly />
          </div>

          <h2>Product details</h2>
          <div className="product-list" aria-label="Product list">
            <div className="product-list-head" aria-hidden="true">
              <span>Product</span><span>Rate</span><span>Quantity</span><span>Amount</span><span />
            </div>
            {productLines.map((line, index) => {
              const totals = productTotals[index];
              return <div className="product-line" key={index}>
                <label><span>Product</span><select required value={line.product_id} onChange={(e) => updateProductLine(index, "product_id", e.target.value)}><option value="">Select product</option>{products.map((p) => <option key={p.Id} value={p.Id}>{p.product_type_name}</option>)}</select></label>
                <Field label="Rate" type="number" value={line.rate} onChange={(e) => updateProductLine(index, "rate", e.target.value)} />
                <Field label="Quantity" type="number" value={line.quantity} onChange={(e) => updateProductLine(index, "quantity", e.target.value)} />
                <Field label="Amount" type="number" value={totals.amount.toFixed(2)} readOnly />
                <button type="button" className="btn-remove-product" onClick={() => removeProductLine(index)} disabled={productLines.length === 1} aria-label={`Remove product ${index + 1}`}>×</button>
                <div className="product-tax-info">
                  <label className="gst-applicable"><input type="checkbox" checked={line.has_gst} onChange={(e) => updateProductLine(index, "has_gst", e.target.checked)} /><span>GST applicable</span></label>
                  <span>GST: <strong>{totals.product ? `${totals.gstPercentage}%` : "—"}</strong></span>
                  <span>HSN: <strong>{totals.product?.hsn_code || "Not configured"}</strong></span>
                </div>
              </div>;
            })}
            <button type="button" className="btn-add-product" onClick={() => setProductLines((current) => [...current, newProductLine()])}>+ Add product</button>
          </div>

          <div className="license-section-header">
            <span>License details</span>
            <button
              type="button"
              className="btn-new-license"
              disabled={!form.customer_id}
              onClick={() => setForm((current) => ({
                ...current,
                is_new_license: true,
                license_id: "",
                license_type_id: "",
                license_admin_id: "",
                license_expiry_date: "",
                license_details: "",
              }))}
            >
              + New license
            </button>
          </div>
          <div className="license-selection">
            <label>
              <span>Serial number</span>
              {form.is_new_license ? (
                <input
                  required
                  inputMode="numeric"
                  maxLength="9"
                  value={form.license_details}
                  placeholder="Enter 9-digit serial number"
                  onChange={(e) => set(
                    "license_details",
                    e.target.value.replace(/\D/g, "").slice(0, 9),
                  )}
                />
              ) : (
                <select
                  value={form.license_id}
                  disabled={!form.customer_id}
                  onChange={(e) => {
                    const license = form.license_options.find(
                      (item) => String(item.id) === e.target.value,
                    );
                    setForm((current) => ({
                      ...current,
                      license_id: e.target.value,
                      license_type_id: license?.license_type_id || "",
                      license_admin_id: license?.admin_id || "",
                      license_expiry_date: "",
                      license_details: license?.serial_number || "",
                    }));
                  }}
                >
                  <option value="">
                    {form.customer_id ? "Select serial number" : "Select a customer first"}
                  </option>
                  {form.license_options.map((license) => (
                    <option key={license.id} value={license.id}>
                      {license.serial_number || "No serial number"}
                    </option>
                  ))}
                </select>
              )}
            </label>
            <label>
              <span>License type</span>
              <select
                value={form.license_type_id}
                disabled={!form.license_id && !form.is_new_license}
                required={Boolean(form.license_id || form.is_new_license)}
                onChange={(e) => set("license_type_id", e.target.value)}
              >
                <option value="">Select license type</option>
                {licenseTypes.map((licenseType) => (
                  <option key={licenseType.Id} value={licenseType.Id}>
                    {licenseType.license_type_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Admin ID</span>
              <input
                required={Boolean(form.license_id || form.is_new_license)}
                value={form.license_admin_id}
                disabled={!form.license_id && !form.is_new_license}
                placeholder="Enter Admin ID"
                onChange={(e) => set("license_admin_id", e.target.value)}
              />
            </label>
            <label>
              <span>Expiry date</span>
              <input
                type="date"
                value={form.license_expiry_date}
                disabled={!form.license_id && !form.is_new_license}
                required={Boolean(form.license_id || form.is_new_license)}
                onChange={(e) => set("license_expiry_date", e.target.value)}
              />
            </label>
          </div>

          {error && <p className="error">{error}</p>}

          <footer>
            <button
              type="button"
              onClick={() => { setForm(empty); setProductLines([newProductLine()]); }}
              className="btn-reset"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={!form.customer_id}
              className="btn-save"
            >
              Save bill
            </button>
          </footer>
        </form>

        {/* Right Side Summary Column */}
        <aside className="bill-summary">
          <h3>Bill Summary</h3>
          <div className="summary-row">
            <span>Subtotal</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          {gstAmount > 0 && (
            <div className="summary-row">
              <span>GST</span>
              <span>₹{gstAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="summary-divider"></div>
          <div className="summary-total">
            <span>Total</span>
            <span>₹{grandTotal.toFixed(2)}</span>
          </div>
        </aside>
      </div>
    </section>
  );
}

// Reusable Field Component
function Field({ label, ...props }) {
  return (
    <label>
      <span>{label}</span>
      <input
        required={!props.readOnly}
        min={props.type === "number" ? "0" : undefined}
        step={props.type === "number" ? "0.01" : undefined}
        {...props}
      />
    </label>
  );
}
