import React, { useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import Header from "./components/header";
import { BACKEND_URL } from '../../config';

function ChangePassword() {
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);

  const staff = JSON.parse(localStorage.getItem("staff")); // id & email from logged-in user

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validatePassword = (password) => {
    if (password.length < 8) {
      return "Password must be at least 8 characters long";
    }
    if (!/[A-Z]/.test(password)) {
      return "Password must contain at least one uppercase letter";
    }
    if (!/[a-z]/.test(password)) {
      return "Password must contain at least one lowercase letter";
    }
    if (!/[0-9]/.test(password)) {
      return "Password must contain at least one number";
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.currentPassword.trim()) {
      toast.error("Current password is required");
      return;
    }

    if (!form.newPassword.trim()) {
      toast.error("New password is required");
      return;
    }

    if (!form.confirmPassword.trim()) {
      toast.error("Confirm password is required");
      return;
    }

    const passwordError = validatePassword(form.newPassword);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      toast.error("New password and confirm password do not match");
      return;
    }

    if (form.currentPassword === form.newPassword) {
      toast.error("New password must be different from current password");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/staff/change-password`,
        {
          id: staff.id,
          email: staff.email,
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
          confirmPassword: form.confirmPassword,
        }
      );

      toast.success(response.data.message || "Password updated successfully!");

      // Optional: Update token if backend returns new one
      if (response.data.token && response.data.staff) {
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("staff", JSON.stringify(response.data.staff));
      }

      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      toast.error(err.response?.data?.error || "Error changing password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header />
      <div className="container">
        <div className="row">
          <div className="col-12 col-xl-7 col-md-10 mx-auto my-5">
            <div className="client-profile">
              <div>
                <h5 className="h5-heading mb-5">Change Password</h5>
                {/* <div>
                  <img
                    className="img-fluid my-3"
                    src="/assets/img/Vector.png"
                    alt="change-password"
                  />
                </div> */}
              </div>

              <form onSubmit={handleSubmit}>
                {/* Current Password */}
                <div className="mb-3">
                  <label className="form-label">Current Password</label>
                  <input
                    type="password"
                    name="currentPassword"
                    className="form-control"
                    value={form.currentPassword}
                    onChange={handleChange}
                    placeholder="Enter current password"
                    disabled={loading}
                  />
                </div>

                {/* New Password */}
                <div className="mb-3">
                  <label className="form-label">New Password</label>
                  <input
                    type="password"
                    name="newPassword"
                    className="form-control"
                    value={form.newPassword}
                    onChange={handleChange}
                    placeholder="Enter new password"
                    disabled={loading}
                  />
                </div>

                {/* Confirm New Password */}
                <div className="mb-4">
                  <label className="form-label">Confirm New Password</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    className="form-control"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    placeholder="Re-enter new password"
                    disabled={loading}
                  />
                </div>

                {/* Submit Button with Spinner */}
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden="true"
                      ></span>
                      Updating...
                    </>
                  ) : (
                    "Update Password"
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default ChangePassword;
