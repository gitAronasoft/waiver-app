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
  const [expandedVisits, setExpandedVisits] = useState({});

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

  const toggleVisitExpanded = (customerId) => {
    setExpandedVisits(prev => ({
      ...prev,
      [customerId]: !prev[customerId]
    }));
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
    <div className="container-fluid" style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      <div className="container py-4">
        {/* Header Section */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="back-btn">
                <Link to="/" className="text-decoration-none">
                  <img
                    className="img-fluid"
                    src="/assets/img/image 298.png"
                    alt="back"
                    style={{ width: '20px', marginRight: '8px' }}
                  />
                  BACK
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Logo and Title Section */}
        <div className="row">
          <div className="col-12">
            <div className="text-center mb-4">
              <div className="logo mb-3 d-flex justify-content-center">
                <img
                  className="img-fluid"
                  src="/assets/img/SKATE_AND_PLAY_V08_Full_Transparency (2) 1.png"
                  alt="Skate & Play Logo"
                  style={{ maxWidth: "300px", width: '100%', height: 'auto' }}
                />
              </div>
              <h2 className="mb-2" style={{ fontSize: '1.75rem', fontWeight: '600' }}>My Visit History</h2>
              <p className="text-muted mb-1">
                Phone: <strong>{formatPhone(phone)}</strong>
              </p>
              {customerVisits.length > 0 && (
                <p className="text-primary mb-0">
                  <strong>{customerVisits.length}</strong> visit{customerVisits.length !== 1 ? 's' : ''} found
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="row">
          <div className="col-12 col-lg-10 mx-auto">
            {loading ? (
              <div className="mt-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="card mb-3 shadow-sm">
                    <div className="card-body">
                      <Skeleton height={30} width="60%" />
                      <Skeleton height={20} width="40%" className="mt-2" />
                      <Skeleton height={20} width="50%" className="mt-2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : customerVisits.length === 0 ? (
              <div className="text-center mt-5 py-5">
                <img
                  src="/assets/img/image 303.png"
                  alt="No visits"
                  className="img-fluid mb-4"
                  style={{ maxWidth: "200px" }}
                />
                <h5 className="mb-3">No Visits Found</h5>
                <p className="text-muted mb-4">No visit history found for this phone number.</p>
                <Link to="/new-customer" className="btn btn-primary">
                  <i className="fas fa-plus me-2"></i>
                  Sign a New Waiver
                </Link>
              </div>
            ) : (
              <>
                {customerVisits.map((customer, index) => {
                  const isExpanded = expandedVisits[customer.id];
                  const latestWaiver = customer.waivers && customer.waivers.length > 0 
                    ? customer.waivers[0] 
                    : null;
                  
                  return (
                    <div key={customer.id} className="mb-4">
                      <div className="card shadow-sm border-0" style={{ borderRadius: '12px', overflow: 'hidden' }}>
                        <div className="card-body p-4">
                          {/* Header: Visit number, date, and status */}
                          <div className="d-flex justify-content-between align-items-start mb-4">
                            <div className="flex-grow-1">
                              <h5 className="mb-1" style={{ fontSize: '1.25rem', fontWeight: '600', color: '#333' }}>
                                Visit #{customerVisits.length - index}
                              </h5>
                              <p className="text-muted mb-0" style={{ fontSize: '0.9rem' }}>
                                <i className="fas fa-calendar me-2"></i>
                                {formatDate(customer.created_at)}
                              </p>
                            </div>
                            {latestWaiver && (
                              <div>{getStatusBadge(latestWaiver.verified_by_staff)}</div>
                            )}
                          </div>

                          {/* Customer Info Grid */}
                          <div className="border-top pt-3 mb-3">
                            <div className="row g-3">
                              <div className="col-12 col-md-6">
                                <div className="mb-3">
                                  <p className="mb-1" style={{ fontSize: '0.85rem', color: '#6c757d' }}>
                                    <i className="fas fa-user me-2 text-primary"></i>
                                    Name:
                                  </p>
                                  <p className="mb-0 ms-4" style={{ fontWeight: '500' }}>
                                    {customer.first_name} {customer.last_name}
                                  </p>
                                </div>
                                {customer.email && (
                                  <div className="mb-3">
                                    <p className="mb-1" style={{ fontSize: '0.85rem', color: '#6c757d' }}>
                                      <i className="fas fa-envelope me-2 text-primary"></i>
                                      Email:
                                    </p>
                                    <p className="mb-0 ms-4" style={{ fontWeight: '500' }}>
                                      {customer.email}
                                    </p>
                                  </div>
                                )}
                              </div>
                              <div className="col-12 col-md-6">
                                <div className="mb-3">
                                  <p className="mb-1" style={{ fontSize: '0.85rem', color: '#6c757d' }}>
                                    <i className="fas fa-map-marker-alt me-2 text-primary"></i>
                                    Address:
                                  </p>
                                  <p className="mb-0 ms-4" style={{ fontWeight: '500' }}>
                                    {customer.address}
                                  </p>
                                </div>
                                {customer.city && customer.province && (
                                  <div className="mb-3">
                                    <p className="mb-1" style={{ fontSize: '0.85rem', color: '#6c757d' }}>
                                      <i className="fas fa-map-pin me-2 text-primary"></i>
                                      Location:
                                    </p>
                                    <p className="mb-0 ms-4" style={{ fontWeight: '500' }}>
                                      {customer.city}, {customer.province} {customer.postal_code}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Minors Summary */}
                          {latestWaiver && latestWaiver.minors && latestWaiver.minors.length > 0 && (
                            <div className="mt-3 border-top pt-3">
                              <p className="mb-2" style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                                <i className="fas fa-child me-2 text-primary"></i>
                                Minors Included ({latestWaiver.minors.length}):
                              </p>
                              <div className="ms-4">
                                {latestWaiver.minors.map((minor, idx) => (
                                  <div key={idx} className="mb-2 d-flex align-items-start">
                                    <i className="fas fa-user-friends text-secondary me-2 mt-1"></i>
                                    <div>
                                      <span style={{ fontWeight: '500' }}>
                                        {minor.first_name} {minor.last_name}
                                      </span>
                                      {minor.dob && (
                                        <span className="text-muted ms-2" style={{ fontSize: '0.85rem' }}>
                                          (DOB: {new Date(minor.dob).toLocaleDateString()})
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Expand/Collapse button for multiple waivers */}
                          {customer.waivers && customer.waivers.length > 1 && (
                            <div className="mt-3 border-top pt-3">
                              <button 
                                className="btn btn-sm btn-outline-primary w-100"
                                onClick={() => toggleVisitExpanded(customer.id)}
                              >
                                <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} me-2`}></i>
                                {isExpanded ? 'Hide' : 'Show'} All Waivers ({customer.waivers.length})
                              </button>
                            </div>
                          )}

                          {/* Expanded Waiver Details */}
                          {isExpanded && customer.waivers && customer.waivers.length > 1 && (
                            <div className="mt-3 border-top pt-3">
                              {customer.waivers.map((waiver, wIdx) => (
                                <div key={waiver.waiver_id} className="mb-3 p-3 bg-light rounded">
                                  <div className="d-flex justify-content-between align-items-start">
                                    <div>
                                      <h6 className="mb-1">Waiver #{customer.waivers.length - wIdx}</h6>
                                      <p className="text-muted mb-2">
                                        <small>{formatDate(waiver.signed_at || waiver.created_at)}</small>
                                      </p>
                                    </div>
                                    {getStatusBadge(waiver.verified_by_staff)}
                                  </div>
                                  
                                  {waiver.minors && waiver.minors.length > 0 && (
                                    <div className="mt-2">
                                      <small className="text-muted">Minors:</small>
                                      <ul className="list-unstyled ms-3 mb-0">
                                        {waiver.minors.map((minor, mIdx) => (
                                          <li key={mIdx}>
                                            <small>
                                              <i className="fas fa-user-friends text-secondary me-2"></i>
                                              {minor.first_name} {minor.last_name}
                                            </small>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  
                                  {waiver.verified_by_name && (
                                    <div className="mt-2">
                                      <small className="text-muted">
                                        Verified by: {waiver.verified_by_name}
                                      </small>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {/* Action Buttons */}
                <div className="text-center mt-5 mb-4">
                  <Link 
                    to="/new-customer" 
                    className="btn btn-primary me-2 px-4 py-2" 
                    style={{ borderRadius: '8px', fontWeight: '500' }}
                  >
                    <i className="fas fa-plus me-2"></i>
                    Sign New Waiver
                  </Link>
                  <Link 
                    to="/" 
                    className="btn btn-outline-secondary px-4 py-2" 
                    style={{ borderRadius: '8px', fontWeight: '500' }}
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
  );
}

export default UserDashboard;
