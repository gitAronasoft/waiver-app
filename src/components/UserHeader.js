import React from "react";
import { Link, useNavigate } from "react-router-dom";

function UserHeader({ showBack = false, onBack = null, backTo = null, backState = null }) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backTo) {
      navigate(backTo, backState ? { state: backState } : {});
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="container-fluid" style={{ backgroundColor: '#fff' }}>
      <div className="container">
        <div className="row align-items-center" style={{ marginTop: '10px' }}>
          {/* Left side - Back Button */}
          <div className="col-12 col-md-2">
            {showBack && (
              <div className="back-btn">
                <div
                  style={{ cursor: "pointer", display: 'flex', alignItems: 'center', gap: '6px', 'font-size': '20px'}}
                  onClick={handleBack}
                >
                  <img
                    src="/assets/img/image 298.png"
                    alt="back"
                    className="img-fluid"
                  />
                  BACK
                </div>
              </div>
            )}
          </div>

          {/* Center - Logo */}
          <div className="col-12 col-md-8 col-xl-8">
            <div className="step-two step-three">
              <div className="logo">
                <Link to="/">
                  <img
                    src="/assets/img/logo.png"
                    className="img-fluid"
                    alt="logo"
                  />
                </Link>
              </div>
            </div>
          </div>

          {/* Right side - Empty for balance */}
          <div className="col-md-2"></div>
        </div>
      </div>
    </div>
  );
}

export default UserHeader;
