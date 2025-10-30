import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import axios from "axios";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { BACKEND_URL } from '../config';
import UserHeader from '../components/UserHeader';
import { clearWaiverSession, setWaiverId, setViewMode } from "../store/slices/waiverSessionSlice";

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
      toast.error("We couldn't load your visit history. Please refresh the page or try again later.");
    } finally {
      setLoading(false);
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

  const handleLogout = () => {
    dispatch(clearWaiverSession());
    localStorage.removeItem("userFlow");
    localStorage.removeItem("signatureForm");
    localStorage.removeItem("customerForm");
    navigate("/", { replace: true });
  };

  return (
    <>
      <style>{`
        .waiver-card {
          background: #fff;
          border-radius: 20px;
          box-shadow: 0px 4px 30px rgba(0, 0, 0, 0.06);
          border-bottom: 3px solid #DCC07C;
          transition: all 0.3s ease;
          cursor: pointer;
          overflow: hidden;
        }
        .waiver-card:hover {
          transform: translateY(-5px);
          box-shadow: 0px 8px 40px rgba(0, 0, 0, 0.12);
          border-bottom-color: #6C5CE7;
        }
        .waiver-card-header {
          background: linear-gradient(135deg, #6C5CE7 0%, #8B7FE8 100%);
          padding: 15px 20px;
          color: white;
        }
        .waiver-card-body {
          padding: 20px;
        }
        .info-row {
          display: flex;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid #f0f0f0;
        }
        .info-row:last-child {
          border-bottom: none;
        }
        .info-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 15px;
          font-size: 18px;
        }
        .badge-pending {
          background-color: #FFD93D;
          color: #000;
          font-weight: 600;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 0.85rem;
        }
        .badge-verified {
          background-color: #6C5CE7;
          color: #fff;
          font-weight: 600;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 0.85rem;
        }
        .badge-inaccurate {
          background-color: #FF6B6B;
          color: #fff;
          font-weight: 600;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 0.85rem;
        }
        .dashboard-header {
          background: linear-gradient(135deg, #6C5CE7 0%, #8B7FE8 100%);
          padding: 30px 20px;
          border-radius: 20px;
          color: white;
          margin-bottom: 30px;
          box-shadow: 0px 4px 20px rgba(108, 92, 231, 0.3);
        }
        @media (max-width: 768px) {
          .waiver-card {
            margin-bottom: 15px;
          }
        }
      `}</style>
      <UserHeader showLogout={true} onLogout={handleLogout} />
      <div className="container-fluid" style={{ minHeight: '100vh', background: 'linear-gradient(to bottom, #f8f9fa 0%, #ffffff 100%)' }}>
        <div className="container py-4">
          
          {/* Header Section */}
          <div className="dashboard-header">
            <div className="row align-items-center">
              <div className="col-md-8">
                <h2 className="mb-2" style={{ fontSize: '1.8rem', fontWeight: '700' }}>My Visit History</h2>
                <p className="mb-0" style={{ fontSize: '1rem', opacity: 0.9 }}>
                  <i className="fas fa-phone me-2"></i>
                  {formatPhone(phone)}
                </p>
              </div>
              <div className="col-md-4 text-md-end mt-3 mt-md-0">
                {waivers.length > 0 && (
                  <div style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '15px', borderRadius: '15px', backdropFilter: 'blur(10px)' }}>
                    <h3 className="mb-0" style={{ fontSize: '2rem', fontWeight: '700' }}>{waivers.length}</h3>
                    <p className="mb-0" style={{ fontSize: '0.9rem', opacity: 0.9 }}>Total Visit{waivers.length !== 1 ? 's' : ''}</p>
                  </div>
                )}
              </div>
            </div>
            {!isVerified && waivers.length > 0 && (
              <div className="mt-3 p-3" style={{ background: 'rgba(255, 217, 61, 0.2)', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.3)' }}>
                <i className="fas fa-info-circle me-2"></i>
                <strong>Note:</strong> Pending verification - Complete visit history will be available after phone verification.
              </div>
            )}
          </div>

          {/* Content Section */}
          <div className="row">
            <div className="col-12">
              {loading ? (
                <div className="row">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="col-12 col-md-6 col-lg-4 mb-4">
                      <div className="waiver-card">
                        <Skeleton height={60} />
                        <div className="p-3">
                          <Skeleton height={30} count={3} className="mb-2" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : waivers.length === 0 ? (
                <div className="text-center mt-5 py-5">
                  <div 
                    style={{ 
                      width: '120px', 
                      height: '120px', 
                      margin: '0 auto 30px',
                      background: 'linear-gradient(135deg, #6C5CE7 0%, #8B7FE8 100%)',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0.15
                    }}
                  >
                    <i className="fas fa-file-signature" style={{ fontSize: '60px', color: 'white' }}></i>
                  </div>
                  <h4 className="mb-3" style={{ fontWeight: '700', color: '#495057' }}>No Visits Yet</h4>
                  <p className="text-muted mb-4" style={{ fontSize: '1rem', maxWidth: '400px', margin: '0 auto 30px' }}>
                    Start your skating journey today! Sign your first waiver to get started.
                  </p>
                  <Link 
                    to="/new-customer" 
                    className="btn"
                    style={{
                      backgroundColor: '#6C5CE7',
                      color: 'white',
                      padding: '14px 35px',
                      borderRadius: '25px',
                      fontWeight: '600',
                      border: 'none',
                      fontSize: '1rem',
                      boxShadow: '0px 4px 15px rgba(108, 92, 231, 0.3)',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0px 6px 20px rgba(108, 92, 231, 0.4)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0px 4px 15px rgba(108, 92, 231, 0.3)';
                    }}
                  >
                    <i className="fas fa-plus me-2"></i>
                    Sign Your First Waiver
                  </Link>
                </div>
              ) : (
                <div className="row">
                  {waivers.map((waiver) => (
                    <div key={waiver.waiver_id} className="col-12 col-md-6 col-lg-4 mb-4">
                      <div 
                        className="waiver-card"
                        onClick={() => {
                          dispatch(setWaiverId(waiver.waiver_id));
                          dispatch(setViewMode(true));
                          navigate("/confirm-info", { 
                            state: { 
                              phone, 
                              waiverId: waiver.waiver_id,
                              isReturning: true,
                              editToCreateNew: true 
                            } 
                          });
                        }}
                      >
                        {/* Card Header */}
                        <div className="waiver-card-header">
                          <div className="d-flex justify-content-between align-items-center">
                            <div>
                              <h5 className="mb-0" style={{ fontWeight: '700', fontSize: '1.1rem' }}>
                                Waiver #{waiver.waiver_id}
                              </h5>
                            </div>
                            <div>
                              {waiver.verified_by_staff === 1 ? (
                                <span className="badge-verified">
                                  <i className="fas fa-check-circle me-1"></i>
                                  Verified
                                </span>
                              ) : waiver.verified_by_staff === 2 ? (
                                <span className="badge-inaccurate">
                                  <i className="fas fa-exclamation-circle me-1"></i>
                                  Issue
                                </span>
                              ) : (
                                <span className="badge-pending">
                                  <i className="fas fa-clock me-1"></i>
                                  Pending
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Card Body */}
                        <div className="waiver-card-body">
                          {/* Name */}
                          <div className="info-row">
                            <div className="info-icon" style={{ background: 'linear-gradient(135deg, #6C5CE7 0%, #8B7FE8 100%)', color: 'white' }}>
                              <i className="fas fa-user"></i>
                            </div>
                            <div className="flex-grow-1">
                              <div style={{ fontWeight: '600', fontSize: '1rem', color: '#212529' }}>
                                {waiver.first_name} {waiver.last_name}
                              </div>
                              {waiver.email && (
                                <div style={{ fontSize: '0.85rem', color: '#6c757d' }}>
                                  <i className="fas fa-envelope me-1"></i>
                                  {waiver.email}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Date & Time */}
                          <div className="info-row">
                            <div className="info-icon" style={{ background: '#FFD93D', color: '#000' }}>
                              <i className="fas fa-calendar-alt"></i>
                            </div>
                            <div className="flex-grow-1">
                              <div style={{ fontSize: '0.85rem', color: '#6c757d', fontWeight: '500' }}>Signed On</div>
                              <div style={{ fontWeight: '600', fontSize: '0.95rem', color: '#212529' }}>
                                {waiver.signed_at || 'N/A'}
                              </div>
                            </div>
                          </div>

                          {/* Minors */}
                          <div className="info-row">
                            <div className="info-icon" style={{ background: '#DCC07C', color: '#000' }}>
                              <i className="fas fa-child"></i>
                            </div>
                            <div className="flex-grow-1">
                              <div style={{ fontSize: '0.85rem', color: '#6c757d', fontWeight: '500' }}>Minors Included</div>
                              <div style={{ fontWeight: '600', fontSize: '0.95rem', color: '#212529' }}>
                                {waiver.minors && waiver.minors.length > 0 ? (
                                  <span>{waiver.minors.length} Minor{waiver.minors.length !== 1 ? 's' : ''}</span>
                                ) : (
                                  <span style={{ color: '#9ca3af' }}>None</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default UserDashboard;