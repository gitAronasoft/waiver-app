import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SignaturePad from "react-signature-canvas";
import axios from "axios";
import { toast } from 'react-toastify';
import { BACKEND_URL } from '../config';




function Signature() {
  const location = useLocation();
  const navigate = useNavigate();
  const sigPadRef = useRef();

  const [signatureImage, setSignatureImage] = useState(null);
  const [initials, setInitials] = useState("");
  const [customerData, setCustomerData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [minorErrors, setMinorErrors] = useState({});

  const customerType = location.state?.customerType || "existing";
  const phone = location.state?.phone;
  const customerId = location.state?.customerId;
  const isReturning = location.state?.isReturning || false;

  const [form, setForm] = useState({
    date: "",
    fullName: "",
    consented: isReturning,
    subscribed: false,
    minors: [],
  });

  // Utility to persist form data
  const persistToLocalStorage = (updatedForm) => {
    localStorage.setItem(
      "signatureForm",
      JSON.stringify({
        form: updatedForm || form,
        initials,
        signatureImage,
      })
    );
  };

  // Load data from localStorage
  useEffect(() => {
    const savedData = localStorage.getItem("signatureForm");
    if (savedData) {
      const parsed = JSON.parse(savedData);
      setForm(parsed.form);
      setInitials(parsed.initials || "");
      setSignatureImage(parsed.signatureImage || null);

      if (parsed.signatureImage) {
        // Wait for component to fully mount and signature pad to be ready
        const restoreSignature = () => {
          if (sigPadRef.current) {
            try {
              sigPadRef.current.fromDataURL(parsed.signatureImage);
            } catch (error) {
              console.error("Failed to restore signature:", error);
            }
          }
        };
        
        // Try multiple times with increasing delays to ensure pad is ready
        setTimeout(restoreSignature, 100);
        setTimeout(restoreSignature, 500);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save data to localStorage whenever form/signature changes
  useEffect(() => {
    persistToLocalStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, initials, signatureImage]);

  // Fetch customer data and pre-fill signature for returning users
  useEffect(() => {
    if (!phone) return;

    const savedData = localStorage.getItem("signatureForm");
    if (savedData) {
      const parsed = JSON.parse(savedData);
      const hasData =
        parsed.form &&
        (parsed.form.fullName ||
          (parsed.form.minors && parsed.form.minors.length > 0));

      if (hasData) {
        console.log("Skipping fetch because saved data has content");
        return;
      }
    }

    const fetchCustomer = async () => {
      setLoading(true);
      try {
        const endpoint = location.state?.formData 
          ? null 
          : `${BACKEND_URL}/api/waivers/getminors?phone=${phone}`;
        
        let data;
        if (location.state?.formData) {
          // Use data from confirm-info page
          data = location.state.formData;
          setCustomerData(data);
          setForm((prev) => ({
            ...prev,
            date: new Date().toISOString().split("T")[0],
            fullName: `${data.first_name} ${data.last_name}`,
            minors: (data.minors || []).map((m) => ({
              id: m.id,
              first_name: m.first_name,
              last_name: m.last_name,
              dob: m.dob ? new Date(m.dob).toISOString().split("T")[0] : "",
              checked: m.checked || m.status === 1,
              isNew: m.isNew || false,
            })),
          }));
        } else {
          // Fetch from API
          const response = await axios.get(endpoint);
          data = response.data;
          setCustomerData(data);
          setForm((prev) => ({
            ...prev,
            date: new Date().toISOString().split("T")[0],
            fullName: `${data.first_name} ${data.last_name}`,
            minors: (data.minors || []).map((m) => ({
              id: m.id,
              first_name: m.first_name,
              last_name: m.last_name,
              dob: m.dob ? new Date(m.dob).toISOString().split("T")[0] : "",
              checked: m.status === 1,
              isNew: false,
            })),
          }));
        }

        // Pre-fill signature for returning users
        if (isReturning && customerId) {
          try {
            const signatureResponse = await axios.get(
              `${BACKEND_URL}/api/waivers/get-signature?customerId=${customerId}`
            );
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
        console.error("Failed to fetch customer data:", error);
        toast.error("Failed to load customer data.");
      } finally {
        setLoading(false);
      }
    };

    fetchCustomer();
  }, [phone, isReturning, customerId, location.state?.formData]);

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
    const updated = {
      ...form,
      [name]: type === "checkbox" ? checked : value,
    };
    setForm(updated);
    persistToLocalStorage(updated);
  };

  const validateMinorField = (index, field, value) => {
    const errors = { ...minorErrors };
    const errorKey = `${index}_${field}`;
    
    if (field === 'first_name' || field === 'last_name') {
      if (value.trim() === '') {
        errors[errorKey] = `${field === 'first_name' ? 'First' : 'Last'} name is required`;
      } else if (value.trim().length < 2) {
        errors[errorKey] = `${field === 'first_name' ? 'First' : 'Last'} name must be at least 2 characters`;
      } else {
        delete errors[errorKey];
      }
    } else if (field === 'dob') {
      if (!value) {
        errors[errorKey] = 'Date of birth is required';
      } else {
        const dobDate = new Date(value);
        const today = new Date();
        if (dobDate > today) {
          errors[errorKey] = 'Date of birth cannot be in the future';
        } else {
          delete errors[errorKey];
        }
      }
    }
    
    setMinorErrors(errors);
  };

  const handleMinorChange = (index, field, value) => {
    const minors = [...form.minors];
    minors[index][field] = value;
    const updated = { ...form, minors };
    setForm(updated);
    persistToLocalStorage(updated);
    
    // Validate the field if it's checked
    if (minors[index].checked) {
      validateMinorField(index, field, value);
    }
  };

  const handleMinorCheckbox = (index) => {
    const minors = [...form.minors];
    minors[index].checked = !minors[index].checked;
    const updated = { ...form, minors };
    setForm(updated);
    persistToLocalStorage(updated);
    
    // Update validation errors in a single batch
    setMinorErrors(prevErrors => {
      const errors = { ...prevErrors };
      
      if (minors[index].checked) {
        // If checking the box, validate all fields immediately
        const fields = [
          { name: 'first_name', value: minors[index].first_name, label: 'First' },
          { name: 'last_name', value: minors[index].last_name, label: 'Last' },
          { name: 'dob', value: minors[index].dob, label: 'DOB' }
        ];
        
        fields.forEach(({ name, value, label }) => {
          const errorKey = `${index}_${name}`;
          
          if (name === 'first_name' || name === 'last_name') {
            if (!value || value.trim() === '') {
              errors[errorKey] = `${label} name is required`;
            } else if (value.trim().length < 2) {
              errors[errorKey] = `${label} name must be at least 2 characters`;
            } else {
              delete errors[errorKey];
            }
          } else if (name === 'dob') {
            if (!value) {
              errors[errorKey] = 'Date of birth is required';
            } else {
              const dobDate = new Date(value);
              const today = new Date();
              if (dobDate > today) {
                errors[errorKey] = 'Date of birth cannot be in the future';
              } else {
                delete errors[errorKey];
              }
            }
          }
        });
      } else {
        // If unchecking, clear validation errors for this minor
        delete errors[`${index}_first_name`];
        delete errors[`${index}_last_name`];
        delete errors[`${index}_dob`];
      }
      
      return errors;
    });
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
    persistToLocalStorage(updated);
  };

  const handleRemoveMinor = (index) => {
    const minors = [...form.minors];
    minors.splice(index, 1);
    const updated = { ...form, minors };
    setForm(updated);
    persistToLocalStorage(updated);
    
    // Clear all validation errors and rebuild for remaining minors
    const newErrors = {};
    minors.forEach((minor, newIndex) => {
      if (minor.checked) {
        // Re-validate remaining checked minors with their new indices
        const fields = ['first_name', 'last_name', 'dob'];
        fields.forEach(field => {
          const errorKey = `${newIndex}_${field}`;
          const value = minor[field];
          
          if (field === 'first_name' || field === 'last_name') {
            if (!value || value.trim() === '') {
              newErrors[errorKey] = `${field === 'first_name' ? 'First' : 'Last'} name is required`;
            } else if (value.trim().length < 2) {
              newErrors[errorKey] = `${field === 'first_name' ? 'First' : 'Last'} name must be at least 2 characters`;
            }
          } else if (field === 'dob') {
            if (!value) {
              newErrors[errorKey] = 'Date of birth is required';
            } else {
              const dobDate = new Date(value);
              const today = new Date();
              if (dobDate > today) {
                newErrors[errorKey] = 'Date of birth cannot be in the future';
              }
            }
          }
        });
      }
    });
    
    setMinorErrors(newErrors);
  };

  const handleClearSignature = () => {
    sigPadRef.current.clear();
    setSignatureImage(null);
    persistToLocalStorage();
  };

  const handleSubmit = async () => {
    if (!form.consented) {
      toast.error("Please agree to the terms by checking the consent box.");
      return;
    }

    if (sigPadRef.current.isEmpty()) {
      toast.error("Please provide your signature before continuing.");
      return;
    }

    // For returning users: only include checked minors (unchecked minors are from previous visits)
    // For new users: keep unchecked minors with data to trigger validation error
    const cleanedMinors = form.minors.filter(m => {
      if (isReturning) {
        // For returning users, only include checked minors
        return m.checked;
      } else {
        // For new users, remove only completely empty unchecked minors
        if (!m.checked) {
          const hasData = m.first_name.trim() || m.last_name.trim() || m.dob;
          return hasData;
        }
        return true;
      }
    });

    // Update form with cleaned minors
    const updatedForm = { ...form, minors: cleanedMinors };
    setForm(updatedForm);

    // Check if there are minors added but not checked (only for new users)
    if (!isReturning) {
      const uncheckedMinors = cleanedMinors.filter(m => !m.checked);
      const uncheckedWithData = uncheckedMinors.filter(
        m => m.first_name.trim() || m.last_name.trim() || m.dob
      );
      
      if (uncheckedWithData.length > 0) {
        toast.error(`You have added ${uncheckedWithData.length} minor(s) but haven't checked the box to include them. Please check the box next to each minor you want to include, or remove them.`);
        return;
      }
    }

    const checkedMinors = cleanedMinors.filter(m => m.checked);
    if (checkedMinors.length > 0) {
      const invalidMinors = checkedMinors.filter(
        m => !m.first_name.trim() || !m.last_name.trim() || !m.dob
      );
      
      if (invalidMinors.length > 0) {
        toast.error("Please complete all information (first name, last name, and date of birth) for all checked minors.");
        return;
      }

      const minorsWithFutureDOB = checkedMinors.filter(m => {
        const dobDate = new Date(m.dob);
        const today = new Date();
        return dobDate > today;
      });

      if (minorsWithFutureDOB.length > 0) {
        toast.error("Date of birth cannot be in the future for any minor.");
        return;
      }
    }

    setSubmitting(true);

    //const signatureData = sigPadRef.current.getCanvas().toDataURL("image/png");
    // const signatureData = sigPadRef.current.getCanvas().toDataURL("image/jpeg", 0.6); // ✅ Compress signature

       // ✅ Add white background before exporting
    const canvas = sigPadRef.current.getCanvas();
    const ctx = canvas.getContext("2d");
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const signatureData = canvas.toDataURL("image/jpeg", 0.6); // compressed JPEG with white background

    setSignatureImage(signatureData);

    const payload = {
      id: customerData?.id,
      phone,
      date: updatedForm.date,
      fullName: updatedForm.fullName,
      minors: cleanedMinors,
      subscribed: updatedForm.subscribed,
      consented: updatedForm.consented,
      signature: signatureData,
    };

    try {
      await axios.post(`${BACKEND_URL}/api/waivers/save-signature`, payload);
 
      // Clear localStorage after successful submission
      localStorage.removeItem("signatureForm");
      
      toast.success("Signature submitted sucessfully.");
      navigate("/rules", {
        state: { userId: customerData?.id, phone, customerType },
      });
    } catch (error) {
      console.error(error);
      toast.error("Failed to save signature.");
    } finally {
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

  return (
    <div className="container-fluid">
      <div className="container">
        <div className="row">
          <div className="col-md-2">
            {/* <div className="back-btn">
              <a href="/existing-customer">
                <img src="/assets/img/image 298.png" className="img-fluid" alt="back" /> BACK
              </a>
            </div> */}
                      <div className="back-btn no-print" style={{ cursor: "pointer" }} onClick={() => {
                        // Clear localStorage when going back
                        localStorage.removeItem("signatureForm");
                        
                        if (customerType === "new") {
                          navigate("/verify-otp", { state: { phone, customerType } });
                        } else {
                          navigate("/confirm-info", { 
                            state: { 
                              phone, 
                              customerType,
                              customerId,
                              isReturning
                            } 
                          });
                        }
                      }}>
                         
                        <img src="/assets/img/image 298.png" className="img-fluid" alt="back" /> BACK
                       
                      </div>
          </div>



          <div className="col-12 col-md-8 col-xl-8">
            <div className="step-two step-three">
              <div className="logo">
                <img
                  src="/assets/img/SKATE_AND_PLAY_V08_Full_Transparency (2) 1.png"
                  className="img-fluid"
                  alt="logo"
                />
              </div>
              <h5 className="h5-heading my-3 mt-3 text-center">
               Assumption of Risk, Release and Indemnification 
              </h5>
            </div>
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
                           

                            <p class="paragraph-heading"> RELEASE OF LIABILITY, WAIVER OF CLAIMS AND INDEMNITY AGREEMENT </p><br></br>

                           <p>In consideration of SPI agreeing to my participation, and permitting my use of SPIs equipment, room, and other facilities I hereby agree 
as follows: </p><br></br>

                            <p class="paragraph-heading"> In this Release Agreement the term “Activities” shall include all activities, functions, events, orientations, 
instruction sessions, competitions and services provided, arranged, organized, sponsored or authorized by SPI </p>


                            <p class="my-4"> <span class="paragraph-heading"> TO WAIVE ANY AND ALL CLAIMS AND TO RELEASE SPI </span>  from any and all liability for any loss, cost, damage, expense, or 
injury including death that I may suffer, or that my next of kin may suffer, due to any cause whatsoever during participation in any 
Activity including as a result of: negligence, breach of contract, or breach of any statutory or other duty care on the part of SPI in 
respect of the provision of or the failure to provide any warnings, ,<strong>failure of equipment,</strong> directions or instructions as to the 
Activities or the risks, dangers and hazards of participating in the Activities. I understand that negligence includes the failure on the 
part of SPI to take reasonable steps to safeguard or protect me from the risks.</p> 

                            <p> <span class="paragraph-heading"> TO HOLD HARMLESS AND INDEMNIFY SPI </span> from any and all liability for any property damage or personal injury to any third 
party resulting from any of my actions. </p><br></br>

                            <p> This waiver shall be effective in the Province of Ontario and binding upon my heirs, next of kin, executors, and administrators in the 
event of death, injury or incapacity. </p><br></br><br></br>

                            <p> Any litigation involving the parties to this document shall be brought solely within the Province of Ontario and shall be within the 
exclusive jurisdiction of the Courts residing in the City of Ottawa. </p>

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

<p> <span class="paragraph-heading">I CONFIRM THAT I HAVE READ AND UNDERSTAND THIS WAIVER PRIOR TO SIGNING IT, AND I AM AWARE THAT BY 
SIGNING THIS WAIVER I AM WAIVING CERTIAN LEGAL RIGHTS WHICH I OR MY HEIRS, NEXT OF KIN, EXECUTORS, 
AND ADMINISTRATORS MAY HAVE AGAINST SKATE & PLAY INC. </span> </p>

            {!isReturning && <h5 className="mt-4 mb-3">Please check mark to sign on behalf of the below minor or dependent</h5>}
            {form.minors.filter(minor => isReturning ? minor.checked : true).map((minor, index) => (
              <div key={index} className="minor-group my-3 p-3 border rounded" style={{ backgroundColor: minor.checked ? '#f0f8ff' : '#fff' }}>
                <div className="d-flex gap-2 align-items-start w-100">
                  <div className="form-check mt-2">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                      checked={minor.checked}
                      onChange={() => handleMinorCheckbox(index)}
                      id={`minor-check-${index}`}
                      aria-label={`Include minor ${index + 1} in waiver`}
                    />
                  </div>
                  
                  <div className="flex-grow-1">
                    <div className="row g-2">
                      <div className="col-md-3 col-sm-6">
                        <input
                          type="text"
                          className={`form-control ${minorErrors[`${index}_first_name`] ? 'is-invalid' : ''}`}
                          placeholder="Minor First Name *"
                          value={minor.first_name}
                          onChange={(e) => handleMinorChange(index, "first_name", e.target.value)}
                          readOnly={!minor.isNew}
                          style={!minor.isNew ? { backgroundColor: '#e9ecef', cursor: 'not-allowed' } : {}}
                        />
                        {minorErrors[`${index}_first_name`] && (
                          <div className="invalid-feedback d-block">
                            {minorErrors[`${index}_first_name`]}
                          </div>
                        )}
                      </div>
                      <div className="col-md-3 col-sm-6">
                        <input
                          type="text"
                          className={`form-control ${minorErrors[`${index}_last_name`] ? 'is-invalid' : ''}`}
                          placeholder="Minor Last Name *"
                          value={minor.last_name}
                          onChange={(e) => handleMinorChange(index, "last_name", e.target.value)}
                          readOnly={!minor.isNew}
                          style={!minor.isNew ? { backgroundColor: '#e9ecef', cursor: 'not-allowed' } : {}}
                        />
                        {minorErrors[`${index}_last_name`] && (
                          <div className="invalid-feedback d-block">
                            {minorErrors[`${index}_last_name`]}
                          </div>
                        )}
                      </div>
                      <div className="col-md-3 col-sm-6">
                        <input
                          type="date"
                          className={`form-control ${minorErrors[`${index}_dob`] ? 'is-invalid' : ''}`}
                          value={minor.dob}
                          onChange={(e) => handleMinorChange(index, "dob", e.target.value)}
                          placeholder="Date of Birth *"
                          readOnly={!minor.isNew}
                          style={!minor.isNew ? { backgroundColor: '#e9ecef', cursor: 'not-allowed' } : {}}
                        />
                        {minorErrors[`${index}_dob`] && (
                          <div className="invalid-feedback d-block">
                            {minorErrors[`${index}_dob`]}
                          </div>
                        )}
                      </div>
                      <div className="col-md-3 col-sm-6 d-flex align-items-start">
                        {minor.isNew && (
                          <button type="button" className="btn btn-danger btn-sm no-print w-100" onClick={() => handleRemoveMinor(index)}>
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {!isReturning && (
              <button className="btn btn-secondary my-2 no-print" onClick={handleAddMinor}>
                Add another minor
              </button>
            )}

              {/* <div className="mt-3 mb-4 no-print">
                <label>
                  <input
                    type="checkbox"
                    name="subscribed"
                    checked
                    onChange={handleChange}
                  />{" "}
                  I would like to subscribe to updates from Elevation Trampoline South Shore
                </label>
              </div> */}



            <div className="confirm-box mt-4 mb-3 no-print">
              <label className="custom-checkbox-wrapper">
                <input
                  type="checkbox"
                  className="custom-checkbox"
                  name="consented"
                  checked={form.consented}
                  onChange={handleChange}
                />
                <span className="custom-checkbox-label">
                  <h5>
                    By checking this box, you confirm signing for yourself and all listed minors or
                    dependents above, as of the provided date.
                  </h5>
                </span>
              </label>
            </div>

            <div className="signature-section mx-auto w-50 mb-4">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div class="no-print">Please sign here:</div>
                <div  class="no-print" style={{ cursor: "pointer", color: "red" }} onClick={handleClearSignature}>
                  ✕ Clear
                </div>
              </div>

              <SignaturePad
                ref={sigPadRef}
                canvasProps={{ width: 500, height: 150, className: "border" }}
              />

       

              <div>
                <button className="btn btn-primary no-print" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? "Submitting..." : "Accept and Continue"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Signature;
