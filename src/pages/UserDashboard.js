import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { BACKEND_URL } from '../config';

function UserDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const phone = location.state?.phone;
  const [customerVisits, setCustomerVisits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!phone) {
      toast.error("Phone number required");
      navigate("/existing-customer");
      return;
    }

    fetchCustomerDashboard();
    // eslint-disable-next-line
  }, [phone]);

  const fetchCustomerDashboard = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${BACKEND_URL}/api/waivers/customer-dashboard?phone=${phone}`
      );
      setCustomerVisits(response.data.customers || []);
    } catch (error) {
      console.error("Error fetching customer dashboard:", error);
      toast.error("Failed to load visit history");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (verified) => {
    if (verified === 1) {
      return <span className="badge bg-success">Verified</span>;
    } else if (verified === 2) {
      return <span className="badge bg-danger">Inaccurate</span>;
    } else {
      return <span className="badge bg-warning text-dark">Pending</span>;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatPhone = (phoneNum) => {
    if (!phoneNum) return "";
    const cleaned = phoneNum.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phoneNum;
  };

  return (
    <>
      <style>{`
        .waiver-row:hover {
          background-color: #f1f3f5 !important;
        }
        .waiver-row td {
          border-bottom: 1px solid #e9ecef;
        }
      `}</style>
      <div className="container-fluid" style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
        <div className="container py-3">
          {/* Header Section with Logo and Back Button */}
          <div className="row mb-3">
          <div className="col-12">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div className="back-btn">
                <Link to="/" className="text-decoration-none" style={{ fontSize: '0.95rem', fontWeight: '500' }}>
                  <img
                    className="img-fluid"
                    src="/assets/img/image 298.png"
                    alt="back"
                    style={{ width: '18px', marginRight: '6px' }}
                  />
                  BACK
                </Link>
              </div>
              <div className="logo">
                <img
                  className="img-fluid"
                  src="/assets/img/SKATE_AND_PLAY_V08_Full_Transparency (2) 1.png"
                  alt="Skate & Play Logo"
                  style={{ maxWidth: "200px", width: '100%', height: 'auto' }}
                />
              </div>
              <div style={{ width: '60px' }}></div>
            </div>
          </div>
        </div>

        {/* Title Section */}
        <div className="row mb-3">
          <div className="col-12 text-center">
            <h2 className="mb-2" style={{ fontSize: '1.5rem', fontWeight: '600' }}>My Visit History</h2>
            <p className="text-muted mb-1" style={{ fontSize: '0.95rem' }}>
              Phone: <strong>{formatPhone(phone)}</strong>
            </p>
            {customerVisits.length > 0 && (
              <p className="text-primary mb-0" style={{ fontSize: '0.95rem' }}>
                <strong>{customerVisits.length}</strong> visit{customerVisits.length !== 1 ? 's' : ''} found
              </p>
            )}
          </div>
        </div>

          {/* Content Section */}
          <div className="row">
            <div className="col-12 col-lg-10 mx-auto">
            {loading ? (
              <div className="mt-3">
                <div className="card shadow-sm">
                  <div className="card-body p-2">
                    <Skeleton height={40} className="mb-2" />
                    <Skeleton height={50} count={3} className="mb-2" />
                  </div>
                </div>
              </div>
            ) : customerVisits.length === 0 ? (
              <div className="text-center mt-4 py-4">
                <img
                  src="/assets/img/image 303.png"
                  alt="No visits"
                  className="img-fluid mb-3"
                  style={{ maxWidth: "180px" }}
                />
                <h5 className="mb-2">No Visits Found</h5>
                <p className="text-muted mb-3" style={{ fontSize: '0.95rem' }}>No visit history found for this phone number.</p>
                <Link to="/new-customer" className="btn btn-primary">
                  <i className="fas fa-plus me-2"></i>
                  Sign a New Waiver
                </Link>
              </div>
            ) : (
              <>
                {/* Datatable for Waiver List */}
                <div className="card shadow-sm border-0" style={{ borderRadius: '10px', overflow: 'hidden' }}>
                  <div className="table-responsive">
                    <table className="table table-hover mb-0" style={{ fontSize: '0.9rem' }}>
                      <thead style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                        <tr>
                          <th className="py-3 px-3" style={{ fontWeight: '600', color: '#495057', width: '15%' }}>Visit #</th>
                          <th className="py-3 px-3" style={{ fontWeight: '600', color: '#495057', width: '25%' }}>Name</th>
                          <th className="py-3 px-3" style={{ fontWeight: '600', color: '#495057', width: '30%' }}>Date & Time</th>
                          <th className="py-3 px-3" style={{ fontWeight: '600', color: '#495057', width: '15%' }}>Minors</th>
                          <th className="py-3 px-3 text-center" style={{ fontWeight: '600', color: '#495057', width: '15%' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customerVisits.map((customer, index) => {
                          const latestWaiver = customer.waivers && customer.waivers.length > 0 
                            ? customer.waivers[0] 
                            : null;
                          
                          return (
                            <tr 
                              key={customer.id} 
                              onClick={() => navigate("/confirm-customer-info", { state: { phone } })}
                              style={{ cursor: 'pointer', transition: 'background-color 0.2s' }}
                              className="waiver-row"
                            >
                              <td className="py-3 px-3 align-middle">
                                <strong style={{ color: '#007bff' }}>#{customerVisits.length - index}</strong>
                              </td>
                              <td className="py-3 px-3 align-middle">
                                <div>
                                  <div style={{ fontWeight: '500', color: '#212529' }}>
                                    {customer.first_name} {customer.last_name}
                                  </div>
                                  {customer.email && (
                                    <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>
                                      <i className="fas fa-envelope me-1"></i>
                                      {customer.email}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3 align-middle">
                                <div style={{ color: '#495057' }}>
                                  <i className="fas fa-calendar-alt me-2 text-primary"></i>
                                  {formatDate(customer.created_at)}
                                </div>
                              </td>
                              <td className="py-3 px-3 align-middle">
                                {latestWaiver && latestWaiver.minors && latestWaiver.minors.length > 0 ? (
                                  <span className="badge bg-info text-dark">
                                    <i className="fas fa-child me-1"></i>
                                    {latestWaiver.minors.length}
                                  </span>
                                ) : (
                                  <span className="text-muted">None</span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center align-middle">
                                {latestWaiver && getStatusBadge(latestWaiver.verified_by_staff)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="text-center mt-4 mb-3">
                  <Link 
                    to="/new-customer" 
                    className="btn btn-primary me-2 px-4 py-2" 
                    style={{ borderRadius: '8px', fontWeight: '500', fontSize: '0.95rem' }}
                  >
                    <i className="fas fa-plus me-2"></i>
                    Sign New Waiver
                  </Link>
                  <Link 
                    to="/" 
                    className="btn btn-outline-secondary px-4 py-2" 
                    style={{ borderRadius: '8px', fontWeight: '500', fontSize: '0.95rem' }}
                  >
                    <i className="fas fa-home me-2"></i>
                    Home
                  </Link>
                </div>
              </>
            )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default UserDashboard;
