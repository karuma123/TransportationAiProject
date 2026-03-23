"""
Real-Time Anomaly Analyzer
===========================
Analyzes a sliding window of GPS points for anomalies in near-real-time.
Called by the Spring Boot backend when enough points are collected.
"""

import numpy as np
import joblib
from tensorflow.keras.models import load_model
import os

# Paths
MODEL_PATH = os.path.join(os.path.dirname(__file__), "model", "cnn_bilstm_attention_geolife1.h5")
SCALER_PATH = os.path.join(os.path.dirname(__file__), "scaler", "scaler1.pkl")

# Load model & scaler
try:
    model = load_model(MODEL_PATH)
    scaler = joblib.load(SCALER_PATH)
    print("[✓] Model and scaler loaded successfully")
except Exception as e:
    print(f"[✗] Error loading model/scaler: {e}")
    model = None
    scaler = None

ANOMALY_SCORE_THRESHOLD = 0.05


def haversine(lat1, lon1, lat2, lon2):
    """Calculate distance between two GPS points in meters."""
    R = 6371000
    phi1, phi2 = np.radians(lat1), np.radians(lat2)
    dphi = np.radians(lat2 - lat1)
    dlambda = np.radians(lon2 - lon1)
    a = np.sin(dphi / 2) ** 2 + np.cos(phi1) * np.cos(phi2) * np.sin(dlambda / 2) ** 2
    return 2 * R * np.arctan2(np.sqrt(a), np.sqrt(1 - a))


def extract_features_from_points(points):
    """
    Extract features from a list of GPS data points.
    Each point is a dict with: latitude, longitude, altitude, timestamp, speed
    """
    if len(points) < 3:
        return None

    distances = []
    times = []

    for i in range(1, len(points)):
        d = haversine(
            points[i - 1]["latitude"],
            points[i - 1]["longitude"],
            points[i]["latitude"],
            points[i]["longitude"],
        )

        from datetime import datetime

        t1 = datetime.fromisoformat(points[i - 1]["timestamp"].replace("Z", "+00:00"))
        t2 = datetime.fromisoformat(points[i]["timestamp"].replace("Z", "+00:00"))
        t = (t2 - t1).total_seconds()

        if t > 0:
            distances.append(d)
            times.append(t)

    if len(distances) == 0:
        return None

    distances = np.array(distances)
    times = np.array(times)
    speeds = distances / (times + 1e-6)

    # Core features (same order as training)
    total_distance = np.sum(distances)
    avg_speed = np.mean(speeds)
    max_speed = np.max(speeds)
    speed_std = np.std(speeds)

    acc = np.diff(speeds)
    avg_acceleration = np.mean(acc) if len(acc) > 0 else 0

    stop_ratio = np.sum(speeds < 0.5) / len(speeds)
    idle_time = np.sum(speeds < 0.5)

    from datetime import datetime

    t_first = datetime.fromisoformat(points[0]["timestamp"].replace("Z", "+00:00"))
    t_last = datetime.fromisoformat(points[-1]["timestamp"].replace("Z", "+00:00"))
    travel_time = (t_last - t_first).total_seconds()

    trajectory_length = len(points)

    lats = np.array([p["latitude"] for p in points])
    lons = np.array([p["longitude"] for p in points])
    lat_diff = np.diff(lats)
    lon_diff = np.diff(lons)
    heading_change = np.mean(np.abs(lat_diff + lon_diff))

    return [
        total_distance,
        avg_speed,
        max_speed,
        speed_std,
        avg_acceleration,
        stop_ratio,
        idle_time,
        travel_time,
        trajectory_length,
        heading_change,
    ]


def analyze_realtime(points):
    """
    Analyze a window of GPS points and return anomaly prediction.
    
    Returns:
        dict with anomaly_probability, anomaly (0/1), anomaly_score
    """
    if model is None or scaler is None:
        return {"anomaly_probability": 0.0, "anomaly": 0, "anomaly_score": 0.0, "error": "Model not loaded"}

    features = extract_features_from_points(points)

    if features is None:
        return {"anomaly_probability": 0.0, "anomaly": 0, "anomaly_score": 0.0, "error": "Not enough data"}

    X_raw = np.array([features])
    X_scaled = scaler.transform(X_raw)

    if X_scaled.shape[1] != 10:
        return {"anomaly_probability": 0.0, "anomaly": 0, "anomaly_score": 0.0, "error": "Feature mismatch"}

    X = X_scaled.reshape(1, X_scaled.shape[1], 1)
    prob = model.predict(X, verbose=0)[0][0]
    anomaly_score = abs(prob - 0.5) * 2
    label = int(anomaly_score >= ANOMALY_SCORE_THRESHOLD)

    return {
        "anomaly_probability": float(prob),
        "anomaly": label,
        "anomaly_score": float(anomaly_score),
    }
