import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import "../styles/auth-pages.css";

const API = "http://localhost:8080/api";

const readError = (error, fallback) => (
  error?.response?.data?.message
  || error?.response?.data?.error
  || error?.message
  || fallback
);

const RegisterPage = () => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [form, setForm] = useState({
    username: "",
    password: "",
    fullName: "",
    role: "CUSTOMER",
    mobileNumber: "",
    address: "",
    idProofImage: "",
    profileImage: "",
  });
  const [activeCameraTarget, setActiveCameraTarget] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
    setActiveCameraTarget("");
  };

  const startCamera = async (target) => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMessage("Camera is not supported in this browser.");
        setIsSuccess(false);
        return;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      setCameraReady(false);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      setActiveCameraTarget(target);
    } catch {
      setMessage("Unable to access camera. Please allow camera permission.");
      setIsSuccess(false);
    }
  };

  useEffect(() => {
    if (!activeCameraTarget || !videoRef.current || !streamRef.current) return;

    const video = videoRef.current;
    video.srcObject = streamRef.current;

    const handleLoadedMeta = async () => {
      try {
        await video.play();
        setCameraReady(true);
      } catch {
        setMessage("Camera preview could not start. Please retry camera capture.");
        setIsSuccess(false);
      }
    };

    video.addEventListener("loadedmetadata", handleLoadedMeta);
    if (video.readyState >= 2) {
      handleLoadedMeta();
    }

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMeta);
    };
  }, [activeCameraTarget]);

  const capturePhoto = (target) => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL("image/jpeg", 0.9);

    setForm((prev) => ({ ...prev, [target]: imageData }));
    stopCamera();
  };

  const register = async (event) => {
    event.preventDefault();
    const requiresProfile = form.role === "CUSTOMER" || form.role === "DRIVER";
    if (requiresProfile && (!form.mobileNumber.trim() || !form.address.trim() || !form.idProofImage || !form.profileImage)) {
      setMessage("Mobile number, address, ID proof image, and profile image are required for Customer/Driver registration.");
      setIsSuccess(false);
      return;
    }

    try {
      await axios.post(`${API}/auth/register`, form);
      setMessage("Registration successful. Continue to Sign In.");
      setIsSuccess(true);
    } catch (error) {
      setMessage(readError(error, "Registration failed"));
      setIsSuccess(false);
    }
  };

  return (
    <main className="auth-shell auth-register-theme">
      <section className="auth-showcase" aria-label="Platform capabilities">
        <p className="auth-eyebrow">Operations Workspace</p>
        <h1 className="auth-showcase-title">Create your secure fleet account</h1>
        <p className="auth-showcase-copy">
          Join the logistics command center to manage drivers, monitor routes, and resolve issues quickly.
        </p>

        <div className="auth-feature-grid">
          <article className="auth-feature-card">
            <h2>Real-Time Dashboard</h2>
            <p>Monitor active rides, statuses, and route anomalies in one place.</p>
          </article>
          <article className="auth-feature-card">
            <h2>Analytics Insights</h2>
            <p>View trend data to improve safety, efficiency, and delivery accuracy.</p>
          </article>
          <article className="auth-feature-card">
            <h2>Role Profiles</h2>
            <p>Assign customer, driver, or admin access using clear permission rules.</p>
          </article>
        </div>
      </section>

      <section className="auth-panel" aria-label="Create account form">
        <div className="auth-panel-header">
          <p className="auth-kicker">Account setup</p>
          <h2>Register</h2>
          <p className="auth-subtitle">Fill in your details to get started.</p>
        </div>

        <form className="auth-form" onSubmit={register}>
          <label htmlFor="register-fullName">Full Name</label>
          <input
            id="register-fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            required
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />

          <label htmlFor="register-username">Username</label>
          <input
            id="register-username"
            name="username"
            type="text"
            autoComplete="username"
            required
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />

          <label htmlFor="register-password">Password</label>
          <input
            id="register-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />

          <label htmlFor="register-role">Role</label>
          <select
            id="register-role"
            name="role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="CUSTOMER">CUSTOMER</option>
            <option value="DRIVER">DRIVER</option>
            <option value="ADMIN">ADMIN</option>
          </select>

          <label htmlFor="register-mobileNumber">Mobile Number</label>
          <input
            id="register-mobileNumber"
            name="mobileNumber"
            type="tel"
            required={form.role === "CUSTOMER" || form.role === "DRIVER"}
            value={form.mobileNumber}
            onChange={(e) => setForm({ ...form, mobileNumber: e.target.value })}
            placeholder="10-digit mobile number"
          />

          <label htmlFor="register-address">Address</label>
          <textarea
            id="register-address"
            name="address"
            required={form.role === "CUSTOMER" || form.role === "DRIVER"}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Enter full address"
            rows={3}
          />

          <label>ID Proof Image (Camera Capture)</label>
          <div className="auth-camera-actions">
            <button type="button" className="auth-submit-btn" onClick={() => startCamera("idProofImage")}>Open Camera for ID Proof</button>
            {form.idProofImage && <button type="button" className="auth-submit-btn auth-camera-retake" onClick={() => setForm((prev) => ({ ...prev, idProofImage: "" }))}>Retake ID Proof</button>}
          </div>
          {form.idProofImage && <img src={form.idProofImage} alt="ID proof preview" className="auth-id-preview" />}

          <label>Driver/Customer Profile Image (Camera Capture)</label>
          <div className="auth-camera-actions">
            <button type="button" className="auth-submit-btn" onClick={() => startCamera("profileImage")}>Open Camera for Profile</button>
            {form.profileImage && <button type="button" className="auth-submit-btn auth-camera-retake" onClick={() => setForm((prev) => ({ ...prev, profileImage: "" }))}>Retake Profile Photo</button>}
          </div>
          {form.profileImage && <img src={form.profileImage} alt="Profile preview" className="auth-id-preview" />}

          {activeCameraTarget && (
            <div className="auth-camera-panel">
              <video ref={videoRef} className="auth-camera-video" autoPlay playsInline muted />
              <div className="auth-camera-controls">
                <button type="button" className="auth-submit-btn" disabled={!cameraReady} onClick={() => capturePhoto(activeCameraTarget)}>
                  {cameraReady ? "Capture" : "Loading Camera..."}
                </button>
                <button type="button" className="auth-submit-btn auth-camera-retake" onClick={stopCamera}>Cancel</button>
              </div>
            </div>
          )}

          <button type="submit" className="auth-submit-btn">Create Account</button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/auth/login">Sign in</Link>
        </p>

        {message && (
          <p className={`auth-alert ${isSuccess ? "auth-alert-success" : "auth-alert-error"}`}>
            {message}
          </p>
        )}
      </section>
    </main>
  );
};

export default RegisterPage;
