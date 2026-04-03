const rawApiBase = process.env.REACT_APP_API_BASE_URL || "http://localhost:8080/api";

export const API_BASE_URL = rawApiBase.replace(/\/+$/, "");
export const API_REALTIME_URL = `${API_BASE_URL}/realtime`;
export const API_DRIVERS_URL = `${API_BASE_URL}/drivers`;
