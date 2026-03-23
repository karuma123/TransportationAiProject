import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import "../styles/role-dashboards.css";
import { clearSession, getAuthHeaders } from "../utils/session";
import { useNavigate } from "react-router-dom";

const API = "http://localhost:8080/api";

const AdminRideDashboard = () => {
  const navigate = useNavigate();
  const [rides, setRides] = useState([]);
  const [metrics, setMetrics] = useState({
    liveRides: 0,
    scheduled: 0,
    deliveries: 0,
    cancellations: 0,
  });
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const [ridesRes, metricsRes] = await Promise.all([
        axios.get(`${API}/rides`, { headers: getAuthHeaders() }),
        axios.get(`${API}/rides/metrics`, { headers: getAuthHeaders() }),
      ]);
      setRides(ridesRes.data || []);
      setMetrics(metricsRes.data || {});
    } catch (error) {
      setMessage(error?.response?.data?.error || "Failed to load admin ride data");
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [load]);

  const autoAssign = async (rideId) => {
    try {
      await axios.post(`${API}/rides/${rideId}/auto-assign`, null, { headers: getAuthHeaders() });
      load();
    } catch (error) {
      setMessage(error?.response?.data?.error || "Auto-assign failed");
    }
  };

  return (
    <div className="role-page">
      <div className="role-topbar">
        <h1>Admin Ride Dashboard</h1>
        <div>
          <button onClick={() => navigate("/admin/dashboard")}>Open Risk Dashboard</button>
          <button onClick={() => navigate("/admin/gps-upload")}>GPS Upload</button>
          <button onClick={() => { clearSession(); navigate("/auth/login"); }}>Logout</button>
        </div>
      </div>

      <div className="role-metrics">
        <div className="role-metric">Live Rides: <strong>{metrics.liveRides || 0}</strong></div>
        <div className="role-metric">Scheduled: <strong>{metrics.scheduled || 0}</strong></div>
        <div className="role-metric">Deliveries: <strong>{metrics.deliveries || 0}</strong></div>
        <div className="role-metric">Cancellations: <strong>{metrics.cancellations || 0}</strong></div>
      </div>

      <div className="role-card">
        <h3>All Rides</h3>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Status</th>
              <th>Customer</th>
              <th>Driver</th>
              <th>Route</th>
              <th>Package</th>
              <th>Auto Assign</th>
            </tr>
          </thead>
          <tbody>
            {rides.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.status}</td>
                <td>{r.customerId}</td>
                <td>{r.driverId || "-"}</td>
                <td>{r.pickupLocation} -> {r.dropLocation}</td>
                <td>{r.packageType || "-"} / {r.packageWeightKg || 0}kg</td>
                <td>
                  {(r.status === "REQUESTED" || r.status === "SCHEDULED") && !r.driverId && (
                    <button onClick={() => autoAssign(r.id)}>Nearest</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {message && <div className="role-message">{message}</div>}
    </div>
  );
};

export default AdminRideDashboard;
