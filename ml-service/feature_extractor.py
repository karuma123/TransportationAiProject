import pandas as pd
import numpy as np
from datetime import datetime

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000  # meters
    phi1, phi2 = np.radians(lat1), np.radians(lat2)
    dphi = np.radians(lat2 - lat1)
    dlambda = np.radians(lon2 - lon1)

    a = np.sin(dphi / 2)**2 + np.cos(phi1) * np.cos(phi2) * np.sin(dlambda / 2)**2
    return 2 * R * np.arctan2(np.sqrt(a), np.sqrt(1 - a))


def load_plt(file_path):
    df = pd.read_csv(
        file_path,
        skiprows=6,
        header=None,
        names=['lat','lon','zero','alt','date_days','date','time']
    )
    df['datetime'] = pd.to_datetime(df['date'] + ' ' + df['time'])
    return df[['lat','lon','alt','datetime']]


def extract_features(df):
    if df is None or len(df) < 3:
        return None

    df = df.sort_values("datetime")

    distances = []
    times = []

    for i in range(1, len(df)):
        d = haversine(
            df.iloc[i-1]['lat'], df.iloc[i-1]['lon'],
            df.iloc[i]['lat'], df.iloc[i]['lon']
        )

        t = (df.iloc[i]['datetime'] - df.iloc[i-1]['datetime']).total_seconds()

        if t > 0:
            distances.append(d)
            times.append(t)

    if len(distances) == 0:
        return None

    distances = np.array(distances)
    times = np.array(times)

    speeds = distances / (times + 1e-6)  # avoid division by zero

    # ✅ Core features
    total_distance = np.sum(distances)
    avg_speed = np.mean(speeds)
    max_speed = np.max(speeds)
    speed_std = np.std(speeds)

    # acceleration
    acc = np.diff(speeds)
    avg_acceleration = np.mean(acc) if len(acc) > 0 else 0

    # stop-related
    stop_ratio = np.sum(speeds < 0.5) / len(speeds)
    idle_time = np.sum(speeds < 0.5)

    # time
    travel_time = (df['datetime'].iloc[-1] - df['datetime'].iloc[0]).total_seconds()

    # trajectory
    trajectory_length = len(df)

    # heading change (approx like training)
    lat_diff = np.diff(df['lat'].values)
    lon_diff = np.diff(df['lon'].values)
    heading_change = np.mean(np.abs(lat_diff + lon_diff))

    # ✅ RETURN IN SAME ORDER AS TRAINING
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
        heading_change
    ]