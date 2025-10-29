import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Confetti from "react-confetti"; // Install: npm install react-confetti


function AllDone() {
  const navigate = useNavigate();
  const location = useLocation();
  const [countdown, setCountdown] = useState(5); // 5-second countdown
  const completed = location.state?.completed;
  const skipToMyWaivers = location.state?.skipToMyWaivers;
  const phone = location.state?.phone;

  const handleReturn = () => {
    // Clear all form data
    localStorage.removeItem("signatureForm");
    localStorage.removeItem("customerForm");
    
    // Redirect based on skipToMyWaivers flag
    if (skipToMyWaivers && phone) {
      navigate("/my-waivers", { replace: true, state: { phone } });
    } else {
      navigate("/", { replace: true });
    }
  };

  useEffect(() => {
    // Route protection: Only accessible if coming from valid flow
    if (!completed && !skipToMyWaivers) {
      console.warn("Direct access to AllDone page blocked, redirecting to home");
      navigate("/", { replace: true });
      return;
    }

    // Clear localStorage when component mounts
    localStorage.removeItem("signatureForm");
    localStorage.removeItem("customerForm");
    
    // Countdown timer
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === 1) {
          clearInterval(interval);
          // Redirect based on skipToMyWaivers flag
          if (skipToMyWaivers && phone) {
            navigate("/my-waivers", { replace: true, state: { phone } });
          } else {
            navigate("/", { replace: true });
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [navigate, completed, skipToMyWaivers, phone]);


  return (
    <div className="container-fluid text-center" style={{ position: "relative" }}>
      {/* 🎉 Confetti Animation */}
      <Confetti
        width={window.innerWidth}
        height={window.innerHeight}
        numberOfPieces={300}
        gravity={0.2}
      />

      <div className="container">
        <div className="row">
          <div className="col-12 col-md-12 col-xl-8 mx-auto">
            <div className="logo-img my-4">
              <img
                className="img-fluid"
                src="/assets/img/logo.png"
                alt="logo"
              />
            </div>

            <h3 className="my-4 h5-heading h3-heading" style={{ fontSize: "2rem", fontWeight: "bold" }}>
              🎉 YAY!!! ALL DONE 🎉 <br />
              ENJOY YOUR TIME!!!
            </h3>

            <p style={{ fontSize: "1.2rem", marginTop: "10px" }}>
              Redirecting to {skipToMyWaivers ? "My Waivers" : "the main screen"} in <strong>{countdown}</strong> seconds...
            </p>

            <div className="mx-auto text-center">
              <button
                className="return-btn btn btn-primary mt-3 text-center"
                onClick={handleReturn}
              >
                {skipToMyWaivers ? "Return to My Waivers now" : "Return to the MAIN screen now"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AllDone;
