import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { MapContainer, Marker, Polyline, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../styles/role-dashboards.css";
import { clearSession, getAuthHeaders, getSession } from "../utils/session";
import { useNavigate } from "react-router-dom";

const API = "http://localhost:8080/api";

const readApiError = (error, fallback) => {
  const status = error?.response?.status;
  const data = error?.response?.data;

  if (status === 401 || status === 403) {
    return "Session expired or unauthorized. Please login again.";
  }

  if (typeof data === "string" && data.trim()) {
    return data;
  }

  return (
    data?.error
    || data?.message
    || error?.message
    || fallback
  );
};

const fetchLocationSuggestions = async (query) => {
  if (!query || query.trim().length < 3) {
    return [];
  }
  try {
    const res = await axios.get("https://nominatim.openstreetmap.org/search", {
      params: {
        q: query,
        format: "jsonv2",
        addressdetails: 1,
        limit: 5,
      },
    });
    return (Array.isArray(res.data) ? res.data : []).map((item) => ({
      label: item.display_name,
      lat: Number(item.lat),
      lng: Number(item.lon),
    }));
  } catch {
    return [];
  }
};

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const defaultPickup = { lat: 17.385, lng: 78.4867, label: "Hyderabad Center" };
const defaultDrop = { lat: 17.43, lng: 78.39, label: "Delivery Destination" };

const LocationPicker = ({ onDropPick }) => {
  useMapEvents({
    click: async (event) => {
      onDropPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
};

const reverseGeocode = async (lat, lng) => {
  try {
    const response = await axios.get("https://nominatim.openstreetmap.org/reverse", {
      params: {
        lat,
        lon: lng,
        format: "jsonv2",
      },
    });
    return response.data?.display_name || `${lat.toFixed(5)},${lng.toFixed(5)}`;
  } catch (error) {
    return `${lat.toFixed(5)},${lng.toFixed(5)}`;
  }
};

const fetchRouteFromOsrm = async (source, destination) => {
  if (!source || !destination) {
    return { path: [], distanceKm: null, etaMin: null };
  }

  const url = `https://router.project-osrm.org/route/v1/driving/${source.lng},${source.lat};${destination.lng},${destination.lat}`;
  try {
    const response = await axios.get(url, {
      params: {
        overview: "full",
        geometries: "geojson",
      },
    });

    const route = response.data?.routes?.[0];
    if (!route?.geometry?.coordinates?.length) {
      return { path: [], distanceKm: null, etaMin: null };
    }

    const path = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    return {
      path,
      distanceKm: Math.round((route.distance / 1000) * 100) / 100,
      etaMin: Math.max(1, Math.round(route.duration / 60)),
    };
  } catch (error) {
    return { path: [], distanceKm: null, etaMin: null };
  }
};

const CustomerDashboard = () => {
  const navigate = useNavigate();
  const session = getSession();

  const [rides, setRides] = useState([]);
  const [message, setMessage] = useState("");
  const [pickupPoint, setPickupPoint] = useState(defaultPickup);
  const [dropPoint, setDropPoint] = useState(defaultDrop);
  const [selectedRideId, setSelectedRideId] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [routePath, setRoutePath] = useState([]);
  const [routeMeta, setRouteMeta] = useState({ distanceKm: null, etaMin: null });
  const [actionBusy, setActionBusy] = useState(false);
  const [availableSchedules, setAvailableSchedules] = useState([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState(null);
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [dropSuggestions, setDropSuggestions] = useState([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const [form, setForm] = useState({
    pickupLocation: defaultPickup.label,
    dropLocation: defaultDrop.label,
    scheduledAt: "",
    packageType: "PARCEL",
    packageWeightKg: "",
    packageDescription: "",
    estimatedFare: "",
  });

  const [paymentForm, setPaymentForm] = useState({
    method: "UPI",
    amount: "",
    transactionRef: "",
  });

  const [shipmentForm, setShipmentForm] = useState({
    stage: "IN_TRANSIT",
    note: "",
  });

  const [sosMessage, setSosMessage] = useState("I need urgent support for this shipment.");

  const [feedbackForm, setFeedbackForm] = useState({
    rating: 5,
    feedback: "",
  });

  const rideKpis = {
    total: rides.length,
    live: rides.filter((r) => ["REQUESTED", "SCHEDULED", "ACCEPTED", "IN_PROGRESS"].includes(r.status)).length,
    completed: rides.filter((r) => r.status === "COMPLETED").length,
    cancelled: rides.filter((r) => r.status === "CANCELLED").length,
  };

  const packageKpis = {
    parcel: rides.filter((r) => r.packageType === "PARCEL").length,
    food: rides.filter((r) => r.packageType === "FOOD").length,
    document: rides.filter((r) => r.packageType === "DOCUMENT").length,
    fragile: rides.filter((r) => r.packageType === "FRAGILE").length,
  };

  const load = useCallback(async () => {
    if (!session?.userId || !session?.role) {
      clearSession();
      navigate("/auth/login");
      return;
    }

    try {
      const res = await axios.get(`${API}/rides`, {
        params: { userId: session?.userId, role: session?.role },
        headers: getAuthHeaders(),
      });
      setRides(res.data || []);
      setLastUpdatedAt(new Date());
      setMessage("");
    } catch (error) {
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        clearSession();
        navigate("/auth/login");
      }
      setMessage(readApiError(error, "Failed to fetch rides"));
    }
  }, [session, navigate]);

  const loadTracking = useCallback(async (rideId) => {
    if (!rideId) {
      setTracking(null);
      return;
    }
    try {
      const res = await axios.get(`${API}/rides/${rideId}/tracking`, {
        headers: getAuthHeaders(),
      });
      setTracking(res.data || null);
    } catch (error) {
      setMessage(readApiError(error, "Failed to fetch tracking"));
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    loadTracking(selectedRideId);
    const timer = setInterval(() => loadTracking(selectedRideId), 4000);
    return () => clearInterval(timer);
  }, [selectedRideId, loadTracking]);

  useEffect(() => {
    const source = tracking?.driverLocation
      ? { lat: tracking.driverLocation.latitude, lng: tracking.driverLocation.longitude }
      : (tracking?.pickupLat != null && tracking?.pickupLng != null
        ? { lat: tracking.pickupLat, lng: tracking.pickupLng }
        : null);

    const destination = tracking?.dropLat != null && tracking?.dropLng != null
      ? { lat: tracking.dropLat, lng: tracking.dropLng }
      : null;

    const run = async () => {
      const route = await fetchRouteFromOsrm(source, destination);
      setRoutePath(route.path);
      setRouteMeta({ distanceKm: route.distanceKm, etaMin: route.etaMin });
    };

    if (selectedRideId && source && destination) {
      run();
    } else {
      setRoutePath([]);
      setRouteMeta({ distanceKm: null, etaMin: null });
    }
  }, [tracking, selectedRideId]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const list = await fetchLocationSuggestions(form.pickupLocation);
      setPickupSuggestions(list);
    }, 300);
    return () => clearTimeout(timer);
  }, [form.pickupLocation]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const list = await fetchLocationSuggestions(form.dropLocation);
      setDropSuggestions(list);
    }, 300);
    return () => clearTimeout(timer);
  }, [form.dropLocation]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMessage("Geolocation is not supported on this browser");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const label = await reverseGeocode(lat, lng);
        setPickupPoint({ lat, lng, label });
        setForm((prev) => ({ ...prev, pickupLocation: label }));
      },
      () => setMessage("Unable to fetch current location")
    );
  };

  const handleDropPick = async (lat, lng) => {
    const label = await reverseGeocode(lat, lng);
    setDropPoint({ lat, lng, label });
    setForm((prev) => ({ ...prev, dropLocation: label }));
  };

  const book = async () => {
    try {
      await axios.post(
        `${API}/rides/book`,
        {
          customerId: session.userId,
          pickupLocation: form.pickupLocation,
          pickupLat: pickupPoint.lat,
          pickupLng: pickupPoint.lng,
          dropLocation: form.dropLocation,
          dropLat: dropPoint.lat,
          dropLng: dropPoint.lng,
          scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
          packageType: form.packageType,
          packageWeightKg: form.packageWeightKg ? Number(form.packageWeightKg) : null,
          packageDescription: form.packageDescription,
          estimatedFare: form.estimatedFare ? Number(form.estimatedFare) : null,
          preferredScheduleId: selectedScheduleId,
        },
        { headers: getAuthHeaders() }
      );
      setMessage("Ride booked successfully");
      setSelectedScheduleId(null);
      load();
    } catch (error) {
      setMessage(readApiError(error, "Booking failed"));
    }
  };

  const loadAvailableSchedules = async () => {
    try {
      const res = await axios.get(`${API}/rides/available-schedules`, {
        params: {
          fromLocation: form.pickupLocation,
          toLocation: form.dropLocation,
        },
        headers: getAuthHeaders(),
      });
      setAvailableSchedules(Array.isArray(res.data) ? res.data : []);
      if (!Array.isArray(res.data) || res.data.length === 0) {
        setSelectedScheduleId(null);
      }
    } catch (error) {
      setMessage(readApiError(error, "Failed to fetch available schedules"));
    }
  };

  const cancel = async (rideId) => {
    try {
      await axios.post(`${API}/rides/${rideId}/cancel`, null, {
        params: { reason: "Customer cancelled" },
        headers: getAuthHeaders(),
      });
      load();
      if (selectedRideId === rideId) {
        loadTracking(rideId);
      }
    } catch (error) {
      setMessage(readApiError(error, "Cancel failed"));
    }
  };

  const runRideAction = async (request, successMessage) => {
    if (!selectedRideId) {
      setMessage("Select a ride first");
      return;
    }

    setActionBusy(true);
    try {
      await request();
      setMessage(successMessage);
      await Promise.all([load(), loadTracking(selectedRideId)]);
    } catch (error) {
      setMessage(readApiError(error, "Action failed"));
    } finally {
      setActionBusy(false);
    }
  };

  const updateShipment = async () => runRideAction(
    () => axios.post(
      `${API}/rides/${selectedRideId}/shipment-update`,
      { stage: shipmentForm.stage, note: shipmentForm.note },
      { headers: getAuthHeaders() }
    ),
    "Shipment update submitted"
  );

  const processPayment = async () => {
    const amountFromRide = liveRide?.estimatedFare || 0;
    const chosenAmount = paymentForm.amount ? Number(paymentForm.amount) : Number(amountFromRide);

    return runRideAction(
      () => axios.post(
        `${API}/rides/${selectedRideId}/payment`,
        {
          method: paymentForm.method,
          amount: chosenAmount,
          transactionRef: paymentForm.transactionRef || `SIM-${Date.now()}`,
        },
        { headers: getAuthHeaders() }
      ),
      "Payment marked successful"
    );
  };

  const raiseSos = async () => runRideAction(
    () => axios.post(
      `${API}/rides/${selectedRideId}/sos`,
      { message: sosMessage },
      { headers: getAuthHeaders() }
    ),
    "SOS raised to customer support"
  );

  const resolveSos = async () => runRideAction(
    () => axios.post(
      `${API}/rides/${selectedRideId}/sos/resolve`,
      { resolvedBy: `customer-${session?.userId || "portal"}` },
      { headers: getAuthHeaders() }
    ),
    "SOS marked as resolved"
  );

  const submitFeedback = async () => runRideAction(
    () => axios.post(
      `${API}/rides/${selectedRideId}/feedback`,
      {
        rating: Number(feedbackForm.rating),
        feedback: feedbackForm.feedback,
      },
      { headers: getAuthHeaders() }
    ),
    "Feedback submitted"
  );

  const liveRide = rides.find((r) => r.id === selectedRideId);

  const trackedPickupLat = tracking?.pickupLat ?? pickupPoint.lat;
  const trackedPickupLng = tracking?.pickupLng ?? pickupPoint.lng;
  const trackedDropLat = tracking?.dropLat ?? dropPoint.lat;
  const trackedDropLng = tracking?.dropLng ?? dropPoint.lng;

  const fallbackPath = tracking?.driverLocation
    ? [[tracking.driverLocation.latitude, tracking.driverLocation.longitude], [trackedDropLat, trackedDropLng]]
    : [[trackedPickupLat, trackedPickupLng], [trackedDropLat, trackedDropLng]];

  const trackingPath = routePath.length > 1 ? routePath : fallbackPath;

  const packageLocationText = useMemo(() => {
    const lat = tracking?.currentPackageLat;
    const lng = tracking?.currentPackageLng;
    if (lat == null || lng == null) {
      return "Not available";
    }
    return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
  }, [tracking]);

  return (
    <div className="role-page">
      <div className="role-topbar">
        <h1>Customer Dashboard</h1>
        <div>
          {lastUpdatedAt && <span className="role-last-updated">Last updated: {lastUpdatedAt.toLocaleTimeString()}</span>}
          <button onClick={() => { clearSession(); navigate("/auth/login"); }}>Logout</button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card kpi-blue"><span>Total Rides</span><strong>{rideKpis.total}</strong></div>
        <div className="kpi-card kpi-violet"><span>Live Rides</span><strong>{rideKpis.live}</strong></div>
        <div className="kpi-card kpi-green"><span>Completed</span><strong>{rideKpis.completed}</strong></div>
        <div className="kpi-card kpi-rose"><span>Cancelled</span><strong>{rideKpis.cancelled}</strong></div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card kpi-orange"><span>Parcel</span><strong>{packageKpis.parcel}</strong></div>
        <div className="kpi-card kpi-cyan"><span>Food</span><strong>{packageKpis.food}</strong></div>
        <div className="kpi-card kpi-indigo"><span>Document</span><strong>{packageKpis.document}</strong></div>
        <div className="kpi-card kpi-pink"><span>Fragile</span><strong>{packageKpis.fragile}</strong></div>
      </div>

      <div className="role-card">
        <h3>Book / Schedule Ride</h3>
        <div className="role-grid-2">
          <button type="button" onClick={useCurrentLocation}>Use Current Location</button>
          <div className="role-inline-note">Click map to set destination using free OpenStreetMap tiles</div>
        </div>
        <div className="role-grid-2">
          <div className="location-autocomplete">
            <input
              value={form.pickupLocation}
              onChange={(e) => setForm({ ...form, pickupLocation: e.target.value })}
              placeholder="Pickup location name"
            />
            {pickupSuggestions.length > 0 && form.pickupLocation.trim().length >= 3 && (
              <div className="location-suggestions">
                {pickupSuggestions.map((s, idx) => (
                  <button
                    key={`pickup-${idx}`}
                    type="button"
                    className="location-suggestion-item"
                    onClick={() => {
                      setForm((prev) => ({ ...prev, pickupLocation: s.label }));
                      setPickupPoint({ lat: s.lat, lng: s.lng, label: s.label });
                      setPickupSuggestions([]);
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="location-autocomplete">
            <input
              value={form.dropLocation}
              onChange={(e) => setForm({ ...form, dropLocation: e.target.value })}
              placeholder="Drop location name"
            />
            {dropSuggestions.length > 0 && form.dropLocation.trim().length >= 3 && (
              <div className="location-suggestions">
                {dropSuggestions.map((s, idx) => (
                  <button
                    key={`drop-${idx}`}
                    type="button"
                    className="location-suggestion-item"
                    onClick={() => {
                      setForm((prev) => ({ ...prev, dropLocation: s.label }));
                      setDropPoint({ lat: s.lat, lng: s.lng, label: s.label });
                      setDropSuggestions([]);
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
          <input type="number" value={form.estimatedFare} onChange={(e) => setForm({ ...form, estimatedFare: e.target.value })} placeholder="Estimated fare" />
          <select value={form.packageType} onChange={(e) => setForm({ ...form, packageType: e.target.value })}>
            <option value="PARCEL">PARCEL</option>
            <option value="DOCUMENT">DOCUMENT</option>
            <option value="FOOD">FOOD</option>
            <option value="FRAGILE">FRAGILE</option>
          </select>
          <input type="number" value={form.packageWeightKg} onChange={(e) => setForm({ ...form, packageWeightKg: e.target.value })} placeholder="Package kg" />
        </div>
        <textarea value={form.packageDescription} onChange={(e) => setForm({ ...form, packageDescription: e.target.value })} placeholder="Package details" />
        <div className="ride-map-box">
          <MapContainer center={[pickupPoint.lat, pickupPoint.lng]} zoom={12} scrollWheelZoom style={{ height: 300, width: "100%" }}>
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <LocationPicker onDropPick={handleDropPick} />
            <Marker position={[pickupPoint.lat, pickupPoint.lng]} />
            <Marker position={[dropPoint.lat, dropPoint.lng]} />
            <Polyline positions={[[pickupPoint.lat, pickupPoint.lng], [dropPoint.lat, dropPoint.lng]]} />
          </MapContainer>
        </div>

        <div className="role-grid-2">
          <button type="button" onClick={loadAvailableSchedules}>Find Driver Schedules for This Route</button>
          <div className="role-inline-note">
            Select schedule ride from location to location with available capacity
          </div>
        </div>

        {availableSchedules.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Select</th>
                <th>Driver</th>
                <th>From</th>
                <th>To</th>
                <th>Departure</th>
                <th>Capacity</th>
              </tr>
            </thead>
            <tbody>
              {availableSchedules.map((s) => (
                <tr key={s.id}>
                  <td>
                    <input
                      type="radio"
                      name="selectedSchedule"
                      checked={selectedScheduleId === s.id}
                      onChange={() => setSelectedScheduleId(s.id)}
                    />
                  </td>
                  <td>{s.driverId}</td>
                  <td>{s.fromLocation}</td>
                  <td>{s.toLocation}</td>
                  <td>{s.departureAt ? new Date(s.departureAt).toLocaleString() : "-"}</td>
                  <td>{s.capacityAvailable} / {s.capacityTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <button onClick={book}>Book Ride</button>
      </div>

      <div className="role-card">
        <h3>My Rides</h3>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Status</th>
              <th>Driver</th>
              <th>Route</th>
              <th>Package</th>
              <th>Schedule</th>
              <th>Shipment</th>
              <th>Payment</th>
              <th>Rating</th>
              <th>Tracking</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rides.length === 0 ? (
              <tr>
                <td colSpan={11}>No rides yet. Create a booking above and it will appear here automatically.</td>
              </tr>
            ) : (
              rides.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.status}</td>
                  <td>{r.driverId || "Pending"}</td>
                  <td>{r.pickupLocation} -&gt; {r.dropLocation}</td>
                  <td>{r.packageType} / {r.packageWeightKg || 0}kg</td>
                  <td>{r.routeScheduleId || "-"}</td>
                  <td>{r.shipmentStage || r.packageStatus || "-"}</td>
                  <td>{r.paymentStatus || "PENDING"}</td>
                  <td>{r.customerRating || "-"}</td>
                  <td>
                    <button type="button" onClick={() => setSelectedRideId(r.id)}>
                      Track
                    </button>
                  </td>
                  <td>
                    {(r.status !== "COMPLETED" && r.status !== "CANCELLED") && (
                      <button className="danger" onClick={() => cancel(r.id)}>Cancel</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="role-card">
        <h3>Live Tracking, Package Location, and Route ETA</h3>
        {!selectedRideId && <p>Select a ride to view tracking, route path, ETA, payment, SOS, and feedback actions.</p>}
        {selectedRideId && (
          <>
            <div className="role-grid-2">
              <div className="role-metric">
                <div>Ride ID</div>
                <strong>{selectedRideId}</strong>
              </div>
              <div className="role-metric">
                <div>Current Status</div>
                <strong>{tracking?.status || liveRide?.status || "-"}</strong>
              </div>
              <div className="role-metric">
                <div>Shipment Stage</div>
                <strong>{tracking?.shipmentStage || tracking?.packageStatus || "-"}</strong>
              </div>
              <div className="role-metric">
                <div>ETA</div>
                <strong>{(routeMeta.etaMin || tracking?.etaMinutes) ? `${routeMeta.etaMin || tracking?.etaMinutes} mins` : "Calculating"}</strong>
              </div>
              <div className="role-metric">
                <div>Route Distance</div>
                <strong>{routeMeta.distanceKm ? `${routeMeta.distanceKm} km` : (tracking?.distanceToDropKm ? `${tracking.distanceToDropKm} km` : "-")}</strong>
              </div>
              <div className="role-metric">
                <div>Package Current Location</div>
                <strong>{packageLocationText}</strong>
              </div>
              <div className="role-metric">
                <div>Payment Status</div>
                <strong>{tracking?.paymentStatus || "PENDING"}</strong>
              </div>
              <div className="role-metric">
                <div>SOS Status</div>
                <strong>{tracking?.sosActive ? "ACTIVE" : "NORMAL"}</strong>
              </div>
            </div>

            <div className="ride-map-box">
              <MapContainer center={[trackedPickupLat, trackedPickupLng]} zoom={12} scrollWheelZoom style={{ height: 340, width: "100%" }}>
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[trackedPickupLat, trackedPickupLng]} />
                <Marker position={[trackedDropLat, trackedDropLng]} />
                {tracking?.driverLocation && (
                  <Marker position={[tracking.driverLocation.latitude, tracking.driverLocation.longitude]} />
                )}
                {(tracking?.currentPackageLat != null && tracking?.currentPackageLng != null) && (
                  <Marker position={[tracking.currentPackageLat, tracking.currentPackageLng]} />
                )}
                <Polyline positions={trackingPath} />
              </MapContainer>
            </div>

            <div className="role-grid-2" style={{ marginTop: 12 }}>
              <div>
                <h4>Shipment Update</h4>
                <select
                  value={shipmentForm.stage}
                  onChange={(e) => setShipmentForm((prev) => ({ ...prev, stage: e.target.value }))}
                  disabled={actionBusy}
                >
                  <option value="IN_TRANSIT">IN_TRANSIT</option>
                  <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
                  <option value="DELAYED">DELAYED</option>
                  <option value="DELIVERED">DELIVERED</option>
                </select>
                <textarea
                  value={shipmentForm.note}
                  onChange={(e) => setShipmentForm((prev) => ({ ...prev, note: e.target.value }))}
                  placeholder="Add shipment note for customer visibility"
                />
                <button disabled={actionBusy} onClick={updateShipment}>Publish Shipment Update</button>
              </div>

              <div>
                <h4>Payment Gateway Interface</h4>
                <select
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, method: e.target.value }))}
                  disabled={actionBusy}
                >
                  <option value="UPI">UPI</option>
                  <option value="CARD">CARD</option>
                  <option value="NETBANKING">NETBANKING</option>
                  <option value="CASH">CASH</option>
                </select>
                <input
                  type="number"
                  placeholder="Amount"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                />
                <input
                  placeholder="Transaction Ref (optional)"
                  value={paymentForm.transactionRef}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, transactionRef: e.target.value }))}
                />
                <button disabled={actionBusy} onClick={processPayment}>Pay Now</button>
              </div>

              <div>
                <h4>Customer Support SOS Services</h4>
                <textarea
                  value={sosMessage}
                  onChange={(e) => setSosMessage(e.target.value)}
                  placeholder="Describe emergency or support issue"
                />
                <button className="danger" disabled={actionBusy || !!tracking?.sosActive} onClick={raiseSos}>Raise SOS</button>
                <button disabled={actionBusy || !tracking?.sosActive} onClick={resolveSos}>Mark SOS Resolved</button>
                <div className="role-inline-note">
                  Active SOS: {tracking?.sosActive ? "Yes" : "No"}
                </div>
              </div>

              <div>
                <h4>Feedback & Rating</h4>
                <select
                  value={feedbackForm.rating}
                  onChange={(e) => setFeedbackForm((prev) => ({ ...prev, rating: e.target.value }))}
                  disabled={actionBusy}
                >
                  <option value={5}>5 - Excellent</option>
                  <option value={4}>4 - Good</option>
                  <option value={3}>3 - Average</option>
                  <option value={2}>2 - Poor</option>
                  <option value={1}>1 - Very Poor</option>
                </select>
                <textarea
                  value={feedbackForm.feedback}
                  onChange={(e) => setFeedbackForm((prev) => ({ ...prev, feedback: e.target.value }))}
                  placeholder="Share delivery feedback"
                />
                <button disabled={actionBusy} onClick={submitFeedback}>Submit Rating</button>
              </div>
            </div>
          </>
        )}
      </div>

      {message && <div className="role-message">{message}</div>}
    </div>
  );
};

export default CustomerDashboard;
