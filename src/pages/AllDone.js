import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Confetti from "react-confetti"; // Install: npm install react-confetti


function AllDone() {
  const navigate = useNavigate();
  const location = useLocation();
  const [countdown, setCountdown] = useState(5); // 5-second countdown
  const completed = location.state?.completed;

  const handleReturn = () => {
    // Clear all form data and redirect to home
    localStorage.removeItem("signatureForm");
    localStorage.removeItem("customerForm");
    // Replace current entry and navigate home
    navigate("/", { replace: true });
  };

  useEffect(() => {
    // Route protection: Only accessible if coming from valid flow
    if (!completed) {
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
          // Clear history stack and redirect to home
          navigate("/", { replace: true });
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [navigate, completed]);


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
              Redirecting to the main screen in <strong>{countdown}</strong> seconds...
            </p>

            <div className="mx-auto text-center">
              <button
                className="return-btn btn btn-primary mt-3 text-center"
                onClick={handleReturn}
              >
                Return to the MAIN screen now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AllDone;
