import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import SignaturePad from "react-signature-canvas";
import axios from "axios";
import { toast } from 'react-toastify';
import { BACKEND_URL } from '../config';
import UserHeader from '../components/UserHeader';
import { setCurrentStep, setSignatureImage as setSignatureImageRedux } from "../store/slices/waiverSessionSlice";




function Signature() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const sigPadRef = useRef();

  const [signatureImage, setSignatureImage] = useState(null);
  const [initials, setInitials] = useState("");
  const [customerData, setCustomerData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [minorErrors, setMinorErrors] = useState({});

  const customerType = useSelector((state) => state.waiverSession.flowType) || "existing";
  const phone = useSelector((state) => state.waiverSession.phone);
  const customerId = useSelector((state) => state.waiverSession.customerId);
  const isReturning = useSelector((state) => state.waiverSession.progress.isReturning) || false;
  const waiverId = useSelector((state) => state.waiverSession.waiverId);
  const viewMode = useSelector((state) => state.waiverSession.progress.viewMode) || false;
  const createNewWaiver = useSelector((state) => state.waiverSession.progress.createNewWaiver) || false;
  const viewCompleted = useSelector((state) => state.waiverSession.progress.viewCompleted) || false;
  
  // Get customer data and minors from Redux (saved by ConfirmCustomerInfo page)
  const reduxCustomerData = useSelector((state) => state.waiverSession.customerData);
  const reduxMinors = useSelector((state) => state.waiverSession.minors);

  // Route protection: Redirect if accessed directly without valid state
  useEffect(() => {
    if (!phone) {
      console.warn("No phone found in state, redirecting to home");
      navigate("/", { replace: true });
    }
  }, [phone, navigate]);

  const [form, setForm] = useState({
    date: "",
    fullName: "",
    consented: customerType === "existing" || isReturning,
    subscribed: false,
    minors: [],
  });


  // Load customer data from Redux (data comes from ConfirmCustomerInfo page)
  useEffect(() => {
    if (!phone || !reduxCustomerData) return;

    const loadCustomerData = async () => {
      setLoading(true);
      try {
        // Use Redux data instead of fetching from API
        const data = reduxCustomerData;
        setCustomerData(data);
        setForm((prev) => ({
          ...prev,
          date: new Date().toISOString().split("T")[0],
          fullName: `${data.first_name} ${data.last_name}`,
          minors: (reduxMinors || []).map((m) => ({
            id: m.id,
            first_name: m.first_name,
            last_name: m.last_name,
            dob: m.dob ? new Date(m.dob).toISOString().split("T")[0] : "",
            checked: m.checked !== undefined ? m.checked : (m.status === 1),
            isNew: m.isNew || false,
          })),
        }));

        // Only pre-fill signature when viewing a specific waiver OR when NOT creating a new waiver
        // For new waiver flow (createNewWaiver=true), don't pre-fill signature
        const shouldPreFillSignature = waiverId || (viewMode && !createNewWaiver);
        
        if (shouldPreFillSignature && (waiverId || customerId)) {
          try {
            const signatureResponse = waiverId
              ? await axios.get(`${BACKEND_URL}/api/waivers/get-signature?waiverId=${waiverId}`)
              : await axios.get(`${BACKEND_URL}/api/waivers/get-signature?customerId=${customerId}`);
            
            if (signatureResponse.data?.signature) {
              const signatureData = signatureResponse.data.signature;
              setSignatureImage(signatureData);
              
              // Pre-fill the signature pad
              setTimeout(() => {
                if (sigPadRef.current) {
                  try {
                    sigPadRef.current.fromDataURL(signatureData);
                  } catch (error) {
                    console.error("Failed to pre-fill signature:", error);
                  }
                }
              }, 100);
            }
          } catch (error) {
            console.log("No previous signature found or error fetching:", error);
            // Not a critical error, user can still sign manually
          }
        }
      } catch (error) {
        console.error("Failed to load customer data:", error);
        toast.error("We couldn't load your information. Please go back and try again.");
      } finally {
        setLoading(false);
      }
    };

    loadCustomerData();
  }, [phone, reduxCustomerData, reduxMinors, isReturning, customerId, waiverId, viewMode, createNewWaiver]);

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
    const updated = {
      ...form,
      [name]: type === "checkbox" ? checked : value,
    };
    setForm(updated);
  };

  const handleMinorChange = (index, field, value) => {
    const minors = [...form.minors];
    minors[index][field] = value;
    const updated = { ...form, minors };
    setForm(updated);
    
    // Clear error for this field when user types
    const errorKey = `${index}_${field}`;
    if (minorErrors[errorKey]) {
      const newErrors = { ...minorErrors };
      delete newErrors[errorKey];
      setMinorErrors(newErrors);
    }
  };

  const handleAddMinor = () => {
    const updated = {
      ...form,
      minors: [
        ...form.minors,
        { first_name: "", last_name: "", dob: "", checked: false, isNew: true },
      ],
    };
    setForm(updated);
  };

  const handleRemoveMinor = (index) => {
    const minors = [...form.minors];
    minors.splice(index, 1);
    const updated = { ...form, minors };
    setForm(updated);
    
    // Clear errors for removed minor and rebuild error keys for remaining minors
    const newErrors = {};
    Object.keys(minorErrors).forEach(key => {
      const [errorIndex, field] = key.split('_');
      const idx = parseInt(errorIndex);
      if (idx < index) {
        // Keep errors for minors before the removed one
        newErrors[key] = minorErrors[key];
      } else if (idx > index) {
        // Shift down errors for minors after the removed one
        const newKey = `${idx - 1}_${field}`;
        newErrors[newKey] = minorErrors[key];
      }
      // Skip errors for the removed minor (idx === index)
    });
    setMinorErrors(newErrors);
  };

  const handleClearSignature = () => {
    sigPadRef.current.clear();
    setSignatureImage(null);
  };

  const handleSubmit = async () => {
    // If in view mode (viewing existing waiver) AND NOT creating a new waiver, redirect directly to My Waivers
    if ((viewMode || viewCompleted) && !createNewWaiver) {
      navigate("/my-waivers", { replace: true });
      return;
    }

    // Prevent multiple submissions immediately
    if (submitting) return;
    setSubmitting(true);

    // Clear previous errors
    setMinorErrors({});

    if (!form.consented) {
      toast.error("Please review and check the consent box to proceed.");
      setSubmitting(false);
      return;
    }

    if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
      toast.error("Your signature is required to complete the waiver.");
      setSubmitting(false);
      return;
    }

    // Validate all minors and collect errors
    const validationErrors = {};
    let hasErrors = false;
    
    form.minors.forEach((minor, index) => {
      // Check if minor has any data entered
      const hasData = minor.first_name?.trim() || minor.last_name?.trim() || minor.dob;
      
      // Only validate minors that have some data entered
      if (hasData) {
        // Validate first name
        if (!minor.first_name || minor.first_name.trim() === '') {
          validationErrors[`${index}_first_name`] = 'First name is required';
          hasErrors = true;
        } else if (minor.first_name.trim().length < 2) {
          validationErrors[`${index}_first_name`] = 'First name must be at least 2 characters';
          hasErrors = true;
        }
        
        // Validate last name
        if (!minor.last_name || minor.last_name.trim() === '') {
          validationErrors[`${index}_last_name`] = 'Last name is required';
          hasErrors = true;
        } else if (minor.last_name.trim().length < 2) {
          validationErrors[`${index}_last_name`] = 'Last name must be at least 2 characters';
          hasErrors = true;
        }
        
        // Validate date of birth
        if (!minor.dob) {
          validationErrors[`${index}_dob`] = 'Date of birth is required';
          hasErrors = true;
        } else {
          const dobDate = new Date(minor.dob);
          const today = new Date();
          if (dobDate > today) {
            validationErrors[`${index}_dob`] = 'Date of birth cannot be in the future';
            hasErrors = true;
          }
        }
      }
    });

    // If there are validation errors, set them and show toast
    if (hasErrors) {
      setMinorErrors(validationErrors);
      toast.error("Please complete all required fields for each minor before continuing.");
      setSubmitting(false);
      return;
    }

    // Only include minors with all required fields filled
    const cleanedMinors = form.minors.filter(m => 
      m.first_name?.trim() && m.last_name?.trim() && m.dob
    );

    // Update form with cleaned minors
    const updatedForm = { ...form, minors: cleanedMinors };
    setForm(updatedForm);

    try {
      // Add white background before exporting
      const canvas = sigPadRef.current.getCanvas();
      const ctx = canvas.getContext("2d");
      
      // Save current composition operation
      const currentCompositeOperation = ctx.globalCompositeOperation;
      
      // Draw white background
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Get signature data as compressed JPEG
      const signatureData = canvas.toDataURL("image/jpeg", 0.6);
      
      // Restore original composition operation
      ctx.globalCompositeOperation = currentCompositeOperation;

      setSignatureImage(signatureData);
      dispatch(setSignatureImageRedux(signatureData));

      const payload = {
        id: customerData?.id || customerId,
        phone,
        date: updatedForm.date,
        fullName: updatedForm.fullName,
        minors: cleanedMinors,
        subscribed: updatedForm.subscribed,
        consented: updatedForm.consented,
        signature: signatureData,
      };

      console.log("Submitting signature payload:", { ...payload, signature: "..." });

      const response = await axios.post(`${BACKEND_URL}/api/waivers/save-signature`, payload);
      
      console.log("Signature saved successfully:", response.data);
 
      // Clear localStorage after signature submission for security
      localStorage.removeItem("signatureForm");
      
      toast.success("Thank you! Your waiver has been submitted successfully.");
      dispatch(setCurrentStep('RULE_REMINDER'));
      navigate("/rules", { replace: true });
    } catch (error) {
      console.error("Error saving signature:", error);
      if (error.response) {
        console.error("Response data:", error.response.data);
        toast.error(error.response.data?.error || "We couldn't save your signature. Please try again.");
      } else {
        toast.error("We couldn't save your signature. Please check your connection and try again.");
      }
      setSubmitting(false);
    }
  };

function formatPhone(phone = "") {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone; // fallback
}



  // if (!customerData) return <div className="text-center mt-5">Loading...</div>;

  if (loading) {
    return (
      <div className="container-fluid">
        <div className="container text-center mt-5">
          <p>Loading customer information...</p>
        </div>
      </div>
    );
  }

  const handleBackClick = () => {
    // Clear localStorage when going back
    localStorage.removeItem("signatureForm");
    
    // If in viewMode, go back to my waivers instead of confirm-info
    if (viewMode) {
      navigate("/my-waivers", { replace: true });
      return;
    }
    
    if (customerType === "new") {
      navigate("/verify-otp", { replace: true });
    } else {
      navigate("/confirm-info", { replace: true });
    }
  };

  return (
    <>
      <UserHeader showBack={customerType === "existing"} onBack={handleBackClick} />
      <div className="container-fluid">
        <div className="container">
          <div className="row">
            <div className="col-12">
              <h5 className="h5-heading my-3 mt-3 text-center">
                Assumption of Risk, Release and Indemnification 
              </h5>
            </div>
          </div>
        
      <div class="row"> 

        <div class="col-md-12 mx-auto"> 
              <p>
  BY SIGNING THIS DOCUMENT, YOU WILL WAIVE OR GIVE UP CERTAIN LEGAL RIGHTS INCLUDING THE RIGHT TO SUE OR CLAIM COMPENSATION FOLLOWING AN ACCIDENT - <strong>PLEASE READ CAREFULLY</strong>
</p>


                        {customerData && (
  <div className="info-table w-100 border p-3 my-4" style={{ fontSize: "14px" }}>
    <table cellPadding="8" cellSpacing="0" className="w-100">
      <tbody>
        <tr>
          <td><strong>Participant First Name:</strong><br /> <span> {customerData.first_name} </span> </td>
          <td><strong>Participant Last Name:</strong><br /> <span> {customerData.last_name } </span></td>
          
          <td><strong>Date of Birth:</strong><br /> <span>{customerData.dob?.split("T")[0]} </span> </td>
        
        </tr>
        <tr>
          <td><strong>Address:</strong><br /> <span> {customerData.address} </span></td>
          <td><strong>City:</strong><br /> <span> {customerData.city} </span></td>
          <td><strong>Province:</strong><br /> <span>{customerData.province} </span></td>
        
        </tr>
        <tr>
            <td><strong>Postal Code:</strong><br /> <span>{customerData.postal_code} </span></td>
       
          <td><strong>Cell Phone:</strong><br /> <span> {customerData.country_code} {formatPhone(customerData.cell_phone)} </span></td>
     
          <td><strong>Email:</strong><br /> <span> {customerData.email || '--'} </span></td>
        
        </tr>
      </tbody>
    </table>
  </div>
)}
        </div>
      </div>

                     <div class="row"> 

                        <div class="col-md-12 mx-auto"> 
                          
                            <p class="fs-6"> In consideration of being allowed to use the services, equipment, and facilities of Skate & Play Inc. (“SPI”), I hereby acknowledge 
and agree to the following terms and conditions: </p> <br></br>

                           <h6><strong>ASSUMPTION OF RISK:</strong> </h6>
                           <p>I hereby acknowledge, accept and agree that the use of or participation in SPIs Activities, as hereinafter defined, including the 
rink, and related activities, <strong>and the use of SPI’s services, equipment, and facilities </strong> is inherently dangerous which may result 
in serious injury or death resulting from my own actions, the actions of others, <strong>improper use of equipment, equipment 
failures, failure to act safely within one’s own ability, negligence of other persons, negligent first aid and negligence </strong>
on the part of the SPI. I understand that negligence includes failure on the part of SPI to take reasonable steps to safeguard or 
protect me from the risks, dangers and hazards of participating in SPI’s Activities. I freely accept and fully assume all risks, 
dangers and hazards associated with SPI Activities and the possibility of personal injury, death, property damage or loss 
resulting therefrom. I have received full information regarding SPI’s services, equipment, and facilities and have had the 
opportunity to ask any questions I may have regarding same. </p><br></br>

                            <h6><strong>MEDICAL CONDITION: </strong> </h6>
                            <p>Participation in a session may place unusual stresses on the body and is not recommended for persons suffering from asthma, 
epilepsy, cardio disorders, respiratory disorders, hypertension, skeletal, joint or ligament problems or conditions, and certain 
mental illnesses. Women who are pregnant or suspect they are pregnant and persons who have consumed alcohol or are 
otherwise intoxicated are not recommended to engage in activities.</p>
                          

                           

                                <p class="my-4"> <strong>{form.fullName || "_______"}</strong>&nbsp;&nbsp;  I agree that I will be responsible for property damage as a result of any unauthorized activity. </p>
                           
<p class="paragraph-heading"> RELEASE OF LIABILITY, WAIVER OF CLAIMS AND INDEMNITY AGREEMENT </p>
<p>In consideration of SPI agreeing to my participation, and permitting my use of SPIs equipment, room, and other facilities I hereby agree as follows: </p>
 <p class="paragraph-heading"> In this Release Agreement the term “Activities” shall include all activities, functions, events, orientations, 
instruction sessions, competitions and services provided, arranged, organized, sponsored or authorized by SPI </p>


                            <p class="my-4"> <span class="paragraph-heading"> TO WAIVE ANY AND ALL CLAIMS AND TO RELEASE SPI </span>  from any and all liability for any loss, cost, damage, expense, or 
injury including death that I may suffer, or that my next of kin may suffer, due to any cause whatsoever during participation in any 
Activity including as a result of: negligence, breach of contract, or breach of any statutory or other duty care on the part of SPI in 
respect of the provision of or the failure to provide any warnings, ,<strong>failure of equipment,</strong> directions or instructions as to the 
Activities or the risks, dangers and hazards of participating in the Activities. I understand that negligence includes the failure on the 
part of SPI to take reasonable steps to safeguard or protect me from the risks.</p> 

                            <p> <span class="paragraph-heading"> TO HOLD HARMLESS AND INDEMNIFY SPI </span> from any and all liability for any property damage or personal injury to any third party resulting from any of my actions. </p>
<p> This waiver shall be effective in the Province of Ontario and binding upon my heirs, next of kin, executors, and administrators in the event of death, injury or incapacity. </p>
<p> Any litigation involving the parties to this document shall be brought solely within the Province of Ontario and shall be within the exclusive jurisdiction of the Courts residing in the City of Ottawa. </p>

                            <p class="my-4"><strong>{form.fullName || "_______"}</strong>&nbsp;&nbsp; <strong>  PHOTOGRAPH / VIDEO RELEASEInitial</strong>&nbsp;&nbsp;   I consent to photographs and videos being taken of me during my 
participation at SPI, and to the publication of the photographs and videos for advertising, promotional, and marketing purposes. I 
waive any and all claims against SPI arising out of SPI’s use of my photographic or video representation of me, including claims 
relating to defamation or invasion of any copyright, privacy, personality or publicity rights. I agree not to claim compensation from 
SPI for the use of photographic or video representation of me during my participation in SPI’s Activities. 
 </p>

                            <p class="my-4"><strong>{form.fullName || "_______"}</strong>&nbsp;&nbsp;  You agree that skating while under the influence of alcohol or any other drugs is strictly prohibited, as it significantly 
increases the risk of injury to yourself and others.  </p>

  <p class="my-4"><strong>{form.fullName || "_______"}</strong>&nbsp;&nbsp;  We encourage everyone to wear protective gear. You understand that Skate & Play Inc. has encouraged you to wear 
full protective gear, and by waiving that right, you acknowledge and accept all associated risks.   </p>


                            <p class="my-4"> In entering into the waiver, I am not relying on any oral or written representations or statements made my SPI with respect to the 
safety of the rooms other than what is set forth in this waiver.  </p>

                            <p class="my-4"> BY COMPLETING THIS FORM I HEREBY ACKNOWLEDGE THAT I AM NOT INTOXICATED NOR HAVE I CONSUMED ANY 
OTHER SUBSTANCES THAT MAY RESULT IN MY JUDGEMENT BEING IMPAIRED. I HEREBY ASSUME FULL 
RESPONSIBILITY FOR MY ACTIONS, RISKS, DANGERS, AND HAZARDS RESULTING FROM THE USE OF THE FACILITIES 
AND PARTICIPATION THE ACTIVITIES WHILE UNDER THE INFLUENCE OF ALCOHOL OR MIND ALTERING 
SUBSTANCES. I UNDERSTAND THAT AM GIVING UP CERTAIN RIGHTS WHICH I OR MY HEIRS, NEXT OF KIN, 
EXECUTORS, ADMINISTRATORS AND ASSIGNS MAY HAVE. THAT I AM AT LEAST 18 YEARS OLD AS OF THE DAY THIS 
FORM WAS FILLED OUT. I FREELY ACCEPT AND ASSUME ALL RISKS, DANGERS AND HAZARDS AND THE POSSIBILITY 
OF RESULTING PERSONAL INJURY, DEATH, PROPERTY DAMAGE OR LOSS DIRECTLY OR INDIRECTLY ASSOCIATED 
WITH MY PARTICIPATION IN THE ACTIVITY. I HAVE READ THIS RELEASE AGREEMENT AND FULLY UNDERSTAND ITS 
CONTENTS AND VOLUNTARILY AGREE TO ITS TERMS  </p> 

<p>I CONFIRM THAT I HAVE READ AND UNDERSTAND THIS WAIVER PRIOR TO SIGNING IT, AND I AM AWARE THAT BY 
SIGNING THIS WAIVER I AM WAIVING CERTIAN LEGAL RIGHTS WHICH I OR MY HEIRS, NEXT OF KIN, EXECUTORS, 
AND ADMINISTRATORS MAY HAVE AGAINST SKATE & PLAY INC. </p>

            {/* Minor fields at top */}
            {form.minors.filter(minor => isReturning ? minor.checked : true).map((minor, index) => (
              <div key={index} className="my-3 no-print">
                <div className="row g-2 align-items-start">
                  <div className="col-12 col-md-3">
                    <input
                      type="date"
                      className={`form-control ${minorErrors[`${index}_dob`] ? 'is-invalid' : ''}`}
                      value={minor.dob}
                      onChange={(e) => handleMinorChange(index, "dob", e.target.value)}
                      readOnly={!minor.isNew}
                      style={{
                        backgroundColor: '#e9ecef',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '10px 15px',
                        cursor: minor.isNew ? 'text' : 'not-allowed'
                      }}
                    />
                    {minorErrors[`${index}_dob`] && (
                      <div className="text-danger small mt-1">{minorErrors[`${index}_dob`]}</div>
                    )}
                  </div>
                  
                  <div className="col-12 col-md-3">
                    <input
                      type="text"
                      className={`form-control ${minorErrors[`${index}_first_name`] ? 'is-invalid' : ''}`}
                      placeholder="First Name"
                      value={minor.first_name}
                      onChange={(e) => handleMinorChange(index, "first_name", e.target.value)}
                      readOnly={!minor.isNew}
                      style={{
                        backgroundColor: '#e9ecef',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '10px 15px',
                        cursor: minor.isNew ? 'text' : 'not-allowed'
                      }}
                    />
                    {minorErrors[`${index}_first_name`] && (
                      <div className="text-danger small mt-1">{minorErrors[`${index}_first_name`]}</div>
                    )}
                  </div>
                  
                  <div className="col-12 col-md-3">
                    <input
                      type="text"
                      className={`form-control ${minorErrors[`${index}_last_name`] ? 'is-invalid' : ''}`}
                      placeholder="Last Name"
                      value={minor.last_name}
                      onChange={(e) => handleMinorChange(index, "last_name", e.target.value)}
                      readOnly={!minor.isNew}
                      style={{
                        backgroundColor: '#e9ecef',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '10px 15px',
                        cursor: minor.isNew ? 'text' : 'not-allowed'
                      }}
                    />
                    {minorErrors[`${index}_last_name`] && (
                      <div className="text-danger small mt-1">{minorErrors[`${index}_last_name`]}</div>
                    )}
                  </div>
                  
                  <div className="col-12 col-md-3">
                    {minor.isNew ? (
                      <button 
                        className="btn w-100" 
                        onClick={() => handleRemoveMinor(index)}
                        style={{
                          backgroundColor: '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '10px 15px',
                          fontSize: '14px',
                          fontWeight: '500'
                        }}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            
            {!isReturning && (
              <div className="my-3 no-print">
                <div className="row g-2 align-items-start">
                  <div className="col-12 col-md-9"></div>
                  <div className="col-12 col-md-3">
                    <button 
                      className="btn btn-primary w-100" 
                      onClick={handleAddMinor}
                      style={{
                        backgroundColor: '#007bff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '10px 15px',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                    >
                      Add another minor
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="confirm-box mt-4 mb-4 no-print">
              <label className="d-flex align-items-start gap-2">
                <input
                  type="checkbox"
                  className="custom-checkbox mt-1"
                  name="consented"
                  checked={form.consented}
                  onChange={handleChange}
                  style={{ width: '24px', height: '24px', cursor: 'pointer', flexShrink: 0 }}
                />
                <span style={{ fontSize: '16px', lineHeight: '1.5' }}>
                  <strong>By checking this box, you confirm signingfor yourself and all listed minors or
                  dependents above, as of the provided date.</strong> 
                </span>
              </label>
            </div>

            <div className="signature-section mb-4 no-print col-sm-6">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div style={{ color: '#6c757d', fontSize: '14px' }}>Please sign here:</div>
                <div 
                  style={{ cursor: "pointer", color: "#999", fontSize: '14px', textDecoration: 'none' }} 
                  onClick={handleClearSignature}
                >
                  ✕ Clear
                </div>
              </div>

              <div style={{ 
                border: '2px dashed #ccc', 
                borderRadius: '4px',
                padding: '10px',
                backgroundColor: '#fff',
                width: '100%',
                maxWidth: '600px'
              }}>
                <SignaturePad
                  ref={sigPadRef}
                  canvasProps={{ 
                    width: 600, 
                    height: 200, 
                    style: { 
                      width: '600px', 
                      height: '200px',
                      display: 'block'
                    } 
                  }}
                />
              </div>

              <div className="text-center mt-4">
                <button 
                  className="btn btn-primary" 
                  onClick={handleSubmit} 
                  disabled={submitting}
                  style={{
                    backgroundColor: '#007bff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 60px',
                    fontSize: '16px',
                    fontWeight: '500',
                    minWidth: '500px'
                  }}
                >
                  {submitting 
                    ? "Processing..." 
                    : (viewCompleted || viewMode) && !createNewWaiver
                      ? "Return to My Waivers"
                      : "Accept and continue"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

export default Signature;
