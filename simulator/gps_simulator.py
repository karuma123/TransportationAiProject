"""
Real-Time GPS Data Simulator
=============================
Simulates multiple vehicles sending GPS data points to the backend API.
Includes normal driving patterns AND anomalous behaviors (speeding, 
route deviation, prolonged stops, erratic movement).

Usage:
    python gps_simulator.py [--vehicles N] [--interval SECONDS] [--anomaly-rate FLOAT]

Author: AI Prediction Model Project
"""

import time
import math
import random
import json
import argparse
import threading
from datetime import datetime, timezone

import requests

# ============================================================
# CONFIGURATION
# ============================================================
BACKEND_URL = "http://localhost:8080/api/realtime/gps"
DEFAULT_VEHICLES = 5
DEFAULT_INTERVAL = 2          # seconds between GPS pings
DEFAULT_ANOMALY_RATE = 0.15   # 15% chance of anomaly per tick

# Hyderabad, India — city center bounding box (adjust as needed)
CITY_CENTER = {"lat": 17.3850, "lng": 78.4867}
CITY_RADIUS_DEG = 0.08        # ~8 km radius


# ============================================================
# HELPERS
# ============================================================
def random_point_in_circle(center_lat, center_lng, radius_deg):
    """Generate a random point within a circle."""
    angle = random.uniform(0, 2 * math.pi)
    r = radius_deg * math.sqrt(random.uniform(0, 1))
    return center_lat + r * math.cos(angle), center_lng + r * math.sin(angle)


def clamp(value, lo, hi):
    return max(lo, min(hi, value))


# ============================================================
# VEHICLE SIMULATOR
# ============================================================
class Vehicle:
    NORMAL_SPEED_RANGE = (20, 60)       # km/h
    ANOMALY_SPEED_RANGE = (100, 180)    # km/h (speeding)
    STOP_DURATION_RANGE = (10, 30)      # ticks of idle

    def __init__(self, vehicle_id: int, driver_id: int):
        self.vehicle_id = vehicle_id
        self.driver_id = driver_id

        # Start at a random point in the city
        self.lat, self.lng = random_point_in_circle(
            CITY_CENTER["lat"], CITY_CENTER["lng"], CITY_RADIUS_DEG
        )
        self.altitude = random.uniform(400, 600)

        # Movement state
        self.heading = random.uniform(0, 360)  # degrees
        self.speed_kmh = random.uniform(*self.NORMAL_SPEED_RANGE)
        self.is_anomalous = False
        self.anomaly_type = None
        self.stop_counter = 0

        # History for trajectory file generation
        self.history = []

    def tick(self, interval_sec: float, anomaly_rate: float):
        """Advance vehicle by one time step."""
        # Decide if this tick is anomalous
        if random.random() < anomaly_rate and self.stop_counter == 0:
            self._start_anomaly()
        elif self.is_anomalous and random.random() < 0.3:
            self._end_anomaly()

        # Handle prolonged stop anomaly
        if self.anomaly_type == "IDLE" and self.stop_counter > 0:
            self.stop_counter -= 1
            self.speed_kmh = 0
            if self.stop_counter == 0:
                self._end_anomaly()
        elif self.anomaly_type == "SPEEDING":
            self.speed_kmh = random.uniform(*self.ANOMALY_SPEED_RANGE)
        elif self.anomaly_type == "ERRATIC":
            self.heading = random.uniform(0, 360)
            self.speed_kmh = random.uniform(10, 120)
        else:
            # Normal behaviour
            self.heading += random.uniform(-15, 15)
            self.speed_kmh = clamp(
                self.speed_kmh + random.uniform(-5, 5),
                self.NORMAL_SPEED_RANGE[0],
                self.NORMAL_SPEED_RANGE[1],
            )

        # Convert speed to degree‐shift
        speed_deg_per_sec = (self.speed_kmh / 3600.0) / 111.0  # rough conversion
        dx = speed_deg_per_sec * interval_sec * math.sin(math.radians(self.heading))
        dy = speed_deg_per_sec * interval_sec * math.cos(math.radians(self.heading))

        self.lat += dy
        self.lng += dx
        self.altitude += random.uniform(-2, 2)

        # Keep within city bounds
        dist = math.sqrt(
            (self.lat - CITY_CENTER["lat"]) ** 2
            + (self.lng - CITY_CENTER["lng"]) ** 2
        )
        if dist > CITY_RADIUS_DEG:
            # Turn back toward center
            self.heading = math.degrees(
                math.atan2(
                    CITY_CENTER["lng"] - self.lng, CITY_CENTER["lat"] - self.lat
                )
            )

        # Build data point
        now = datetime.now(timezone.utc)
        timestamp_utc = now.isoformat().replace("+00:00", "Z")
        point = {
            "vehicleId": self.vehicle_id,
            "driverId": self.driver_id,
            "latitude": round(self.lat, 6),
            "longitude": round(self.lng, 6),
            "altitude": round(self.altitude, 1),
            "speed": round(self.speed_kmh, 2),
            "heading": round(self.heading % 360, 2),
            "timestamp": timestamp_utc,
            "anomalous": self.is_anomalous,
            "anomalyType": self.anomaly_type,
        }
        self.history.append(point)
        return point

    def _start_anomaly(self):
        self.is_anomalous = True
        self.anomaly_type = random.choice(["SPEEDING", "ERRATIC", "IDLE"])
        if self.anomaly_type == "IDLE":
            self.stop_counter = random.randint(*self.STOP_DURATION_RANGE)

    def _end_anomaly(self):
        self.is_anomalous = False
        self.anomaly_type = None
        self.speed_kmh = random.uniform(*self.NORMAL_SPEED_RANGE)


# ============================================================
# SENDER
# ============================================================
def send_point(point: dict):
    """Send a single GPS data point to the backend."""
    try:
        resp = requests.post(BACKEND_URL, json=point, timeout=5)
        if resp.status_code == 200:
            return True, "OK"
        body = (resp.text or "").strip().replace("\n", " ")
        return False, f"HTTP {resp.status_code}: {body[:140]}"
    except requests.exceptions.ConnectionError:
        return False, "Connection refused"
    except Exception as e:
        return False, str(e)


# ============================================================
# MAIN LOOP
# ============================================================
def run_simulation(num_vehicles: int, interval: float, anomaly_rate: float):
    print("=" * 60)
    print("  GPS REAL-TIME SIMULATOR")
    print("=" * 60)
    print(f"  Vehicles     : {num_vehicles}")
    print(f"  Interval     : {interval}s")
    print(f"  Anomaly Rate : {anomaly_rate * 100:.0f}%")
    print(f"  Backend URL  : {BACKEND_URL}")
    print(f"  City Center  : {CITY_CENTER}")
    print("=" * 60)

    vehicles = [
        Vehicle(vehicle_id=i + 1, driver_id=i + 1) for i in range(num_vehicles)
    ]

    tick = 0
    connected = False

    while True:
        tick += 1
        anomaly_count = 0
        success_count = 0
        fail_count = 0

        for v in vehicles:
            point = v.tick(interval, anomaly_rate)
            ok, detail = send_point(point)

            if ok:
                success_count += 1
                if not connected:
                    print("  [✓] Connected to backend successfully!")
                    connected = True
            else:
                fail_count += 1
                connected = False
                if tick <= 3:
                    print(f"  [!] Send failed for vehicle {v.vehicle_id}: {detail}")

            if point["anomalous"]:
                anomaly_count += 1

        status = "✓" if fail_count == 0 else "✗"
        ts = datetime.now().strftime("%H:%M:%S")
        print(
            f"  [{status}] Tick {tick:>5} | {ts} | "
            f"Sent: {success_count}/{num_vehicles} | "
            f"Anomalies: {anomaly_count} | "
            f"{'Backend OFFLINE' if fail_count > 0 else 'OK'}"
        )

        time.sleep(interval)


# ============================================================
# ENTRY POINT
# ============================================================
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Real-Time GPS Simulator")
    parser.add_argument(
        "--vehicles", type=int, default=DEFAULT_VEHICLES, help="Number of vehicles"
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=DEFAULT_INTERVAL,
        help="Seconds between GPS pings",
    )
    parser.add_argument(
        "--anomaly-rate",
        type=float,
        default=DEFAULT_ANOMALY_RATE,
        help="Probability of anomaly per tick (0.0 – 1.0)",
    )

    args = parser.parse_args()
    try:
        run_simulation(args.vehicles, args.interval, args.anomaly_rate)
    except KeyboardInterrupt:
        print("\n  [!] Simulator stopped by user.")
