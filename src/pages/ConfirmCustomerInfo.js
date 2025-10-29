import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { BACKEND_URL } from "../config";
import UserHeader from "../components/UserHeader";

function ConfirmCustomerInfo() {
  const location = useLocation();
  const navigate = useNavigate();
  const phone = location.state?.phone;
  const customerId = location.state?.customerId;
  const waiverId = location.state?.waiverId;
  const viewOnly = location.state?.viewOnly || false;
  const isReturning = location.state?.isReturning || false;

  const [formData, setFormData] = useState(null);
  const [originalData, setOriginalData] = useState(null);
  const [originalMinors, setOriginalMinors] = useState([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [waiverInfo, setWaiverInfo] = useState(null);

  // Route protection: Redirect if accessed directly without valid state
  useEffect(() => {
    if (!phone && !customerId && !waiverId) {
      console.warn("No phone, customerId, or waiverId found in state, redirecting to home");
      navigate("/", { replace: true });
    }
  }, [phone, customerId, waiverId, navigate]);
  const [minorList, setMinorList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [minorErrors, setMinorErrors] = useState({});

  useEffect(() => {
    if (phone || waiverId) {
      setLoading(true);

      // If viewing a specific waiver, use snapshot endpoint
      const endpoint = waiverId
        ? `${BACKEND_URL}/api/waivers/waiver-snapshot?waiverId=${waiverId}`
        : customerId
        ? `${BACKEND_URL}/api/waivers/customer-info-by-id?customerId=${customerId}`
        : `${BACKEND_URL}/api/waivers/customer-info?phone=${phone}`;

      axios
        .get(endpoint)
        .then((res) => {
          const data = res.data.customer;

          // ✅ Convert numbers into masked format if exists
          const formatPhone = (num) => {
            if (!num) return "";
            const digits = num.replace(/\D/g, "").slice(0, 10);
            if (digits.length === 10) {
              return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
            }
            return digits;
          };

          data.home_phone = formatPhone(data.home_phone);
          data.cell_phone = formatPhone(data.cell_phone);
          data.work_phone = formatPhone(data.work_phone);

          // ✅ Format DOB for date input (YYYY-MM-DD)
          if (data.dob) {
            data.dob = new Date(data.dob).toISOString().split("T")[0];
          }

          data.can_email = data.can_email === 1 || data.can_email === "1";
          setFormData(data);
          
          // Store waiver info (rules_accepted, completed) when viewing a waiver
          if (waiverId && res.data.waiver) {
            setWaiverInfo(res.data.waiver);
          }
          
          // Store original data for comparison when viewing a waiver
          if (waiverId) {
            setOriginalData(JSON.parse(JSON.stringify(data)));
          }

          if (res.data.minors) {
            const minorsWithFlags = res.data.minors.map((minor) => ({
              ...minor,
              dob: minor.dob
                ? new Date(minor.dob).toISOString().split("T")[0]
                : "",
              checked: waiverId ? true : (minor.status === 1), // Always check minors when viewing waiver
              isNew: false,
            }));
            setMinorList(minorsWithFlags);
            
            // Store original minors for comparison when viewing a waiver
            if (waiverId) {
              setOriginalMinors(JSON.parse(JSON.stringify(minorsWithFlags)));
            }
          }
        })
        .catch((err) => {
          console.error(err);
          toast.error(
            err?.response?.data?.message || "Failed to fetch customer info.",
          );
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [phone, customerId, waiverId]);

  // const handleChange = (e) => {
  //   const { name, value, type } = e.target;
  //   setFormData((prev) => ({
  //     ...prev,
  //     [name]: type === "number" ? Number(value) : value,
  //   }));
  // };

  const handleChange = (e) => {
    const { name, value } = e.target;

    // ✅ If it's a phone → only store masked for UI
    if (["cell_phone"].includes(name)) {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const validateMinorField = (index, field, value) => {
    const errorKey = `${index}_${field}`;
    const errors = { ...minorErrors };

    if (field === "first_name" || field === "last_name") {
      if (!value || value.trim() === "") {
        errors[errorKey] = `This field is required`;
      } else if (value.trim().length < 2) {
        errors[errorKey] = `Must be at least 2 characters`;
      } else {
        delete errors[errorKey];
      }
    } else if (field === "dob") {
      if (!value) {
        errors[errorKey] = "This field is required";
      } else {
        const dobDate = new Date(value);
        const today = new Date();
        if (dobDate > today) {
          errors[errorKey] = "Date cannot be in the future";
        } else {
          delete errors[errorKey];
        }
      }
    }

    setMinorErrors(errors);
  };

  const handleMinorChange = (index, field, value) => {
    const updated = [...minorList];
    updated[index][field] = value;
    setMinorList(updated);

    // Validate all minors when editing
    if (updated[index].isNew) {
      validateMinorField(index, field, value);
    }
  };

  const validateAllNewMinors = () => {
    const errors = {};
    minorList.forEach((minor, index) => {
      if (minor.isNew) {
        if (!minor.first_name || minor.first_name.trim() === "") {
          errors[`${index}_first_name`] = "This field is required";
        }
        if (!minor.last_name || minor.last_name.trim() === "") {
          errors[`${index}_last_name`] = "This field is required";
        }
        if (!minor.dob) {
          errors[`${index}_dob`] = "This field is required";
        }
      }
    });
    setMinorErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const removeMinor = (index) => {
    const updated = [...minorList];
    updated.splice(index, 1);
    setMinorList(updated);

    // Clear validation errors for removed minor and reindex errors
    const newErrors = {};
    Object.keys(minorErrors).forEach((key) => {
      const [errorIndex, field] = key.split("_");
      const idx = parseInt(errorIndex);
      if (idx < index) {
        newErrors[key] = minorErrors[key];
      } else if (idx > index) {
        newErrors[`${idx - 1}_${field}`] = minorErrors[key];
      }
    });
    setMinorErrors(newErrors);
  };

  // Function to detect if any modifications were made
  const hasModifications = () => {
    if (!waiverId || !originalData || !originalMinors) {
      return false; // Not viewing a waiver, so no modification detection needed
    }

    // Check for new minors added
    const newMinorsAdded = minorList.some(m => m.isNew);
    if (newMinorsAdded) return true;

    // Check if number of minors changed
    if (minorList.length !== originalMinors.length) return true;

    // Check for changes in minor checked status or data
    for (let i = 0; i < minorList.length; i++) {
      const current = minorList[i];
      const original = originalMinors.find(m => m.id === current.id);
      
      if (!original) return true; // Minor was removed or added
      
      // Check if checked status changed
      if (current.checked !== original.checked) return true;
      
      // Check if minor data changed (shouldn't happen as fields are readonly, but checking anyway)
      if (current.first_name !== original.first_name ||
          current.last_name !== original.last_name ||
          current.dob !== original.dob) {
        return true;
      }
    }

    return false;
  };

  const goToSignature = async () => {
    // Validate all new minors and show errors
    const isValid = validateAllNewMinors();
    if (!isValid) {
      toast.error("Please complete all required fields for new minors.");
      return;
    }

    // Validate dates are not in the future
    const newMinors = minorList.filter((minor) => minor.isNew);
    const minorsWithFutureDOB = newMinors.filter((minor) => {
      if (!minor.dob) return false;
      const dobDate = new Date(minor.dob);
      const today = new Date();
      return dobDate > today;
    });

    if (minorsWithFutureDOB.length > 0) {
      toast.error("Date of birth cannot be in the future for any minor.");
      return;
    }

    // Check if viewing a waiver and modifications were made
    if (waiverId && hasModifications()) {
      // Show confirmation dialog
      setShowConfirmDialog(true);
      return;
    }

    // If no modifications or not viewing a waiver, proceed normally
    proceedToSignature();
  };

  const proceedToSignature = async () => {
    setShowConfirmDialog(false);
    
    const isModified = hasModifications();
    const stripMask = (val) => (val ? val.replace(/\D/g, "") : "");
    const updatedData = {
      ...formData,
      cell_phone: stripMask(formData.cell_phone),
      minors: minorList.map((minor) => ({
        id: minor.id,
        first_name: minor.first_name,
        last_name: minor.last_name,
        dob: minor.dob,
        isNew: minor.isNew,
        checked: minor.checked,
      })),
    };

    // Only update customer data if modifications were made
    if (isModified) {
      setUpdating(true);
      try {
        await axios.post(
          `${BACKEND_URL}/api/waivers/update-customer`,
          updatedData,
        );
      } catch (err) {
        console.error("Error updating customer:", err);
        toast.error("Failed to update customer info.");
        setUpdating(false);
        return;
      } finally {
        setUpdating(false);
      }
    }

    // Always navigate to signature page
    // Pass viewCompleted flag to skip rules if waiver is already completed
    navigate("/signature", {
      replace: true,
      state: {
        phone,
        formData: updatedData,
        customerId: formData.id,
        isReturning,
        waiverId: isModified ? null : waiverId, // Clear waiverId if modified to create new waiver
        createNewWaiver: isModified, // Flag to indicate this should create a new waiver
        viewMode: !isModified && waiverId, // View mode if viewing without modifications
        viewCompleted: !isModified && waiverId && waiverInfo?.rules_accepted === 1, // Skip rules if completed
      },
    });
  };
  if (loading || !formData) {
    return <div className="text-center mt-5">Loading customer info...</div>;
  }

  return (
    <>
      <UserHeader showBack={true} backTo="/my-waivers" backState={{ phone }} />
      <div className="container-fluid">
        <div className="container text-center">
        <div className="row">
          <div className="col-md-12 col-xl-10 mx-auto">
            <h3 className="h5-heading">
              Please confirm that all information below is still accurate
            </h3>

            <form>
              <div className="info-table w-100">
                <table cellPadding="8" cellSpacing="0">
                  <tbody>
                    <tr>
                      <td>
                        Participant First Name:
                        <br />
                        <input
                          type="text"
                          name="first_name"
                          value={formData.first_name || ""}
                          onChange={handleChange}
                          className="form-control"
                          readOnly
                          style={{
                            backgroundColor: "#e9ecef",
                            cursor: "not-allowed",
                          }}
                        />
                      </td>
                      <td>
                        Participant Last Name:
                        <br />
                        <input
                          type="text"
                          name="last_name"
                          value={formData.last_name || ""}
                          onChange={handleChange}
                          className="form-control"
                          readOnly
                          style={{
                            backgroundColor: "#e9ecef",
                            cursor: "not-allowed",
                          }}
                        />
                      </td>

                      <td>
                        Date of Birth:
                        <br />
                        <input
                          type="date"
                          name="dob"
                          value={formData.dob || ""}
                          onChange={handleChange}
                          className="form-control"
                          readOnly
                          style={{
                            backgroundColor: "#e9ecef",
                            cursor: "not-allowed",
                          }}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td>
                        Address:
                        <br />
                        <input
                          type="text"
                          name="address"
                          value={formData.address || ""}
                          onChange={handleChange}
                          className="form-control"
                          readOnly
                          style={{
                            backgroundColor: "#e9ecef",
                            cursor: "not-allowed",
                          }}
                        />
                      </td>
                      <td>
                        City:
                        <br />
                        <input
                          type="text"
                          name="city"
                          value={formData.city || ""}
                          onChange={handleChange}
                          className="form-control"
                          readOnly
                          style={{
                            backgroundColor: "#e9ecef",
                            cursor: "not-allowed",
                          }}
                        />
                      </td>
                      <td>
                        Province:
                        <br />
                        <input
                          type="text"
                          name="province"
                          value={formData.province || ""}
                          onChange={handleChange}
                          className="form-control"
                          readOnly
                          style={{
                            backgroundColor: "#e9ecef",
                            cursor: "not-allowed",
                          }}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td>
                        Postal Code:
                        <br />
                        <input
                          type="text"
                          name="postal_code"
                          value={formData.postal_code || ""}
                          onChange={handleChange}
                          className="form-control"
                          readOnly
                          style={{
                            backgroundColor: "#e9ecef",
                            cursor: "not-allowed",
                          }}
                        />
                      </td>
                      {/* <td>
                        Cell Phone:<br />
                        <input
                          ref={cellPhoneRef}
                          type="tel"
                          name="cell_phone"
                          value={`${formData.country_code} ${formData.cell_phone}` || ""}
                          onChange={handleChange}
                          className="form-control"
                          readOnly
                        />
                      </td> */}

                      <td>
                        Cell Phone:
                        <br />
                        <input
                          type="tel"
                          name="cell_phone"
                          value={
                            formData.country_code && formData.cell_phone
                              ? `${formData.country_code} ${formData.cell_phone}`.trim()
                              : formData.cell_phone || ""
                          }
                          className="form-control"
                          readOnly
                          style={{
                            backgroundColor: "#e9ecef",
                            cursor: "not-allowed",
                          }}
                        />
                      </td>

                      <td>
                        Email:
                        <br />
                        <input
                          type="email"
                          name="email"
                          value={formData.email || ""}
                          onChange={handleChange}
                          className="form-control"
                          readOnly
                          style={{
                            backgroundColor: "#e9ecef",
                            cursor: "not-allowed",
                          }}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ✅ Minor Section */}
              <div className="minor-section my-4 text-start w-100">
                <h5
                  className="mb-4"
                  style={{ fontWeight: "700", fontSize: "18px" }}
                >
                  Please check mark to sign on behalf of the below minor or
                  dependent
                </h5>

                {minorList.map((minor, index) => (
                  <div
                    key={index}
                    className="d-flex align-items-start gap-3 mb-3"
                    style={{ width: "100%" }}
                  >
                    <div style={{ paddingTop: "8px" }}>
                      <input
                        type="checkbox"
                        checked={minor.checked}
                        onChange={(e) => {
                          const updated = [...minorList];
                          updated[index].checked = e.target.checked;
                          setMinorList(updated);
                        }}
                        class="custom-checkbox"
                      />
                    </div>

                    <div
                      style={{
                        flex: "1",
                        display: "flex",
                        gap: "12px",
                        alignItems: "start",
                      }}
                    >
                      <div style={{ flex: "1 0 33%" }}>
                        <input
                          type="text"
                          className={`form-control ${minorErrors[`${index}_first_name`] ? "is-invalid" : ""}`}
                          placeholder="First Name"
                          value={minor.first_name}
                          onChange={(e) =>
                            handleMinorChange(
                              index,
                              "first_name",
                              e.target.value,
                            )
                          }
                          readOnly={!minor.isNew}
                          style={{
                            backgroundColor: "#e9ecef",
                            border: "1px solid #dee2e6",
                            padding: "10px 12px",
                            cursor: minor.isNew ? "text" : "not-allowed",
                            borderRadius: "4px",
                          }}
                        />
                        {minorErrors[`${index}_first_name`] && (
                          <div className="text-danger small mt-1">
                            {minorErrors[`${index}_first_name`]}
                          </div>
                        )}
                      </div>

                      <div style={{ flex: "1 0 33%" }}>
                        <input
                          type="text"
                          className={`form-control ${minorErrors[`${index}_last_name`] ? "is-invalid" : ""}`}
                          placeholder="Last Name"
                          value={minor.last_name}
                          onChange={(e) =>
                            handleMinorChange(
                              index,
                              "last_name",
                              e.target.value,
                            )
                          }
                          readOnly={!minor.isNew}
                          style={{
                            backgroundColor: "#e9ecef",
                            border: "1px solid #dee2e6",
                            padding: "10px 12px",
                            cursor: minor.isNew ? "text" : "not-allowed",
                            borderRadius: "4px",
                          }}
                        />
                        {minorErrors[`${index}_last_name`] && (
                          <div className="text-danger small mt-1">
                            {minorErrors[`${index}_last_name`]}
                          </div>
                        )}
                      </div>

                      <div style={{ flex: "1" }}>
                        <input
                          type="date"
                          className={`form-control ${minorErrors[`${index}_dob`] ? "is-invalid" : ""}`}
                          placeholder="dd-mm-yyyy"
                          value={minor.dob}
                          onChange={(e) =>
                            handleMinorChange(index, "dob", e.target.value)
                          }
                          readOnly={!minor.isNew}
                          style={{
                            backgroundColor: "#e9ecef",
                            border: "1px solid #dee2e6",
                            padding: "10px 12px",
                            cursor: minor.isNew ? "text" : "not-allowed",
                            borderRadius: "4px",
                          }}
                        />
                        {minorErrors[`${index}_dob`] && (
                          <div className="text-danger small mt-1">
                            {minorErrors[`${index}_dob`]}
                          </div>
                        )}
                      </div>

                      {minor.isNew && (
                        <button
                          type="button"
                          className="btn"
                          onClick={() => removeMinor(index)}
                          style={{
                            backgroundColor: "#6c757d",
                            color: "white",
                            borderRadius: "8px",
                            padding: "10px 20px",
                            border: "none",
                            fontSize: "14px",
                            fontWeight: "500",
                            whiteSpace: "nowrap",
                            minWidth: "90px",
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                <div className="d-flex flex-column flex-sm-row justify-content-center align-items-center gap-3 mt-4">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() =>
                      setMinorList([
                        ...minorList,
                        {
                          first_name: "",
                          last_name: "",
                          dob: "",
                          checked: true,
                          isNew: true,
                        },
                      ])
                    }
                    style={{
                      backgroundColor: "#007bff",
                      border: "none",
                      borderRadius: "8px",
                      padding: "12px 40px",
                      fontSize: "16px",
                      fontWeight: "500",
                      minWidth: "200px",
                    }}
                  >
                    Add another minor
                  </button>
                  <span className="fw-bold" style={{ fontSize: "18px" }}>
                    or
                  </span>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={goToSignature}
                    disabled={updating}
                    style={{
                      backgroundColor: "#007bff",
                      border: "none",
                      borderRadius: "8px",
                      padding: "12px 40px",
                      fontSize: "16px",
                      fontWeight: "500",
                      minWidth: "200px",
                    }}
                  >
                    {updating ? "Processing..." : hasModifications() ? "Confirm" : "Continue"}
                  </button>
                </div>
              </div>           
            </form>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog for Modified Waiver */}
      {showConfirmDialog && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onClick={() => setShowConfirmDialog(false)}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "30px",
              borderRadius: "12px",
              maxWidth: "500px",
              width: "90%",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 style={{ marginBottom: "20px", color: "#333", fontWeight: "600" }}>
              Confirm Changes
            </h4>
            <p style={{ marginBottom: "25px", color: "#666", lineHeight: "1.6" }}>
              You have made changes to the waiver information. Proceeding will create a new waiver that requires your signature.
              Do you want to continue with these changes?
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowConfirmDialog(false)}
                style={{
                  padding: "10px 24px",
                  borderRadius: "8px",
                  border: "1px solid #ddd",
                  backgroundColor: "white",
                  color: "#666",
                  fontSize: "15px",
                  fontWeight: "500",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={proceedToSignature}
                disabled={updating}
                style={{
                  padding: "10px 24px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: "#007bff",
                  color: "white",
                  fontSize: "15px",
                  fontWeight: "500",
                  cursor: updating ? "not-allowed" : "pointer",
                  opacity: updating ? 0.7 : 1,
                }}
              >
                {updating ? "Processing..." : "Yes, Continue"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

export default ConfirmCustomerInfo;
