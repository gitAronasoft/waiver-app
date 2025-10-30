import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import axios from "axios";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { BACKEND_URL } from '../config';
import UserHeader from '../components/UserHeader';
import { clearWaiverSession } from "../store/slices/waiverSessionSlice";
import { setPhone as setReduxPhone, setWaiverId, setCustomerId, setViewMode } from "../store/slices/waiverSessionSlice";

function UserDashboard() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const phone = useSelector((state) => state.waiverSession.phone);
  const [waivers, setWaivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(true);

  useEffect(() => {
    if (!phone) {
      console.warn("No phone found in Redux, redirecting to home");
      navigate("/", { replace: true });
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
      setWaivers(response.data.waivers || []);
      setIsVerified(response.data.isVerified || false);
    } catch (error) {
      console.error("Error fetching customer dashboard:", error);
      toast.error("Failed to load visit history");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (verified) => {
    if (verified === 1) {
      return <span className="badge custom-badge-verified">Verified</span>;
    } else if (verified === 2) {
      return <span className="badge custom-badge-inaccurate">Inaccurate</span>;
    } else {
      return <span className="badge custom-badge-pending">Pending</span>;
    }
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
          background-color: #f3f0ff !important;
        }
        .waiver-row td {
          border-bottom: 1px solid #e9ecef;
        }
        .custom-badge-pending {
          background-color: #FFD93D;
          color: #000;
          font-weight: 600;
        }
        .custom-badge-verified {
          background-color: #6C5CE7;
          color: #fff;
          font-weight: 600;
        }
        .custom-badge-inaccurate {
          background-color: #FF6B6B;
          color: #fff;
          font-weight: 600;
        }
      `}</style>
      <UserHeader />
      <div className="container-fluid" style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
        <div className="container py-3">
        {/* Title Section */}
        <div className="row mb-3">
          <div className="col-12 text-center">
            <h2 className="mb-2" style={{ fontSize: '1.5rem', fontWeight: '600' }}>My Visit History</h2>
            <p className="text-muted mb-1" style={{ fontSize: '0.95rem' }}>
              Phone: <strong>{formatPhone(phone)}</strong>
            </p>
            {!isVerified && waivers.length > 0 && (
              <div className="alert alert-warning mx-auto" style={{ maxWidth: '600px', fontSize: '0.9rem' }}>
                <i className="fas fa-info-circle me-2"></i>
                <strong>Note:</strong> Please verify your phone number to view your complete visit history.
              </div>
            )}
            {waivers.length > 0 && (
              <p className="mb-0" style={{ fontSize: '0.95rem', color: '#6C5CE7' }}>
                <strong>{waivers.length}</strong> visit{waivers.length !== 1 ? 's' : ''} {isVerified ? 'found' : 'pending verification'}
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
            ) : waivers.length === 0 ? (
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
                <div className="card shadow-sm border-0" style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #e9ecef' }}>
                  <div className="table-responsive">
                    <table className="table table-hover mb-0" style={{ fontSize: '0.9rem' }}>
                      <thead style={{ background: 'linear-gradient(135deg, #6C5CE7 0%, #8B7FE8 100%)', borderBottom: '3px solid #6C5CE7' }}>
                        <tr>
                          <th className="py-3 px-3" style={{ fontWeight: '600', width: '15%' }}>Waiver ID</th>
                          <th className="py-3 px-3" style={{ fontWeight: '600', width: '25%' }}>Name</th>
                          <th className="py-3 px-3" style={{ fontWeight: '600', width: '30%' }}>Signed Date & Time</th>
                          <th className="py-3 px-3" style={{ fontWeight: '600', width: '15%' }}>Minors</th>
                          <th className="py-3 px-3 text-center" style={{ fontWeight: '600', width: '15%' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {waivers.map((waiver, index) => {
                          return (
                            <tr 
                              key={waiver.waiver_id} 
                              onClick={() => {
                                dispatch(setWaiverId(waiver.waiver_id));
                                dispatch(setViewMode(false));
                                navigate("/confirm-info", { 
                                  state: { 
                                    phone, 
                                    waiverId: waiver.waiver_id,
                                    isReturning: true,
                                    editToCreateNew: true 
                                  } 
                                });
                              }}
                              style={{ cursor: 'pointer', transition: 'background-color 0.2s' }}
                              className="waiver-row"
                            >
                              <td className="py-3 px-3 align-middle">
                                <strong style={{ color: '#6C5CE7' }}>#{waiver.waiver_id}</strong>
                              </td>
                              <td className="py-3 px-3 align-middle">
                                <div>
                                  <div style={{ fontWeight: '500', color: '#212529' }}>
                                    {waiver.first_name} {waiver.last_name}
                                  </div>
                                  {waiver.email && (
                                    <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>
                                      <i className="fas fa-envelope me-1"></i>
                                      {waiver.email}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3 align-middle">
                                <div style={{ color: '#495057' }}>
                                  <i className="fas fa-calendar-alt me-2" style={{ color: '#6C5CE7' }}></i>
                                  {waiver.signed_at || 'N/A'}
                                </div>
                              </td>
                              <td className="py-3 px-3 align-middle">
                                {waiver.minors && waiver.minors.length > 0 ? (
                                  <span className="badge" style={{ backgroundColor: '#FFD93D', color: '#000', fontWeight: '600' }}>
                                    <i className="fas fa-child me-1"></i>
                                    {waiver.minors.length}
                                  </span>
                                ) : (
                                  <span className="text-muted">None</span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center align-middle">
                                {getStatusBadge(waiver.verified_by_staff)}
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
                  <button 
                    onClick={() => {
                      dispatch(clearWaiverSession());
                      localStorage.removeItem("userFlow");
                      localStorage.removeItem("signatureForm");
                      localStorage.removeItem("customerForm");
                      navigate("/", { replace: true });
                    }}
                    className="btn px-4 py-2" 
                    style={{ 
                      borderRadius: '8px', 
                      fontWeight: '500', 
                      fontSize: '0.95rem',
                      backgroundColor: '#FF6B6B',
                      color: '#fff',
                      border: 'none'
                    }}
                  >
                    <i className="fas fa-sign-out-alt me-2"></i>
                    Logout
                  </button>
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