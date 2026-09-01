import { useCallback, useEffect, useMemo, useState } from "react";
import "./InquiryPage.css";
import { createInquiryEditState } from "./inquiryEdit";

/* =========================================================
   API CONFIGURATION
   ========================================================= */

const API_BASE = "http://127.0.0.1:8000/api";
const MASTER_API = API_BASE;

/* =========================================================
   EMPTY PRODUCT
   ========================================================= */

const emptyProduct = () => ({
  id: crypto.randomUUID(),
  product: "",
  quantity: 1,
  rate: "",
  requirement: "",
});

/* =========================================================
   EMPTY CUSTOMER
   ========================================================= */

const emptyCustomer = () => ({
  name: "",
  email: "",
  serial: "",
  expiry: "",
});

/* =========================================================
   ICON COMPONENT
   ========================================================= */

const Icon = ({ name }) => {
  const paths = {
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),

    box: (
      <>
        <path d="m21 8-9 5-9-5 9-5 9 5Z" />
        <path d="m3 8 9 5 9-5M12 13v9" />
      </>
    ),

    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7h.01" />
      </>
    ),

    plus: <path d="M12 5v14M5 12h14" />,

    trash: (
      <>
        <path d="M4 7h16" />
        <path d="M9 7V4h6v3" />
        <path d="M7 7l1 13h8l1-13" />
      </>
    ),

    save: (
      <>
        <path d="M5 3h12l2 2v16H5V3Z" />
        <path d="M8 3v6h8V3M9 17h6" />
      </>
    ),

    arrow: (
      <>
        <path d="m9 18-6-6 6-6M3 12h18" />
      </>
    ),
  };

  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
};

/* =========================================================
   DATE FORMAT HELPER
   ========================================================= */

const normalizeDateForInput = (value) => {
  if (!value) {
    return "";
  }

  const stringValue = String(value).trim();

  /* YYYY-MM-DD */
  if (/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) {
    return stringValue;
  }

  /* ISO datetime */
  if (/^\d{4}-\d{2}-\d{2}T/.test(stringValue)) {
    return stringValue.substring(0, 10);
  }

  /* DD-MM-YYYY */
  if (/^\d{2}-\d{2}-\d{4}$/.test(stringValue)) {
    const [day, month, year] = stringValue.split("-");
    return `${year}-${month}-${day}`;
  }

  /* DD/MM/YYYY */
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(stringValue)) {
    const [day, month, year] = stringValue.split("/");
    return `${year}-${month}-${day}`;
  }

  return "";
};

/* =========================================================
   MAIN COMPONENT
   ========================================================= */

function InquiryPage({ onCancel, editData = null, isEdit = false }) {
  const initialEditState =
    isEdit && editData ? createInquiryEditState(editData) : null;

  /* =========================================================
     CUSTOMER
     ========================================================= */

  const [phone, setPhone] = useState(initialEditState?.phone ?? "");

  /*
   * Actual customer ID returned by backend.
   */
  const [customerId, setCustomerId] = useState(
    initialEditState?.customerId ?? "",
  );

  const [customer, setCustomer] = useState(
    initialEditState?.customer ?? emptyCustomer(),
  );

  /* =========================================================
     MASTER DATA
     ========================================================= */

  const [products, setProducts] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [sources, setSources] = useState([]);
  const [resources, setResources] = useState([]);
  const [resourceLoading, setResourceLoading] = useState(true);

  const [masterLoading, setMasterLoading] = useState(true);

  /* =========================================================
     INQUIRY DATA
     ========================================================= */

  const [items, setItems] = useState(
    initialEditState?.items.length ? initialEditState.items : [emptyProduct()],
  );

  const [rating, setRating] = useState(initialEditState?.rating ?? "");
  const [schedule, setSchedule] = useState(initialEditState?.schedule ?? "");

  /*
   * RESOURCE IS JUST AN ID.
   *
   * No foreign-key assumption here.
   */
  const [resource, setResource] = useState(initialEditState?.resource ?? "");

  const [source, setSource] = useState(initialEditState?.source ?? "");
  const [status, setStatus] = useState(initialEditState?.status ?? "");

  /* =========================================================
     UI STATE
     ========================================================= */

  const [message, setMessage] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  /* =========================================================
     AUTH HEADER
     ========================================================= */

  const getHeaders = useCallback(() => {
    const token =
      localStorage.getItem("crm_access_token") ||
      localStorage.getItem("access_token");

    const headers = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }, []);

  /* =========================================================
     GET NEW STATUS
     ========================================================= */

  const getNewStatusId = useCallback(() => {
    const newStatus = statuses.find(
      (item) =>
        String(item.status_type_name || "")
          .trim()
          .toLowerCase() === "new",
    );

    return newStatus ? String(newStatus.Id) : "";
  }, [statuses]);

  /* =========================================================
     LOAD MASTER DATA
     ========================================================= */

  useEffect(() => {
    let cancelled = false;

    const loadMasters = async () => {
      setMasterLoading(true);

      try {
        const headers = getHeaders();

        const [
          productResponse,
          ratingResponse,
          statusResponse,
          sourceResponse,
        ] = await Promise.all([
          fetch(`${MASTER_API}/product-types/`, {
            method: "GET",
            headers,
          }),

          fetch(`${MASTER_API}/rating-types/`, {
            method: "GET",
            headers,
          }),

          fetch(`${MASTER_API}/status-types/`, {
            method: "GET",
            headers,
          }),

          fetch(`${MASTER_API}/source-types/`, {
            method: "GET",
            headers,
          }),
        ]);

        if (!productResponse.ok) {
          throw new Error(`Product master failed: ${productResponse.status}`);
        }

        if (!ratingResponse.ok) {
          throw new Error(`Rating master failed: ${ratingResponse.status}`);
        }

        if (!statusResponse.ok) {
          throw new Error(`Status master failed: ${statusResponse.status}`);
        }

        if (!sourceResponse.ok) {
          throw new Error(`Source master failed: ${sourceResponse.status}`);
        }

        const productData = await productResponse.json();
        const ratingData = await ratingResponse.json();
        const statusData = await statusResponse.json();
        const sourceData = await sourceResponse.json();

        console.log("PRODUCT MASTERS:", productData);
        console.log("RATING MASTERS:", ratingData);
        console.log("STATUS MASTERS:", statusData);
        console.log("SOURCE MASTERS:", sourceData);

        if (cancelled) {
          return;
        }

        setProducts(Array.isArray(productData) ? productData : []);
        setRatings(Array.isArray(ratingData) ? ratingData : []);
        setStatuses(Array.isArray(statusData) ? statusData : []);
        setSources(Array.isArray(sourceData) ? sourceData : []);

        /* =====================================================
           DEFAULT STATUS = NEW
           ===================================================== */

        const newStatus = statusData.find(
          (item) =>
            String(item.status_type_name || "")
              .trim()
              .toLowerCase() === "new",
        );

        if (newStatus && !isEdit) {
          setStatus(String(newStatus.Id));

          console.log(
            "DEFAULT STATUS:",
            newStatus.status_type_name,
            "ID:",
            newStatus.Id,
          );
        } else {
          setStatus("");

          console.warn('Status "New" was not found in StatusTypeMaster.');
        }
      } catch (error) {
        console.error("MASTER API ERROR:", error);

        if (!cancelled) {
          setProducts([]);
          setRatings([]);
          setStatuses([]);
          setSources([]);

          setMessage("Unable to load master data.");
        }
      } finally {
        if (!cancelled) {
          setMasterLoading(false);
        }
      }
    };

    loadMasters();

    return () => {
      cancelled = true;
    };
  }, [getHeaders, isEdit]);

  useEffect(() => {
    let cancelled = false;

    const loadResources = async () => {
      setResourceLoading(true);

      try {
        const response = await fetch(`${API_BASE}/inquiries/resources/`, {
          method: "GET",
          headers: getHeaders(),
        });

        if (!response.ok) {
          throw new Error(`Resource list failed: ${response.status}`);
        }

        const data = await response.json();
        if (!cancelled) {
          setResources(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error("RESOURCE API ERROR:", error);
        if (!cancelled) {
          setResources([]);
        }
      } finally {
        if (!cancelled) {
          setResourceLoading(false);
        }
      }
    };

    loadResources();

    return () => {
      cancelled = true;
    };
  }, [getHeaders]);

  /* =========================================================
     TOTAL
     ========================================================= */

  const total = useMemo(() => {
    return items.reduce((sum, item) => {
      const quantity = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;

      return sum + quantity * rate;
    }, 0);
  }, [items]);

  /* =========================================================
     PRODUCT UPDATE
     ========================================================= */

  const updateItem = (id, field, value) => {
    setItems((rows) =>
      rows.map((row) =>
        row.id === id
          ? {
              ...row,
              [field]: value,
            }
          : row,
      ),
    );
  };

  /* =========================================================
     CUSTOMER LOOKUP
     ========================================================= */

  const lookupCustomer = useCallback(
    async (phoneNumber) => {
      const cleanPhone = String(phoneNumber || "").replace(/\D/g, "");

      if (cleanPhone.length !== 10) {
        return;
      }

      setIsSearching(true);
      setMessage("");

      try {
        const response = await fetch(
          `${API_BASE}/customers/?phone=${cleanPhone}`,
          {
            method: "GET",
            headers: getHeaders(),
          },
        );

        const data = await response.json();

        console.log("CUSTOMER API RESPONSE:", data);

        if (!response.ok) {
          throw new Error(`Customer API failed: ${response.status}`);
        }

        /* =====================================================
           CUSTOMER NOT FOUND
           ===================================================== */

        if (!Array.isArray(data) || data.length === 0) {
          setCustomerId("");
          setCustomer(emptyCustomer());
          setRating("");

          setMessage("Customer not found.");

          return;
        }

        const customerData = data[0];

        console.log("CUSTOMER RECORD:", customerData);

        /* =====================================================
           CUSTOMER ID
           ===================================================== */

        const foundCustomerId =
          customerData.Id ?? customerData.id ?? customerData.customer_id;

        console.log("CUSTOMER ID:", foundCustomerId);

        if (
          foundCustomerId !== null &&
          foundCustomerId !== undefined &&
          foundCustomerId !== ""
        ) {
          setCustomerId(String(foundCustomerId));
        } else {
          setCustomerId("");
        }

        /* =====================================================
           LICENSE
           ===================================================== */

        const license =
          Array.isArray(customerData.licenses) &&
          customerData.licenses.length > 0
            ? customerData.licenses[0]
            : null;

        /* =====================================================
           CUSTOMER DETAILS
           ===================================================== */

        setCustomer({
          name: customerData.customer_name || "",
          email: customerData.email_id || "",
          serial: license?.tally_serial_number || "",
          expiry: normalizeDateForInput(license?.expiry_date || ""),
        });

        /* =====================================================
           CUSTOMER RATING
           ===================================================== */

        const customerRatingId =
          customerData.customer_rating_id ??
          customerData.customer_rating?.Id ??
          customerData.customer_rating?.id ??
          customerData.customer_rating;

        console.log("CUSTOMER RATING FROM API:", customerData.customer_rating);

        console.log("CUSTOMER RATING ID:", customerRatingId);

        if (
          customerRatingId !== null &&
          customerRatingId !== undefined &&
          customerRatingId !== ""
        ) {
          setRating(String(customerRatingId));
        } else {
          setRating("");
        }

        setMessage("Customer details found.");
      } catch (error) {
        console.error("CUSTOMER LOOKUP ERROR:", error);

        setCustomerId("");
        setCustomer(emptyCustomer());
        setRating("");

        setMessage("Unable to fetch customer.");
      } finally {
        setIsSearching(false);
      }
    },
    [getHeaders],
  );

  /* =========================================================
     AUTOMATIC PHONE SEARCH
     ========================================================= */

  useEffect(() => {
    const cleanPhone = phone.replace(/\D/g, "");

    if (cleanPhone.length !== 10) {
      return;
    }

    const timer = setTimeout(() => {
      lookupCustomer(cleanPhone);
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [phone, lookupCustomer]);

  /* =========================================================
     PHONE CHANGE
     ========================================================= */

  const handlePhoneChange = (event) => {
    const value = event.target.value.replace(/\D/g, "").slice(0, 10);

    setPhone(value);

    if (value.length < 10) {
      setCustomerId("");
      setCustomer(emptyCustomer());
      setRating("");
      setMessage("");
    }
  };

  /* =========================================================
     CLEAR FORM AFTER SUCCESS
     ========================================================= */

  const clearFormAfterSave = () => {
    console.log("CLEARING INQUIRY FORM...");

    /* Customer */
    setPhone("");
    setCustomerId("");
    setCustomer(emptyCustomer());

    /* Product rows */
    setItems([emptyProduct()]);

    /* Dropdowns / inputs */
    setRating("");
    setSchedule("");
    setResource("");
    setSource("");

    /*
     * Keep Status = New
     */
    const newStatusId = getNewStatusId();

    setStatus(newStatusId);

    /* Searching state */
    setIsSearching(false);

    console.log("INQUIRY FORM CLEARED.");
  };

  /* =========================================================
     RESET
     ========================================================= */

  const reset = () => {
    clearFormAfterSave();

    setMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  /* =========================================================
     SUBMIT
     ========================================================= */

  const submit = async (event) => {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    /* =======================================================
       VALIDATION
       ======================================================= */

    if (!phone || phone.length !== 10) {
      setMessage("Please enter a valid 10-digit phone number.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (!customerId) {
      setMessage(
        "Customer ID not found. Please enter a registered phone number.",
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (!schedule) {
      setMessage("Please select Schedule Date.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (!resource) {
      setMessage("Please select Resource.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (!status) {
      setMessage("Please select Status.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (items.length === 0) {
      setMessage("Please add at least one product.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (items.some((item) => !item.product)) {
      setMessage("Please select a product for every row.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    /* =======================================================
       RATE VALIDATION
       ======================================================= */

    if (
      items.some(
        (item) =>
          item.rate === "" || item.rate === null || item.rate === undefined,
      )
    ) {
      setMessage("Please enter rate for every product.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    /* =======================================================
       SELECTED MASTER OBJECTS
       ======================================================= */

    /* =======================================================
       PRODUCT DETAILS
       ======================================================= */

    /*
     * IMPORTANT:
     *
     * requirement is now included.
     *
     * Backend receives:
     *
     * {
     *   product: 1,
     *   qty: 2,
     *   rate: 500,
     *   requirement: "Customer requirement"
     * }
     */

    const selectedProducts = items.map((item) => ({
      product: Number(item.product),
      qty: Number(item.quantity) || 0,
      rate: Number(item.rate) || 0,
      requirement: item.requirement?.trim() || "",
    }));

    /* =======================================================
       REQUEST DATA
       ======================================================= */

    const inquiryData = {
      /* Customer ID */
      customer_id: Number(customerId),

      /* Products */
      products: selectedProducts,

      /* Rating ID */
      customer_rating_id: rating ? Number(rating) : null,

      /* Schedule */
      schedule_date: schedule,

      /*
       * RESOURCE ID ONLY
       *
       * This sends the selected resource value as an integer.
       */
      resource_id: Number(resource),

      /* Status ID */
      status_id: Number(status),

      /* Source ID */
      source_id: source ? Number(source) : null,

      /* Total */
      total: Number(total) || 0,
    };

    console.log("=================================================");
    console.log("POSTING INQUIRY:");
    console.log(JSON.stringify(inquiryData, null, 2));
    console.log("=================================================");

    try {
      setIsSaving(true);
      setMessage(isEdit ? "Updating inquiry..." : "Saving inquiry...");

      const inquiryId = editData?.id ?? editData?.Id;
      const response = await fetch(
        isEdit
          ? `${API_BASE}/inquiries/${inquiryId}/`
          : `${API_BASE}/inquiries/`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: getHeaders(),
          body: JSON.stringify(inquiryData),
        },
      );

      const responseText = await response.text();

      console.log("INQUIRY API STATUS:", response.status);

      console.log("INQUIRY API RESPONSE:", responseText);

      /* =====================================================
         ERROR
         ===================================================== */

      if (!response.ok) {
        let errorMessage = responseText;

        try {
          const errorData = JSON.parse(responseText);

          console.error("INQUIRY VALIDATION ERROR:", errorData);

          errorMessage = JSON.stringify(errorData);
        } catch {
          // Keep original response
        }

        throw new Error(
          `Inquiry save failed (${response.status}): ${errorMessage}`,
        );
      }

      /* =====================================================
         SUCCESS RESPONSE
         ===================================================== */

      let savedInquiry = null;

      if (responseText) {
        try {
          savedInquiry = JSON.parse(responseText);
        } catch {
          savedInquiry = responseText;
        }
      }

      console.log("INQUIRY SAVED SUCCESSFULLY:", savedInquiry);

      /* =====================================================
         CLEAR ALL FORM DATA
         ===================================================== */

      if (!isEdit) clearFormAfterSave();

      /* =====================================================
         SUCCESS MESSAGE
         ===================================================== */

      setMessage(
        isEdit
          ? "Inquiry updated successfully."
          : "Inquiry saved successfully.",
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });

      window.setTimeout(() => {
        onCancel?.();
      }, 800);
    } catch (error) {
      console.error("INQUIRY SAVE ERROR:", error);

      /*
       * IMPORTANT:
       *
       * Do NOT clear the form when save fails.
       * User can correct the invalid data and submit again.
       */

      setMessage(error.message || "Unable to save inquiry.");

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } finally {
      setIsSaving(false);
    }
  };

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <div className="inquiry-page">
      {/* =====================================================
          TITLE
          ===================================================== */}

      <header className="inquiry-titlebar">
        <div>
          <button type="button" className="back-button" onClick={onCancel}>
            <Icon name="arrow" />
          </button>

          <div>
            <p>INQUIRIES / {isEdit ? "EDIT INQUIRY" : "NEW INQUIRY"}</p>

            <h1>{isEdit ? "Edit Inquiry" : "Add New Inquiry"}</h1>
          </div>
        </div>
      </header>

      {/* =====================================================
          TOP MESSAGE
          ===================================================== */}

      {message && (
        <div
          className={`form-message ${
            message.includes("success") || message.includes("found")
              ? "success"
              : ""
          }`}
          role="status"
        >
          {message}
        </div>
      )}

      {/* =====================================================
          FORM
          ===================================================== */}

      <form className="inquiry-form" onSubmit={submit}>
        {/* ===================================================
            CUSTOMER INFORMATION
            =================================================== */}

        <section className="form-section">
          <div className="section-heading">
            <span>
              <Icon name="user" />
            </span>

            <div>
              <h2>Customer Information</h2>

              <p>
                Enter the registered phone number to automatically find the
                customer.
              </p>
            </div>
          </div>

          <div className="field-grid customer-grid">
            {/* PHONE */}

            <label>
              Phone Number *
              <div className="phone-field">
                <input
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="Enter 10-digit phone number"
                  inputMode="numeric"
                  maxLength={10}
                  autoComplete="tel"
                />

                {isSearching && (
                  <span className="phone-loading">Searching...</span>
                )}
              </div>
            </label>

            {/* CUSTOMER NAME */}

            <label>
              Customer Name
              <input
                value={customer.name}
                readOnly
                placeholder="Auto-filled from customer"
              />
            </label>

            {/* EMAIL */}

            <label>
              Email Address
              <input
                value={customer.email}
                readOnly
                placeholder="Auto-filled from customer"
              />
            </label>

            {/* TALLY SERIAL */}

            <label className="span-two">
              Tally Serial Number
              <input
                value={customer.serial}
                readOnly
                placeholder="Auto-filled from customer"
              />
            </label>

            {/* EXPIRY */}

            <label>
              Expiry Date
              <input type="date" value={customer.expiry} readOnly />
            </label>
          </div>
        </section>

        {/* ===================================================
            PRODUCT DETAILS
            =================================================== */}

        <section className="form-section">
          <div className="section-heading">
            <span>
              <Icon name="box" />
            </span>

            <div>
              <h2>Product Details *</h2>

              <p>Add one or more products requested by the customer.</p>
            </div>

            <button
              type="button"
              className="add-product"
              onClick={() => setItems((rows) => [...rows, emptyProduct()])}
              disabled={masterLoading}
            >
              <Icon name="plus" />
              Add Product
            </button>
          </div>

          <div className="product-table">
            {/* PRODUCT HEADER */}

            <div className="product-row product-head">
              <span>PRODUCT *</span>

              <span>QTY</span>

              <span>RATE *</span>

              <span>AMOUNT</span>

              <span>REQUIREMENT</span>

              <span>ACTION</span>
            </div>

            {/* PRODUCT ROWS */}

            {items.map((item) => (
              <div className="product-row" key={item.id}>
                {/* PRODUCT */}

                <select
                  aria-label="Product"
                  value={item.product}
                  onChange={(event) =>
                    updateItem(item.id, "product", event.target.value)
                  }
                  disabled={masterLoading}
                >
                  <option value="">
                    {masterLoading ? "Loading Products..." : "Select Product"}
                  </option>

                  {products.map((product) => (
                    <option key={product.Id} value={product.Id}>
                      {product.product_type_name}
                    </option>
                  ))}
                </select>

                {/* QUANTITY */}

                <input
                  aria-label="Quantity"
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(event) =>
                    updateItem(item.id, "quantity", event.target.value)
                  }
                />

                {/* RATE */}

                <input
                  aria-label="Rate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.rate}
                  onChange={(event) =>
                    updateItem(item.id, "rate", event.target.value)
                  }
                  placeholder="0.00"
                />

                {/* AMOUNT */}

                <input
                  aria-label="Amount"
                  value={(
                    (Number(item.quantity) || 0) * (Number(item.rate) || 0)
                  ).toFixed(2)}
                  readOnly
                />

                {/* REQUIREMENT */}

                <input
                  aria-label="Requirement"
                  value={item.requirement}
                  onChange={(event) =>
                    updateItem(item.id, "requirement", event.target.value)
                  }
                  placeholder="Special requirements"
                />

                {/* DELETE */}

                <button
                  type="button"
                  className="remove-row"
                  disabled={items.length === 1}
                  onClick={() =>
                    setItems((rows) => rows.filter((row) => row.id !== item.id))
                  }
                  aria-label="Remove product"
                >
                  <Icon name="trash" />
                </button>
              </div>
            ))}

            {/* TOTAL */}

            <div className="total-row">
              <span>Estimated total</span>

              <strong>
                ₹
                {total.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </strong>
            </div>
          </div>
        </section>

        {/* ===================================================
            ADDITIONAL INFORMATION - ADDED BACK WITH SINGLE ROW
            =================================================== */}

        <section className="form-section">
          <div className="section-heading">
            <span>
              <Icon name="info" />
            </span>

            <div>
              <h2>Additional Information</h2>

              <p>Set the follow-up priority and ownership.</p>
            </div>
          </div>

          <div className="field-grid additional-grid">
            {/* SOURCE */}

            <label>
              Source
              <select
                value={source}
                onChange={(event) => setSource(event.target.value)}
                disabled={masterLoading}
              >
                <option value="">
                  {masterLoading ? "Loading Sources..." : "Select Source"}
                </option>

                {sources.map((item) => (
                  <option key={item.Id} value={item.Id}>
                    {item.source_type_name}
                  </option>
                ))}
              </select>
            </label>

            {/* RESOURCE - Now matches other fields in size */}

            <label>
              Resource *
              <select
                value={resource}
                onChange={(event) => setResource(event.target.value)}
                disabled={resourceLoading}
              >
                <option value="">
                  {resourceLoading ? "Loading Staff..." : "Select Resource"}
                </option>

                {resources.map((staff) => (
                  <option key={staff.Id} value={staff.Id}>
                    {staff.Full_Name}
                  </option>
                ))}
              </select>
            </label>

            {/* STATUS - Display as badge/read-only */}

            <label>
              Status
              <div className="status-display">
                {statuses.find((s) => String(s.Id) === String(status))
                  ?.status_type_name || "New"}
              </div>
            </label>

            {/* SCHEDULE */}

            <label>
              Schedule Date *
              <input
                type="date"
                value={schedule}
                onChange={(event) => setSchedule(event.target.value)}
              />
            </label>
          </div>
        </section>

        {/* ===================================================
            ACTIONS
            =================================================== */}

        <footer className="form-actions">
          <button className="save-button" type="submit" disabled={isSaving}>
            <Icon name="save" />

            {isSaving
              ? isEdit
                ? "Updating..."
                : "Saving..."
              : isEdit
                ? "Update Inquiry"
                : "Save Inquiry"}
          </button>

          <button type="button" onClick={reset} disabled={isSaving}>
            Reset
          </button>

          <button type="button" onClick={onCancel} disabled={isSaving}>
            Cancel
          </button>
        </footer>
      </form>
    </div>
  );
}

export default InquiryPage;
