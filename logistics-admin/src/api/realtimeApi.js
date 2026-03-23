import axios from "axios";

const API_BASE = "http://localhost:8080/api/realtime";

/**
 * Send a GPS data point to the backend.
 */
export const sendGpsPoint = async (pointData) => {
    const res = await axios.post(`${API_BASE}/gps`, pointData);
    return res.data;
};

/**
 * Get the latest GPS position for all active vehicles.
 */
export const getLatestPositions = async () => {
    const res = await axios.get(`${API_BASE}/positions`);
    return res.data;
};

/**
 * Get recent anomaly events.
 */
export const getRecentAnomalies = async () => {
    const res = await axios.get(`${API_BASE}/anomalies`);
    return res.data;
};

/**
 * Get active (unacknowledged) alerts.
 */
export const getActiveAlerts = async () => {
    const res = await axios.get(`${API_BASE}/alerts`);
    return res.data;
};

/**
 * Get full dashboard statistics.
 */
export const getDashboardStats = async () => {
    const res = await axios.get(`${API_BASE}/dashboard`);
    return res.data;
};

/**
 * Health check.
 */
export const healthCheck = async () => {
    const res = await axios.get(`${API_BASE}/health`);
    return res.data;
};
