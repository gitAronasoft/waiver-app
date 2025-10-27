import React, { useState, useRef } from "react";
import axios from "axios";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from 'react-toastify';
import { BACKEND_URL } from '../config';

function VerifyOtp() {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const phone = location.state?.phone;
  const customerType = location.state?.customerType || "existing";
  const otpVerifiedRef = useRef(false);

  // console.log("OTP Verified:", customerType);

  const handleKeypadClick = (value) => {
    if (value === "Clear") {
      setOtp("");
    } else if (value === "." || otp.length >= 4) {
      return;
    } else {
      setOtp((prev) => {
        const newOtp = prev + value;
        if (newOtp.length === 4) {
          verifyOtp(newOtp);
        }
        return newOtp;
      });
    }
  };

  const handleChange = (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 4);
    setOtp(value);
    if (value.length === 4) {
      verifyOtp(value);
    }
  };

const verifyOtp = async (otpValue) => {
  if (otpVerifiedRef.current) return;
  
  if (!otpValue || otpValue.trim() === "") {
    toast.error("Please enter the OTP code");
    return;
  }
  
  if (otpValue.length < 4) {
    toast.error(`OTP must be 4 digits. You entered ${otpValue.length} digits.`);
    return;
  }
  
  otpVerifiedRef.current = true;
  setLoading(true);

  try {
    const res = await axios.post(`${BACKEND_URL}/api/auth/verify-otp`, {
      phone,
      otp: otpValue,
    });

    if (res.data.authenticated) {
      toast.success("OTP Verified Successfully!");

      if (customerType === "dashboard") {
        navigate("/my-waivers", { state: { phone } });
      } else if (customerType === "existing") {
        navigate("/confirm-info", { state: { phone } });
      } else if (customerType === "new") {
        navigate("/signature", { state: { phone } });
      }
    } else {
      toast.error("Invalid OTP. Please try again.");
      otpVerifiedRef.current = false;
      setLoading(false);
      setOtp("");
    }
  } catch (err) {
    toast.error(err?.response?.data?.message || "OTP verification failed. Please try again.");
    otpVerifiedRef.current = false;
    setLoading(false);
    setOtp("");
  }
};


  return (
    <div className="container-fluid">
      <div className="container text-center">
        <div className="row">
          <div className="col-md-2">
            <div className="back-btn">
              <Link to="/existing-customer">
                <img
                  className="img-fluid"
                  src="/assets/img/image 298.png"
                  alt="back"
                />
                Back
              </Link>
            </div>
          </div>

          <div className="col-12 col-md-8 col-xl-8">
            <div className="step-two step-three">
              <div className="logo mb-3">
                <img
                  className="img-fluid"
                  src="/assets/img/SKATE_AND_PLAY_V08_Full_Transparency (2) 1.png"
                  alt="logo"
                />
              </div>

              <h5 className="my-4">
                Please enter the 4 digit PIN sent to your phone number
              </h5>
              {loading && <p className="text-center text-primary">Verifying OTP...</p>}

              <div className="pin-inputs d-flex justify-content-center gap-3">
                <input
                  type="text"
                  maxLength="4"
                  className="pin-box otp-number"
                  value={otp}
                  onChange={handleChange}
                />
              </div>

              <div className="keypad d-flex flex-wrap gap-3 justify-content-center mt-4 mx-auto w-75">
                {["7", "8", "9", "4", "5", "6", "1", "2", "3", "Clear", "0"].map((num) => (
                  <div key={num} className="numbers" onClick={() => handleKeypadClick(num)}>
                    {num}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VerifyOtp;
