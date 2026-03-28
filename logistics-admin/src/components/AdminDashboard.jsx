import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Pie, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import "../styles/role-dashboards.css";
import { getDashboardStats } from "../api/realtimeApi";
import { clearSession } from "../utils/session";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const riskColorMap = {
  HIGH: "#b91c1c",
  MEDIUM: "#d97706",
  LOW: "#0f766e",
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total: 0,
    blocked: 0,
    flagged: 0,
    highRisk: 0,
    mediumRisk: 0,
    lowRisk: 0,
  });
  const [realtimeRows, setRealtimeRows] = useState([]);
  const [driverRows, setDriverRows] = useState([]);
  const [tableData, setTableData] = useState([]);
  const [showSummary, setShowSummary] = useState(true);
  const [message, setMessage] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [activeFilter, setActiveFilter] = useState("ALL");

  const loadStats = useCallback(async () => {
    try {
      const [realtime, driversRes, flaggedRes] = await Promise.all([
        getDashboardStats(),
        axios.get("http://localhost:8080/api/drivers"),
        axios.get("http://localhost:8080/api/drivers/flagged"),
      ]);

      const drivers = Array.isArray(driversRes.data) ? driversRes.data : [];
      const flagged = Array.isArray(flaggedRes.data) ? flaggedRes.data : [];
      const latestPositions = Array.isArray(realtime?.latestPositions) ? realtime.latestPositions : [];
      const recentAnomalies = Array.isArray(realtime?.recentAnomalies) ? realtime.recentAnomalies : [];
      const riskDist = realtime?.riskDistribution || { high: 0, medium: 0, low: 0 };

      const normalizedRealtimeRows = latestPositions.map((pos) => {
        const event = recentAnomalies.find((item) => item.vehicleId === pos.vehicleId);
        return {
          driverId: pos.driverId || pos.vehicleId,
          vehicleId: pos.vehicleId,
          riskLevel: event?.riskLevel || "LOW",
          blocked: false,
          totalDeliveries: 0,
          cancellations: 0,
          speed: pos.speed || 0,
          latitude: pos.latitude,
          longitude: pos.longitude,
          source: "realtime",
        };
      });

      const normalizedDriverRows = drivers.map((driver) => ({
        driverId: driver.driverId,
        vehicleId: null,
        riskLevel: driver.riskLevel || "LOW",
        blocked: Boolean(driver.blocked),
        totalDeliveries: driver.totalDeliveries || 0,
        cancellations: driver.cancellations || 0,
        speed: 0,
        latitude: null,
        longitude: null,
        source: "upload",
      }));

      const effectiveRows = normalizedDriverRows.length > 0 ? normalizedDriverRows : normalizedRealtimeRows;

      setRealtimeRows(normalizedRealtimeRows);
      setDriverRows(normalizedDriverRows);
      setStats({
        total: effectiveRows.length,
        blocked: normalizedDriverRows.filter((driver) => driver.blocked).length,
        flagged: flagged.length > 0 ? flagged.length : (realtime?.activeAlerts || 0),
        highRisk: riskDist.high || effectiveRows.filter((driver) => driver.riskLevel === "HIGH").length,
        mediumRisk: riskDist.medium || effectiveRows.filter((driver) => driver.riskLevel === "MEDIUM").length,
        lowRisk: riskDist.low || effectiveRows.filter((driver) => driver.riskLevel === "LOW").length,
      });
      setMessage("");
      setLastUpdatedAt(new Date());
    } catch (error) {
      setMessage("Failed to load admin analysis data");
    }
  }, []);

  useEffect(() => {
    loadStats();
    const timer = setInterval(loadStats, 4000);
    return () => clearInterval(timer);
  }, [loadStats]);

  const showTable = useCallback((filter) => {
    const baseRows = driverRows.length > 0 ? driverRows : realtimeRows;
    setActiveFilter(filter);

    if (filter === "ALL") {
      setTableData(baseRows);
      return;
    }
    if (filter === "BLOCKED") {
      setTableData(baseRows.filter((driver) => driver.blocked));
      return;
    }
    if (filter === "FLAGGED") {
      setTableData(baseRows.filter((driver) => driver.riskLevel !== "LOW"));
      return;
    }
    setTableData(baseRows.filter((driver) => driver.riskLevel === filter));
  }, [driverRows, realtimeRows]);

  useEffect(() => {
    showTable(activeFilter);
  }, [activeFilter, driverRows, realtimeRows, showTable]);

  const handleBlockToggle = (driverId, isBlocked) => {
    if (driverRows.length === 0) return;
    setDriverRows((prev) => prev.map((driver) => (driver.driverId === driverId ? { ...driver, blocked: !isBlocked } : driver)));
    setTableData((prev) => prev.map((driver) => (driver.driverId === driverId ? { ...driver, blocked: !isBlocked } : driver)));
  };

  const pieData = useMemo(() => ({
    labels: ["High Risk", "Medium Risk", "Low Risk"],
    datasets: [
      {
        data: [stats.highRisk, stats.mediumRisk, stats.lowRisk],
        backgroundColor: ["#b91c1c", "#d97706", "#0f766e"],
        borderWidth: 0,
      },
    ],
  }), [stats.highRisk, stats.mediumRisk, stats.lowRisk]);

  const barData = useMemo(() => ({
    labels: ["Total", "Flagged", "Blocked"],
    datasets: [
      {
        label: "Drivers Count",
        data: [stats.total, stats.flagged, stats.blocked],
        backgroundColor: ["#0f6cbd", "#d97706", "#6d28d9"],
        borderRadius: 10,
      },
    ],
  }), [stats.total, stats.flagged, stats.blocked]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: "#5f718c",
          font: { weight: 700 },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: "#5f718c", font: { weight: 600 } },
        grid: { display: false },
      },
      y: {
        ticks: { color: "#5f718c" },
        grid: { color: "rgba(148, 163, 184, 0.18)" },
      },
    },
  };

  const summaryCards = [
    { key: "ALL", title: "Total Drivers", value: stats.total, className: "kpi-blue", note: "Complete operational roster across analysis sources." },
    { key: "FLAGGED", title: "Flagged", value: stats.flagged, className: "kpi-orange", note: "Drivers needing attention due to risk or live alerts." },
    { key: "HIGH", title: "High Risk", value: stats.highRisk, className: "kpi-rose", note: "Priority review segment for risk intervention." },
    { key: "BLOCKED", title: "Blocked", value: stats.blocked, className: "kpi-indigo", note: "Drivers currently blocked from platform operations." },
  ];

  return (
    <div className="role-page">
      <div className="role-shell">
        <div className="role-hero">
          <div className="role-topbar">
            <span className="role-eyebrow">Admin Analysis</span>
            <h1>Admin analysis dashboard</h1>
            <p className="role-subtitle">
              Review driver risk posture, live anomalies, and intervention opportunities from the same visual system used across the rest of your logistics UI.
            </p>
            <div className="role-topbar-meta">
              <span className="role-meta-chip">Fleet coverage: {stats.total}</span>
              <span className="role-meta-chip">Flagged cases: {stats.flagged}</span>
              <span className="role-meta-chip">Blocked drivers: {stats.blocked}</span>
            </div>
          </div>

          <div className="role-command">
            <div>
              <p className="role-command-label">Admin Console</p>
              <h2>Risk review command center</h2>
              <p>Switch between analysis, ride operations, and GPS upload while keeping the summary and driver table in one organized flow.</p>
            </div>
            <div className="role-command-actions">
              <button className="role-btn" type="button" onClick={() => navigate("/admin/rides")}>Open Ride Dashboard</button>
              <button className="role-btn role-btn-secondary" type="button" onClick={() => navigate("/admin/gps-upload")}>GPS Upload</button>
              <button className="role-btn role-btn-secondary" type="button" onClick={() => setShowSummary((prev) => !prev)}>
                {showSummary ? "Hide Summary" : "Show Summary"}
              </button>
              <button className="role-btn role-btn-danger" type="button" onClick={() => { clearSession(); navigate("/auth/login"); }}>Logout</button>
            </div>
            {lastUpdatedAt && <span className="role-last-updated">Last synced {lastUpdatedAt.toLocaleTimeString()}</span>}
          </div>
        </div>

        {showSummary && (
          <section className="role-section">
            <div className="role-section-header">
              <div>
                <h2>Executive summary</h2>
                <p>Click any metric card to pivot the detailed driver table below.</p>
              </div>
            </div>
            <div className="kpi-grid">
              {summaryCards.map((card) => (
                <button
                  key={card.key}
                  type="button"
                  className={`kpi-card ${card.className}`}
                  onClick={() => showTable(card.key)}
                  style={{ textAlign: "left", border: "none", cursor: "pointer" }}
                >
                  <span>{card.title}</span>
                  <strong>{card.value}</strong>
                  <small>{card.note}</small>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="role-section role-split">
          <div className="role-card">
            <div className="role-panel-header">
              <div>
                <h3>Risk distribution</h3>
                <p className="role-card-subtitle">Portfolio spread across high, medium, and low risk driver segments.</p>
              </div>
              <button className="role-btn role-btn-secondary" type="button" style={{ width: "auto" }} onClick={() => showTable("HIGH")}>
                Review high risk
              </button>
            </div>
            <div style={{ height: 320 }}>
              <Pie data={pieData} options={{ responsive: true, maintainAspectRatio: false, plugins: chartOptions.plugins }} />
            </div>
          </div>

          <div className="role-card">
            <div className="role-panel-header">
              <div>
                <h3>Driver status overview</h3>
                <p className="role-card-subtitle">Total, flagged, and blocked counts translated into a quick intervention view.</p>
              </div>
              <button className="role-btn role-btn-secondary" type="button" style={{ width: "auto" }} onClick={() => showTable("FLAGGED")}>
                Open flagged list
              </button>
            </div>
            <div style={{ height: 320 }}>
              <Bar data={barData} options={chartOptions} />
            </div>
          </div>
        </section>

        <section className="role-section role-split">
          <div className="role-card">
            <div className="role-panel-header">
              <div>
                <h3>Filter focus</h3>
                <p className="role-card-subtitle">Use quick filters to move between all drivers, flagged cases, blocked accounts, or a specific risk tier.</p>
              </div>
            </div>
            <div className="role-status-row">
              <button className="role-btn role-btn-secondary" type="button" style={{ width: "auto" }} onClick={() => showTable("ALL")}>All Drivers</button>
              <button className="role-btn role-btn-secondary" type="button" style={{ width: "auto" }} onClick={() => showTable("FLAGGED")}>Flagged</button>
              <button className="role-btn role-btn-secondary" type="button" style={{ width: "auto" }} onClick={() => showTable("HIGH")}>High Risk</button>
              <button className="role-btn role-btn-secondary" type="button" style={{ width: "auto" }} onClick={() => showTable("MEDIUM")}>Medium Risk</button>
              <button className="role-btn role-btn-secondary" type="button" style={{ width: "auto" }} onClick={() => showTable("LOW")}>Low Risk</button>
              <button className="role-btn role-btn-secondary" type="button" style={{ width: "auto" }} onClick={() => showTable("BLOCKED")}>Blocked</button>
            </div>
            <div className="role-inline-note" style={{ marginTop: 16 }}>
              Active filter: {activeFilter.replace("_", " ")}. Live-only rows are visible when uploaded driver records are unavailable.
            </div>
          </div>

          <div className="role-card">
            <div className="role-panel-header">
              <div>
                <h3>Data source status</h3>
                <p className="role-card-subtitle">A compact readout of where the dashboard is pulling its current analysis rows from.</p>
              </div>
            </div>
            <div className="role-metrics">
              <div className="role-metric">
                <div>Uploaded Drivers</div>
                <strong>{driverRows.length}</strong>
              </div>
              <div className="role-metric">
                <div>Realtime Positions</div>
                <strong>{realtimeRows.length}</strong>
              </div>
              <div className="role-metric">
                <div>High Risk Share</div>
                <strong>{stats.total ? `${Math.round((stats.highRisk / stats.total) * 100)}%` : "0%"}</strong>
              </div>
              <div className="role-metric">
                <div>Review Mode</div>
                <strong>{driverRows.length > 0 ? "Uploaded Drivers" : "Realtime Feed"}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="role-section">
          <div className="role-section-header">
            <div>
              <h2>Detailed driver analysis</h2>
              <p>Actionable breakdown of risk, block status, delivery volume, and cancellation behavior.</p>
            </div>
          </div>
          <div className="role-card">
            <table>
              <thead>
                <tr>
                  <th>Driver ID</th>
                  <th>Vehicle</th>
                  <th>Risk Level</th>
                  <th>Blocked</th>
                  <th>Total Deliveries</th>
                  <th>Cancellations</th>
                  <th>Speed</th>
                  <th>Coordinates</th>
                  <th>Source</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {tableData.length === 0 ? (
                  <tr>
                    <td colSpan={10}>No drivers match the current filter.</td>
                  </tr>
                ) : (
                  tableData.map((driver) => (
                    <tr key={`${driver.driverId}-${driver.source}`}>
                      <td>{driver.driverId}</td>
                      <td>{driver.vehicleId || "-"}</td>
                      <td>
                        <span
                          className="role-chip"
                          style={{
                            background: `${riskColorMap[driver.riskLevel] || "#0f766e"}16`,
                            color: riskColorMap[driver.riskLevel] || "#0f766e",
                            borderColor: `${riskColorMap[driver.riskLevel] || "#0f766e"}33`,
                          }}
                        >
                          {driver.riskLevel}
                        </span>
                      </td>
                      <td>{driver.blocked ? "Yes" : "No"}</td>
                      <td>{driver.totalDeliveries}</td>
                      <td>{driver.cancellations}</td>
                      <td>{driver.speed ? `${driver.speed} km/h` : "-"}</td>
                      <td>
                        {driver.latitude != null && driver.longitude != null
                          ? `${Number(driver.latitude).toFixed(5)}, ${Number(driver.longitude).toFixed(5)}`
                          : "-"}
                      </td>
                      <td>{driver.source === "upload" ? "Driver Upload" : "Realtime Feed"}</td>
                      <td>
                        <button
                          className={driver.blocked ? "role-btn role-btn-secondary" : "role-btn"}
                          type="button"
                          style={{ width: "auto" }}
                          disabled={driver.source !== "upload"}
                          onClick={() => handleBlockToggle(driver.driverId, driver.blocked)}
                        >
                          {driver.source !== "upload" ? "Live Only" : (driver.blocked ? "Unblock" : "Block")}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {message && <div className="role-message">{message}</div>}
      </div>
    </div>
  );
};

export default AdminDashboard;
