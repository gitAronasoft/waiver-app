import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

function UserDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const phone = location.state?.phone;
  const [waivers, setWaivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    if (!phone) {
      toast.error("Phone number required");
      navigate("/existing-customer");
      return;
    }

    fetchWaiverHistory();
    // eslint-disable-next-line
  }, [phone]);

  const fetchWaiverHistory = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${BACKEND_URL}/api/waivers/user-history/${phone}`
      );
      setWaivers(response.data.waivers || []);
    } catch (error) {
      console.error("Error fetching waiver history:", error);
      toast.error("Failed to load waiver history");
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
                Back
              </Link>
            </div>
          </div>

          <div className="col-12 col-md-8 mx-auto">
            <div className="text-center mb-4">
              <div className="logo mb-3">
                <img
                  className="img-fluid"
                  src="/assets/img/SKATE_AND_PLAY_V08_Full_Transparency (2) 1.png"
                  alt="logo"
                  style={{ maxWidth: "300px" }}
                />
              </div>
              <h2 className="h5-heading">My Waiver History</h2>
              <p className="text-muted">
                Phone: {phone ? `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}` : ""}
              </p>
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
            ) : waivers.length === 0 ? (
              <div className="text-center mt-5">
                <img
                  src="/assets/img/image 303.png"
                  alt="No waivers"
                  className="img-fluid mb-3"
                  style={{ maxWidth: "200px" }}
                />
                <h5>No Waivers Found</h5>
                <p className="text-muted">You haven't signed any waivers yet.</p>
                <Link to="/new-customer" className="btn btn-primary mt-3">
                  Sign a New Waiver
                </Link>
              </div>
            ) : (
              <div className="row">
                {waivers.map((waiver, index) => (
                  <div key={waiver.id} className="col-12 mb-3">
                    <div className="card shadow-sm">
                      <div className="card-body">
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <h5 className="card-title">
                              Waiver #{waivers.length - index}
                            </h5>
                            <p className="text-muted mb-2">
                              <small>
                                <i className="fas fa-calendar"></i>{" "}
                                {formatDate(waiver.signed_at || waiver.created_at)}
                              </small>
                            </p>
                          </div>
                          <div>{getStatusBadge(waiver.verified_by_staff)}</div>
                        </div>

                        {waiver.minors && waiver.minors.length > 0 && (
                          <div className="mt-3">
                            <p className="mb-1">
                              <strong>Minors Included:</strong>
                            </p>
                            <ul className="list-unstyled ms-3">
                              {waiver.minors.map((minor, idx) => (
                                <li key={idx}>
                                  <i className="fas fa-user-friends text-primary me-2"></i>
                                  {minor.first_name} {minor.last_name}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="mt-3">
                          <span className="badge bg-light text-dark me-2">
                            {waiver.completed ? "Completed" : "Incomplete"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
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
