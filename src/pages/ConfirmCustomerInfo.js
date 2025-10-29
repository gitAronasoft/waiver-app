import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { BACKEND_URL } from "../config";

function ConfirmCustomerInfo() {
  const location = useLocation();
  const navigate = useNavigate();
  const phone = location.state?.phone;
  const customerId = location.state?.customerId;
  const isReturning = location.state?.isReturning || false;

  const [formData, setFormData] = useState(null);

  // Route protection: Redirect if accessed directly without valid state
  useEffect(() => {
    if (!phone && !customerId) {
      console.warn("No phone or customerId found in state, redirecting to home");
      navigate("/", { replace: true });
    }
  }, [phone, customerId, navigate]);
  const [minorList, setMinorList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [minorErrors, setMinorErrors] = useState({});

  useEffect(() => {
    if (phone) {
      setLoading(true);

      const endpoint = customerId
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

          data.can_email = data.can_email === 1 || data.can_email === "1";
          setFormData(data);

          if (res.data.minors) {
            const minorsWithFlags = res.data.minors.map((minor) => ({
              ...minor,
              dob: minor.dob
                ? new Date(minor.dob).toISOString().split("T")[0]
                : "",
              checked: minor.status === 1,
              isNew: false,
            }));
            setMinorList(minorsWithFlags);
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
  }, [phone, customerId]);

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

    setUpdating(true);
    try {
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

      if (!isReturning) {
        await axios.post(
          `${BACKEND_URL}/api/waivers/update-customer`,
          updatedData,
        );
      }

      navigate("/signature", {
        replace: true,
        state: {
          phone,
          formData: updatedData,
          customerId: formData.id,
          isReturning,
        },
      });
    } catch (err) {
      console.error("Error updating customer:", err);
      toast.error("Failed to update customer info.");
    } finally {
      setUpdating(false);
    }
  };
  if (loading || !formData) {
    return <div className="text-center mt-5">Loading customer info...</div>;
  }

  return (
    <div className="container-fluid">
      <div className="container text-center">
        <div className="row">
          <div className="col-md-2">
            <div className="back-btn">
              <Link
                to="/my-waivers"
                state={{ phone }}
              >
                <img
                  className="img-fluid"
                  src="/assets/img/image 298.png"
                  alt="back-icon"
                />{" "}
                BACK
              </Link>
            </div>
          </div>
          <div className="col-12 col-md-8 col-xl-8">
            <div className="step-two step-three">
              <div className="logo">
                <img
                  className="img-fluid"
                  src="/assets/img/logo.png"
                  alt="logo"
                />
              </div>
            </div>
          </div>
        </div>

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
                    {updating ? "Confirming..." : "Confirm"}
                  </button>
                </div>
              </div>           
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConfirmCustomerInfo;
