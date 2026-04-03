import React, { useState, useEffect, useCallback } from "react";
import { getDashboardStats, getRecentAnomalies } from "../api/realtimeApi";
import { MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../styles/realtime-dashboard.css";

const POLL_INTERVAL = 3000; // 3 seconds

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const RealtimeDashboard = () => {
    const [stats, setStats] = useState(null);
    const [anomalies, setAnomalies] = useState([]);
    const [positionHistory, setPositionHistory] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            const [dashData, anomalyData] = await Promise.all([
                getDashboardStats(),
                getRecentAnomalies(),
            ]);
            setStats(dashData);
            setAnomalies(anomalyData);
            setPositionHistory((prev) => {
                const next = { ...prev };
                const positions = Array.isArray(dashData?.latestPositions) ? dashData.latestPositions : [];

                positions.forEach((pos) => {
                    if (pos?.vehicleId == null || pos?.latitude == null || pos?.longitude == null) return;

                    const vehicleId = String(pos.vehicleId);
                    const point = [pos.latitude, pos.longitude];
                    const existing = next[vehicleId] || [];
                    const last = existing[existing.length - 1];

                    // Keep a short trail only when location actually changes.
                    if (!last || last[0] !== point[0] || last[1] !== point[1]) {
                        next[vehicleId] = [...existing, point].slice(-12);
                    }
                });

                return next;
            });
            setLastUpdate(new Date());
            setError(null);
        } catch (err) {
            setError("Failed to connect to the backend. Make sure services are running.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const timer = setInterval(fetchData, POLL_INTERVAL);
        return () => clearInterval(timer);
    }, [fetchData]);

    if (loading && !stats) {
        return (
            <div className="rt-dashboard">
                <div className="rt-loading">
                    <div className="rt-spinner"></div>
                    <p>Connecting to Real-Time System...</p>
                </div>
            </div>
        );
    }

    const riskDist = stats?.riskDistribution || { high: 0, medium: 0, low: 0 };
    const positions = stats?.latestPositions || [];
    const recentAnomalies = stats?.recentAnomalies || [];
    const mapCenter = positions.length > 0
        ? [positions[0].latitude, positions[0].longitude]
        : [17.385, 78.4867];

    return (
        <div className="rt-dashboard">
            {/* Header */}
            <div className="rt-header">
                <div className="rt-header-left">
                    <h1>🛰️ Real-Time Monitoring Dashboard</h1>
                    <p className="rt-subtitle">
                        AI-Powered GPS Anomaly Detection System
                    </p>
                </div>
                <div className="rt-header-right">
                    <span className={`rt-status ${error ? "offline" : "online"}`}>
                        {error ? "⚫ OFFLINE" : "🟢 LIVE"}
                    </span>
                    {lastUpdate && (
                        <span className="rt-last-update">
                            Last update: {lastUpdate.toLocaleTimeString()}
                        </span>
                    )}
                </div>
            </div>

            {error && (
                <div className="rt-error-banner">
                    ⚠️ {error}
                </div>
            )}

            {/* Stats Cards */}
            <div className="rt-stats-grid">
                <StatCard
                    icon="🚗"
                    label="Active Vehicles"
                    value={stats?.activeVehicles || 0}
                    color="#3b82f6"
                />
                <StatCard
                    icon="⚠️"
                    label="Total Anomalies"
                    value={stats?.totalAnomalies || 0}
                    color="#f59e0b"
                />
                <StatCard
                    icon="🔔"
                    label="Active Alerts"
                    value={stats?.activeAlerts || 0}
                    color="#ef4444"
                />
                <StatCard
                    icon="🛡️"
                    label="System Status"
                    value={error ? "OFFLINE" : "HEALTHY"}
                    color={error ? "#6b7280" : "#10b981"}
                    isText
                />
            </div>

            {/* Risk Distribution */}
            <div className="rt-section">
                <h2>📊 Risk Distribution</h2>
                <div className="rt-risk-bars">
                    <RiskBar
                        label="HIGH"
                        count={riskDist.high}
                        total={riskDist.high + riskDist.medium + riskDist.low || 1}
                        color="#ef4444"
                    />
                    <RiskBar
                        label="MEDIUM"
                        count={riskDist.medium}
                        total={riskDist.high + riskDist.medium + riskDist.low || 1}
                        color="#f59e0b"
                    />
                    <RiskBar
                        label="LOW"
                        count={riskDist.low}
                        total={riskDist.high + riskDist.medium + riskDist.low || 1}
                        color="#10b981"
                    />
                </div>
            </div>

            <div className="rt-two-col">
                {/* Active Vehicles */}
                <div className="rt-section">
                    <h2>🗺️ Active Vehicles ({positions.length})</h2>
                    <div className="rt-vehicle-list">
                        {positions.length === 0 ? (
                            <p className="rt-empty">No active vehicles. Start the GPS simulator!</p>
                        ) : (
                            positions.map((pos) => (
                                <div key={pos.vehicleId} className="rt-vehicle-card">
                                    <div className="rt-vehicle-icon">🚗</div>
                                    <div className="rt-vehicle-info">
                                        <span className="rt-vehicle-id">
                                            Vehicle #{pos.vehicleId}
                                        </span>
                                        <span className="rt-vehicle-coords">
                                            📍 {pos.latitude?.toFixed(4)}, {pos.longitude?.toFixed(4)}
                                        </span>
                                        <span className="rt-vehicle-speed">
                                            🏎️ {pos.speed?.toFixed(1)} km/h
                                        </span>
                                    </div>
                                    {pos.anomalous && (
                                        <span className="rt-anomaly-badge">⚠️ ANOMALY</span>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="rt-section">
                    <h2>🧭 Live Locations of All Drivers</h2>
                    <div className="rt-map-wrap">
                        <MapContainer center={mapCenter} zoom={12} scrollWheelZoom style={{ height: 360, width: "100%" }}>
                            <TileLayer
                                attribution='&copy; OpenStreetMap contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            {positions.map((pos) => (
                                <React.Fragment key={`map-${pos.vehicleId}`}>
                                {Array.isArray(positionHistory[String(pos.vehicleId)]) && positionHistory[String(pos.vehicleId)].length > 1 && (
                                    <Polyline positions={positionHistory[String(pos.vehicleId)]} pathOptions={{ color: "#2563eb", weight: 3, opacity: 0.7 }} />
                                )}
                                <Marker key={`map-${pos.vehicleId}-${pos.timestamp || "ts"}`} position={[pos.latitude, pos.longitude]}>
                                    <Popup>
                                        <strong>Vehicle #{pos.vehicleId}</strong>
                                        <br />
                                        Driver: {pos.driverId || "-"}
                                        <br />
                                        Speed: {(pos.speed || 0).toFixed(1)} km/h
                                        <br />
                                        {pos.latitude?.toFixed(5)}, {pos.longitude?.toFixed(5)}
                                    </Popup>
                                </Marker>
                                </React.Fragment>
                            ))}
                        </MapContainer>
                    </div>
                </div>

                {/* Anomaly Feed */}
                <div className="rt-section">
                    <h2>🚨 Live Anomaly Feed</h2>
                    <div className="rt-anomaly-feed">
                        {recentAnomalies.length === 0 && anomalies.length === 0 ? (
                            <p className="rt-empty">No anomalies detected yet.</p>
                        ) : (
                            (recentAnomalies.length > 0 ? recentAnomalies : anomalies).map((a, i) => (
                                <div
                                    key={a.id || i}
                                    className={`rt-anomaly-item risk-${(a.riskLevel || "low").toLowerCase()}`}
                                >
                                    <div className="rt-anomaly-header">
                                        <span className={`rt-risk-badge ${(a.riskLevel || "LOW").toLowerCase()}`}>
                                            {a.riskLevel || "UNKNOWN"}
                                        </span>
                                        <span className="rt-anomaly-vehicle">
                                            Vehicle #{a.vehicleId}
                                        </span>
                                        <span className="rt-anomaly-time">
                                            {a.detectedAt
                                                ? new Date(a.detectedAt).toLocaleTimeString()
                                                : "N/A"}
                                        </span>
                                    </div>
                                    <div className="rt-anomaly-details">
                                        <span>Score: {(a.anomalyScore || 0).toFixed(3)}</span>
                                        {a.anomalyType && (
                                            <span className="rt-anomaly-type">{a.anomalyType}</span>
                                        )}
                                        <span>
                                            📍 {a.latitude?.toFixed(4)}, {a.longitude?.toFixed(4)}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="rt-footer">
                <p>
                    💡 <strong>Tip:</strong> Start the GPS simulator with{" "}
                    <code>python simulator/gps_simulator.py --vehicles 5</code>{" "}
                    to see live data flowing in.
                </p>
            </div>
        </div>
    );
};

// ——— Sub-Components ———

const StatCard = ({ icon, label, value, color, isText }) => (
    <div className="rt-stat-card" style={{ borderLeft: `4px solid ${color}` }}>
        <div className="rt-stat-icon">{icon}</div>
        <div className="rt-stat-body">
            <span className="rt-stat-value" style={{ color }}>
                {isText ? value : value.toLocaleString()}
            </span>
            <span className="rt-stat-label">{label}</span>
        </div>
    </div>
);

const RiskBar = ({ label, count, total, color }) => {
    const pct = total > 0 ? (count / total) * 100 : 0;
    return (
        <div className="rt-risk-bar-row">
            <span className="rt-risk-label" style={{ color }}>
                {label}
            </span>
            <div className="rt-risk-bar-track">
                <div
                    className="rt-risk-bar-fill"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                />
            </div>
            <span className="rt-risk-count">{count}</span>
        </div>
    );
};

export default RealtimeDashboard;
