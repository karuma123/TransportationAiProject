import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/GpsUpload.css";
import { API_DRIVERS_URL } from "../config";

const GpsUpload = () => {
  const navigate = useNavigate();
  const [driverId, setDriverId] = useState("");
  const [deliveries, setDeliveries] = useState("");
  const [cancellations, setCancellations] = useState("");
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  const uploadGps = async () => {
    if (!file) return alert("Please upload a .plt file");

    const formData = new FormData();
    formData.append("driverId", driverId);
    formData.append("totalDeliveries", deliveries);
    formData.append("cancellations", cancellations);
    formData.append("file", file);

    try {
      setLoading(true);
      const res = await axios.post(
        `${API_DRIVERS_URL}/gps/upload`,
        formData
      );
      setAnalysis(res.data);
    } catch (err) {
      alert("GPS processing failed. Check backend logs.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gps-layout">
      {/* Sidebar */}
      <aside className="gps-sidebar">
        <h2>🚚 Admin Panel</h2>
        <nav>
          <button onClick={() => navigate("/admin/dashboard")}>Dashboard</button>
          <button onClick={() => navigate("/admin/gps-upload")}>GPS Upload</button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="gps-main">
        <div className="gps-card">
          <h2>📍 Upload GPS Trajectory</h2>

          <input
            type="number"
            placeholder="Driver ID"
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
          />

          <input
            type="number"
            placeholder="Total Deliveries"
            value={deliveries}
            onChange={(e) => setDeliveries(e.target.value)}
          />

          <input
            type="number"
            placeholder="Total Cancellations"
            value={cancellations}
            onChange={(e) => setCancellations(e.target.value)}
          />

          <input type="file" accept=".plt" onChange={(e) => setFile(e.target.files[0])} />

          <button onClick={uploadGps} disabled={loading}>
            {loading ? "Processing..." : "Upload & Analyze"}
          </button>

          {analysis && (
            <div className="analysis-box">
              <h3>📊 Risk Analysis Result</h3>
              <p><b>Risk Score:</b> {analysis.riskScore.toFixed(2)}</p>
              <p><b>Anomaly Score:</b> {analysis.anomalyScore.toFixed(2)}</p>
              <p>
                <b>Risk Level:</b>{" "}
                <span className={`badge ${analysis.riskLevel.toLowerCase()}`}>
                  {analysis.riskLevel}
                </span>
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default GpsUpload;

/*import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

import "../styles/GpsUpload.css";

const GpsUpload = () => {
  const navigate = useNavigate();
  const [driverId, setDriverId] = useState("");
  const [deliveries, setDeliveries] = useState("");
  const [cancellations, setCancellations] = useState("");
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  const uploadGps = async () => {
    if (!file) {
      alert("Please upload a .plt file");
      return;
    }

    const formData = new FormData();
    formData.append("driverId", driverId);
    formData.append("totalDeliveries", deliveries);
    formData.append("cancellations", cancellations);
    formData.append("file", file);

    try {
      setLoading(true);
      const res = await axios.post(
        `${API_DRIVERS_URL}/gps/upload`,
        formData
      );
      setAnalysis(res.data);
    } catch (err) {
      alert("GPS processing failed. Check backend logs.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gps-card">
      <h2>📍 GPS Trajectory Upload</h2>

      <input
        type="number"
        placeholder="Driver ID"
        value={driverId}
        onChange={(e) => setDriverId(e.target.value)}
      />

      <input
        type="number"
        placeholder="Total Deliveries"
        value={deliveries}
        onChange={(e) => setDeliveries(e.target.value)}
      />

      <input
        type="number"
        placeholder="Total Cancellations"
        value={cancellations}
        onChange={(e) => setCancellations(e.target.value)}
      />

      <input
        type="file"
        accept=".plt"
        onChange={(e) => setFile(e.target.files[0])}
      />

      <button onClick={uploadGps} disabled={loading}>
        {loading ? "Processing..." : "Upload & Analyze"}
      </button>

      <button
        className="admin-btn"
        onClick={() => navigate("/admin/dashboard")}
        //onClick={() => (window.location.href = "/admin/dashboard")}
      >
        🔍 Admin Analysis Dashboard
      </button>

      {analysis && (
        <div className="analysis-box">
          <h3>📊 Risk Analysis Result</h3>
          <p><b>Risk Score:</b> {analysis.riskScore.toFixed(2)}</p>
          <p><b>Anomaly Score:</b> {analysis.anomalyScore.toFixed(2)}</p>
          <p>
            <b>Risk Level:</b>{" "}
            <span className={`badge ${analysis.riskLevel.toLowerCase()}`}>
              {analysis.riskLevel}
            </span>
          </p>
        </div>
      )}
    </div>
  );
};

export default GpsUpload;
*/