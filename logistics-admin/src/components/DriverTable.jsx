import React, { useEffect, useState } from "react";
import axios from "axios";
import { blockDriver, unblockDriver } from "../api/driverApi";
import "../styles/driverTable.css";
import { API_DRIVERS_URL } from "../config";

const DriverTable = () => {
  const [drivers, setDrivers] = useState([]);

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    const res = await axios.get(API_DRIVERS_URL);
    setDrivers(res.data);
  };

  const toggleBlock = async (driver) => {
    try {
      if (driver.blocked) {
        await axios.post(
          `${API_DRIVERS_URL}/unblock`,
          null,
          { params: { driverId: driver.driverId } }
        );
      } else {
        await axios.post(
          `${API_DRIVERS_URL}/block`,
          null,
          {
            params: {
              driverId: driver.driverId,
              reason: "High anomaly risk detected"
            }
          }
        );
      }
      fetchDrivers(); // refresh table
    } catch (err) {
      alert("Action failed");
    }
  };

  return (
    <table className="driver-table">
      <thead>
        <tr>
          <th>Driver ID</th>
          <th>Deliveries</th>
          <th>Cancellations</th>
          <th>GPS Anomalies</th>
          <th>Risk Score</th>
          <th>Risk Level</th>
          <th>Status</th>
          <th>Action</th> {/* ✅ NEW COLUMN */}
        </tr>
      </thead>

      <tbody>
        {drivers.map((d) => (
          <tr key={d.driverId}>
            <td>{d.driverId}</td>
            <td>{d.totalDeliveries}</td>
            <td>{d.cancellations}</td>
            <td>{d.gpsAnomalies}</td>
            <td>{d.riskScore.toFixed(2)}</td>

            <td>
  <span className={`risk-badge ${driver.riskLevel.toLowerCase()}`}>
    {driver.riskLevel}
  </span>
</td>

            <td>
              {d.blocked ? "🚫 Blocked" : "✅ Active"}
            </td>

            <td>
              <button
                className={d.blocked ? "unblock-btn" : "block-btn"}
                onClick={() => toggleBlock(d)}
              >
                {d.blocked ? "Unblock" : "Block"}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default DriverTable;
