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
    <div className="container-fluid">
      <div className="container">
        <div className="row my-4">
          <div className="col-md-2">
            <div className="back-btn">
              <Link to="/">
                <img
                  className="img-fluid"
                  src="/assets/img/image 298.png"
                  alt="back"
                />
                {" "}BACK
              </Link>
            </div>
          </div>

          <div className="col-12 col-md-10 mx-auto">
            <div className="text-center mb-4">
              <div className="logo mb-3">
                <img
                  className="img-fluid"
                  src="/assets/img/SKATE_AND_PLAY_V08_Full_Transparency (2) 1.png"
                  alt="logo"
                  style={{ maxWidth: "300px" }}
                />
              </div>
              <h2 className="h5-heading">My Visit History</h2>
              <p className="text-muted">
                Phone: {formatPhone(phone)}
              </p>
              {customerVisits.length > 0 && (
                <p className="text-primary">
                  <strong>{customerVisits.length}</strong> visit{customerVisits.length !== 1 ? 's' : ''} found
                </p>
              )}
            </div>

            {loading ? (
              <div className="mt-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="card mb-3">
                    <div className="card-body">
                      <Skeleton height={30} width="60%" />
                      <Skeleton height={20} width="40%" className="mt-2" />
                      <Skeleton height={20} width="50%" className="mt-2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : customerVisits.length === 0 ? (
              <div className="text-center mt-5">
                <img
                  src="/assets/img/image 303.png"
                  alt="No visits"
                  className="img-fluid mb-3"
                  style={{ maxWidth: "200px" }}
                />
                <h5>No Visits Found</h5>
                <p className="text-muted">No visit history found for this phone number.</p>
                <Link to="/new-customer" className="btn btn-primary mt-3">
                  Sign a New Waiver
                </Link>
              </div>
            ) : (
              <div className="row">
                {customerVisits.map((customer, index) => {
                  const isExpanded = expandedVisits[customer.id];
                  const latestWaiver = customer.waivers && customer.waivers.length > 0 
                    ? customer.waivers[0] 
                    : null;
                  
                  return (
                    <div key={customer.id} className="col-12 mb-3">
                      <div className="card shadow-sm">
                        <div className="card-body">
                          {/* Header: Visit number and date */}
                          <div className="d-flex justify-content-between align-items-start mb-3">
                            <div>
                              <h5 className="card-title mb-1">
                                Visit #{customerVisits.length - index}
                              </h5>
                              <p className="text-muted mb-0">
                                <small>
                                  <i className="fas fa-calendar me-1"></i>
                                  {formatDate(customer.created_at)}
                                </small>
                              </p>
                            </div>
                            {latestWaiver && (
                              <div>{getStatusBadge(latestWaiver.verified_by_staff)}</div>
                            )}
                          </div>

                          {/* Customer Info Summary */}
                          <div className="border-top pt-3">
                            <div className="row">
                              <div className="col-md-6">
                                <p className="mb-2">
                                  <strong>
                                    <i className="fas fa-user me-2 text-primary"></i>
                                    Name:
                                  </strong>{" "}
                                  {customer.first_name} {customer.last_name}
                                </p>
                                {customer.email && (
                                  <p className="mb-2">
                                    <strong>
                                      <i className="fas fa-envelope me-2 text-primary"></i>
                                      Email:
                                    </strong>{" "}
                                    {customer.email}
                                  </p>
                                )}
                              </div>
                              <div className="col-md-6">
                                <p className="mb-2">
                                  <strong>
                                    <i className="fas fa-map-marker-alt me-2 text-primary"></i>
                                    Address:
                                  </strong>{" "}
                                  {customer.address}
                                </p>
                                {customer.city && customer.province && (
                                  <p className="mb-2">
                                    <strong>
                                      <i className="fas fa-map-pin me-2 text-primary"></i>
                                      Location:
                                    </strong>{" "}
                                    {customer.city}, {customer.province} {customer.postal_code}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Minors Summary */}
                          {latestWaiver && latestWaiver.minors && latestWaiver.minors.length > 0 && (
                            <div className="mt-3 border-top pt-3">
                              <p className="mb-2">
                                <strong>
                                  <i className="fas fa-child me-2 text-primary"></i>
                                  Minors Included ({latestWaiver.minors.length}):
                                </strong>
                              </p>
                              <ul className="list-unstyled ms-4">
                                {latestWaiver.minors.map((minor, idx) => (
                                  <li key={idx} className="mb-1">
                                    <i className="fas fa-user-friends text-secondary me-2"></i>
                                    {minor.first_name} {minor.last_name}
                                    {minor.dob && (
                                      <span className="text-muted ms-2">
                                        (DOB: {new Date(minor.dob).toLocaleDateString()})
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ul>
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
              </div>
            )}

            <div className="text-center mt-4 mb-5">
              <Link to="/new-customer" className="btn btn-primary me-2">
                <i className="fas fa-plus me-2"></i>
                Sign New Waiver
              </Link>
              <Link to="/" className="btn btn-outline-secondary">
                <i className="fas fa-home me-2"></i>
                Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserDashboard;
