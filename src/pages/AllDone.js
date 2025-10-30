import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Confetti from "react-confetti";
import UserHeader from "../components/UserHeader";


function AllDone() {
  const navigate = useNavigate();
  const location = useLocation();
  const [countdown, setCountdown] = useState(5); // 5-second countdown
  const completed = location.state?.completed;
  const skipToMyWaivers = location.state?.skipToMyWaivers;
  const phone = location.state?.phone;
  const waiverId = location.state?.waiverId;

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

    // Clear form data when component mounts (but keep userFlow)
    localStorage.removeItem("signatureForm");
    localStorage.removeItem("customerForm");
    
    // Countdown timer
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === 1) {
          clearInterval(interval);
          
          // Check userFlow to determine navigation
          const userFlow = localStorage.getItem("userFlow");
          
          // Existing customers always go to dashboard after completion
          if (userFlow === "existing" && phone) {
            navigate("/my-waivers", { replace: true, state: { phone } });
          } 
          // New customers can optionally go to dashboard or home
          else if (skipToMyWaivers && phone) {
            navigate("/my-waivers", { replace: true, state: { phone } });
          } else {
            // Clear flow tracking when going back to home
            localStorage.removeItem("userFlow");
            navigate("/", { replace: true });
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [navigate, completed, skipToMyWaivers, phone]);

  // Prevent browser back button navigation
  useEffect(() => {
    // Push current state to prevent back navigation
    window.history.pushState(null, "", window.location.href);
    
    const handlePopState = () => {
      // Push state again to prevent going back
      window.history.pushState(null, "", window.location.href);
    };
    
    window.addEventListener("popstate", handlePopState);
    
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);


  return (
    <>
      <UserHeader />
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
    </>
  );
}

export default AllDone;
