import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { BACKEND_URL } from '../config';

function RuleReminder() {
  const navigate = useNavigate();
  const location = useLocation();
  const userId = location.state?.userId;
  const phone = location.state?.phone;
  const customerType = location.state?.customerType || "existing";
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await axios.post(`${BACKEND_URL}/api/waivers/accept-rules`, { userId });
      localStorage.removeItem("signatureForm"); // Clear saved signature and form data
      toast.success("Rules accepted!");
      navigate("/all-done");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update waiver status.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid" style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      <div className="container text-center">
        {/* Header Section - Back button and logo in same row on all devices */}
        <div className="row">
          <div className="col-6 col-md-2">
            <div
              className="back-btn"
              style={{ cursor: "pointer" }}
              onClick={() => navigate("/signature", { state: { phone, customerType, userId } })}
            >
              <img
                src="/assets/img/image 298.png"
                className="img-fluid"
                alt="back"
              />{" "}
              BACK
            </div>
          </div>

          <div className="col-6 col-md-8 col-xl-8">
            <div className="step-two step-three">
              <div className="logo">
                <img
                  src="/assets/img/SKATE_AND_PLAY_V08_Full_Transparency (2) 1.png"
                  className="img-fluid"
                  alt="logo"
                />
              </div>
              <h5 className="h5-heading my-3 mt-3 text-center" style={{ fontSize: '1.5rem', fontWeight: '600' }}>
                Rule Reminder
              </h5>
            </div>
          </div>
        </div>

        {/* Main Content Section */}
        <div className="row mt-3 mt-md-4">
          <div className="col-12 col-lg-10 col-xl-8 mx-auto">
            {/* Rule Images Section */}
            <div className="d-flex justify-content-center justify-content-md-around align-items-start rule-images my-4 flex-wrap gap-3 gap-md-4 px-2 px-md-3">
              <div className="d-flex flex-column align-items-center" style={{ flex: '1 1 200px', maxWidth: '250px' }}>
                <img 
                  src="/assets/img/image 302 (1).png" 
                  alt="On the Rink" 
                  className="img-fluid mb-3"
                  style={{ maxWidth: '180px', height: 'auto' }}
                />
                <h5 style={{ fontSize: '1rem', fontWeight: '600', textAlign: 'center', margin: '0' }}>
                  ON THE RINK
                </h5>
              </div>
              <div className="d-flex flex-column align-items-center" style={{ flex: '1 1 200px', maxWidth: '250px' }}>
                <img 
                  src="/assets/img/image 303.png" 
                  alt="No speedskating" 
                  className="img-fluid mb-3"
                  style={{ maxWidth: '180px', height: 'auto' }}
                />
                <h5 style={{ fontSize: '1rem', fontWeight: '600', textAlign: 'center', margin: '0', lineHeight: '1.4' }}>
                  NO speedskating <br /> or rollerblade
                </h5>
              </div>
              <div className="d-flex flex-column align-items-center" style={{ flex: '1 1 200px', maxWidth: '250px' }}>
                <img 
                  src="/assets/img/image 304 (2).png" 
                  alt="Helmet" 
                  className="img-fluid mb-3"
                  style={{ maxWidth: '180px', height: 'auto' }}
                />
                <h5 style={{ fontSize: '1rem', fontWeight: '600', textAlign: 'center', margin: '0', lineHeight: '1.4' }}>
                  Children under 13 <br /> must wear a helmet
                </h5>
              </div>
            </div>

            {/* Rules List Section */}
            <div className="list-style mt-4 mt-md-5 px-3 px-md-4">
              <ul className="d-flex flex-column" style={{ 
                listStyle: 'disc', 
                textAlign: 'left', 
                maxWidth: '600px', 
                margin: '0 auto',
                padding: '0 20px',
                fontSize: '1rem',
                lineHeight: '1.8'
              }}>
                <li style={{ marginBottom: '12px' }}>Everyone entering the facility must pay</li>
                <li style={{ marginBottom: '12px' }}>No outside food or drinks</li>
                <li style={{ marginBottom: '12px' }}>Respect the direction of rotation on the rink: no crossing</li>
                <li style={{ marginBottom: '12px' }}>Be considerate of others' speed and learning</li>
                <li style={{ marginBottom: '12px' }}>Seek assistance from our staff if needed</li>
              </ul>
            </div>

            {/* Have Fun Section */}
            <div className="mt-4 mt-md-5 mb-4">
              <h5 className="h5-heading" style={{ fontSize: '1.5rem', fontWeight: '700', color: '#333' }}>
                Have Fun!
              </h5>
            </div>

            {/* Confirm Button */}
            <div className="mb-4 pb-3">
              <button 
                className="confirm-btn" 
                onClick={handleConfirm} 
                disabled={loading}
                style={{
                  width: '100%',
                  maxWidth: '400px',
                  padding: '14px 32px',
                  fontSize: '1.1rem',
                  fontWeight: '600',
                  borderRadius: '8px',
                  border: 'none',
                  marginTop: '10px'
                }}
              >
                {loading ? "Confirming..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RuleReminder;
