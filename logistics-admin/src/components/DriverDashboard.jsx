import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { MapContainer, Marker, Polyline, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../styles/role-dashboards.css";
import { clearSession, getAuthHeaders, getSession } from "../utils/session";
import { useNavigate } from "react-router-dom";

const API = "http://localhost:8080/api";
const fmtDate = (value) => (value ? new Date(value).toLocaleString() : "-");

const fetchLocationSuggestions = async (query) => {
  if (!query || query.trim().length < 3) return [];
  try {
    const res = await axios.get("https://nominatim.openstreetmap.org/search", {
      params: {
        q: query,
        format: "jsonv2",
        addressdetails: 1,
        limit: 5,
        "accept-language": "en",
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

const readApiError = (error, fallback) => {
  const status = error?.response?.status;
  const data = error?.response?.data;
  if (status === 401 || status === 403) return "Session expired or unauthorized. Please login again.";
  if (typeof data === "string" && data.trim()) return data;
  return data?.error || data?.message || error?.message || fallback;
};

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const DriverDashboard = () => {
  const navigate = useNavigate();
  const session = getSession();
  const [liveRides, setLiveRides] = useState([]);
  const [myRides, setMyRides] = useState([]);
  const [pins, setPins] = useState({});
  const [shipmentStage, setShipmentStage] = useState({});
  const [shipmentNote, setShipmentNote] = useState({});
  const [schedules, setSchedules] = useState([]);
  const [selectedRideId, setSelectedRideId] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({ fromLocation: "", toLocation: "", departureAt: "", capacity: "" });
  const [message, setMessage] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [fromSuggestions, setFromSuggestions] = useState([]);
  const [toSuggestions, setToSuggestions] = useState([]);

  const assignedKpis = {
    queue: myRides.filter((r) => r.status === "ACCEPTED").length,
    inProgress: myRides.filter((r) => r.status === "IN_PROGRESS").length,
    done: myRides.filter((r) => r.status === "COMPLETED").length,
    cancelled: myRides.filter((r) => r.status === "CANCELLED").length,
  };

  const packageKpis = {
    parcel: myRides.filter((r) => r.packageType === "PARCEL").length,
    food: myRides.filter((r) => r.packageType === "FOOD").length,
    document: myRides.filter((r) => r.packageType === "DOCUMENT").length,
    fragile: myRides.filter((r) => r.packageType === "FRAGILE").length,
  };

  const load = useCallback(async () => {
    try {
      const [liveRes, myRes, schedulesRes] = await Promise.all([
        axios.get(`${API}/rides/live`, { headers: getAuthHeaders() }),
        axios.get(`${API}/rides`, { params: { userId: session?.userId, role: session?.role }, headers: getAuthHeaders() }),
        axios.get(`${API}/rides/driver-schedules`, { params: { driverId: session?.userId }, headers: getAuthHeaders() }),
      ]);
      setLiveRides(liveRes.data || []);
      setMyRides(myRes.data || []);
      setSchedules(Array.isArray(schedulesRes.data) ? schedulesRes.data : []);
      setLastUpdatedAt(new Date());
      setMessage("");
    } catch (error) {
      if ([401, 403].includes(error?.response?.status)) {
        clearSession();
        navigate("/auth/login");
      }
      setMessage(readApiError(error, "Failed to load rides"));
    }
  }, [session, navigate]);

  const loadTracking = useCallback(async (rideId) => {
    if (!rideId) {
      setTracking(null);
      return;
    }
    try {
      const res = await axios.get(`${API}/rides/${rideId}/tracking`, { headers: getAuthHeaders() });
      setTracking(res.data || null);
    } catch (error) {
      setMessage(readApiError(error, "Failed to fetch ride tracking"));
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
    const timer = setTimeout(async () => setFromSuggestions(await fetchLocationSuggestions(scheduleForm.fromLocation)), 300);
    return () => clearTimeout(timer);
  }, [scheduleForm.fromLocation]);

  useEffect(() => {
    const timer = setTimeout(async () => setToSuggestions(await fetchLocationSuggestions(scheduleForm.toLocation)), 300);
    return () => clearTimeout(timer);
  }, [scheduleForm.toLocation]);

  const doAction = async (rideId, action) => {
    try {
      if (action === "accept") {
        await axios.post(`${API}/rides/${rideId}/accept`, null, {
          params: { driverId: session.userId },
          headers: getAuthHeaders(),
        });
      } else if (action === "start" || action === "complete") {
        let pin = (pins[rideId] || "").trim();

        if (!pin) {
          const trackingRes = await axios.get(`${API}/rides/${rideId}/tracking`, { headers: getAuthHeaders() });
          const trackingData = trackingRes.data || {};
          const fallbackPin = action === "start" ? trackingData.pickupPin : trackingData.dropPin;
          if (fallbackPin != null && String(fallbackPin).trim()) {
            pin = String(fallbackPin).trim();
            setPins((prev) => ({ ...prev, [rideId]: pin }));
          }
        }

        if (!pin) {
          setMessage(action === "start" ? "Pickup PIN is required to start ride" : "Drop PIN is required to complete ride");
          return;
        }

        await axios.post(`${API}/rides/${rideId}/${action}`, { pin }, { headers: getAuthHeaders() });
      } else if (action === "shipment-update") {
        await axios.post(`${API}/rides/${rideId}/shipment-update`, {
          stage: shipmentStage[rideId] || "IN_TRANSIT",
          note: shipmentNote[rideId] || "Driver shared shipment update",
        }, { headers: getAuthHeaders() });
      } else if (action === "sos-resolve") {
        await axios.post(`${API}/rides/${rideId}/sos/resolve`, {
          resolvedBy: `driver-${session.userId}`,
        }, { headers: getAuthHeaders() });
      } else {
        await axios.post(`${API}/rides/${rideId}/${action}`, null, { headers: getAuthHeaders() });
      }
      load();
    } catch (error) {
      const actionLabel = action === "start" ? "start" : action === "complete" ? "complete" : action;
      setMessage(readApiError(error, `Failed to ${actionLabel} ride. Verify PIN and ride status.`));
    }
  };

  const createSchedule = async () => {
    if (!scheduleForm.fromLocation.trim() || !scheduleForm.toLocation.trim()) {
      setMessage("From and To locations are required");
      return;
    }
    if (!scheduleForm.departureAt) {
      setMessage("Departure date/time is required");
      return;
    }
    if (!scheduleForm.capacity || Number(scheduleForm.capacity) <= 0) {
      setMessage("Capacity must be greater than 0");
      return;
    }

    try {
      await axios.post(`${API}/rides/driver-schedules`, {
        driverId: session?.userId,
        fromLocation: scheduleForm.fromLocation,
        toLocation: scheduleForm.toLocation,
        departureAt: new Date(scheduleForm.departureAt).toISOString(),
        capacity: Number(scheduleForm.capacity),
      }, { headers: getAuthHeaders() });
      setScheduleForm({ fromLocation: "", toLocation: "", departureAt: "", capacity: "" });
      setMessage("Driver route schedule created");
      load();
    } catch (error) {
      setMessage(readApiError(error, "Failed to create driver schedule"));
    }
  };

  const getNavigationTarget = (ride, details) => {
    const status = details?.status || ride?.status;
    return status === "IN_PROGRESS"
      ? { lat: details?.dropLat ?? ride?.dropLat, lng: details?.dropLng ?? ride?.dropLng }
      : { lat: details?.pickupLat ?? ride?.pickupLat, lng: details?.pickupLng ?? ride?.pickupLng };
  };

  const openNavigation = (ride) => {
    const details = ride?.id === selectedRideId ? tracking : null;
    const source = details?.driverLocation ? { lat: details.driverLocation.latitude, lng: details.driverLocation.longitude } : null;
    const target = getNavigationTarget(ride, details);
    if (target?.lat == null || target?.lng == null) {
      setMessage("Target location coordinates are missing for this ride");
      return;
    }
    const url = source?.lat != null && source?.lng != null
      ? `https://www.google.com/maps/dir/?api=1&origin=${source.lat},${source.lng}&destination=${target.lat},${target.lng}&travelmode=driving`
      : `https://www.google.com/maps/search/?api=1&query=${target.lat},${target.lng}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const selectedRide = myRides.find((r) => r.id === selectedRideId) || liveRides.find((r) => r.id === selectedRideId);
  const pickupLat = tracking?.pickupLat ?? selectedRide?.pickupLat;
  const pickupLng = tracking?.pickupLng ?? selectedRide?.pickupLng;
  const dropLat = tracking?.dropLat ?? selectedRide?.dropLat;
  const dropLng = tracking?.dropLng ?? selectedRide?.dropLng;
  const driverLat = tracking?.driverLocation?.latitude;
  const driverLng = tracking?.driverLocation?.longitude;
  const navigationTarget = getNavigationTarget(selectedRide, tracking);
  const mapCenter = driverLat != null && driverLng != null
    ? [driverLat, driverLng]
    : (pickupLat != null && pickupLng != null ? [pickupLat, pickupLng] : [17.385, 78.4867]);
  const routeLine = driverLat != null && driverLng != null && navigationTarget?.lat != null && navigationTarget?.lng != null
    ? [[driverLat, driverLng], [navigationTarget.lat, navigationTarget.lng]]
    : (pickupLat != null && pickupLng != null && dropLat != null && dropLng != null ? [[pickupLat, pickupLng], [dropLat, dropLng]] : []);

  const renderSuggestions = (items, onSelect) => items.length > 0 && (
    <div className="location-suggestions">
      {items.map((item, idx) => (
        <button key={`${item.label}-${idx}`} type="button" className="location-suggestion-item" onClick={() => onSelect(item)}>
          {item.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="role-page">
      <div className="role-shell">
        <div className="role-hero">
          <div className="role-topbar">
            <span className="role-eyebrow">Driver Operations</span>
            <h1>Driver execution dashboard</h1>
            <p className="role-subtitle">Manage route schedules, accept incoming work, and track pickup-to-drop execution with a cleaner operational flow.</p>
            <div className="role-topbar-meta">
              <span className="role-meta-chip">Driver ID: {session?.userId || "-"}</span>
              <span className="role-meta-chip">Open jobs: {liveRides.length}</span>
              <span className="role-meta-chip">In progress: {assignedKpis.inProgress}</span>
            </div>
          </div>

          <div className="role-command">
            <div>
              <p className="role-command-label">Operations Summary</p>
              <h2>Route and fulfilment command</h2>
              <p>See available jobs, publish schedule capacity, and move active rides through pickup and delivery with fewer clicks.</p>
            </div>
            <div className="role-command-actions">
              <button className="role-btn" type="button" onClick={createSchedule}>Publish Schedule</button>
              <button className="role-btn role-btn-secondary" type="button" onClick={load}>Refresh Workspace</button>
              <button className="role-btn role-btn-danger" onClick={() => { clearSession(); navigate("/auth/login"); }}>Logout</button>
            </div>
            {lastUpdatedAt && <span className="role-last-updated">Last synced {lastUpdatedAt.toLocaleTimeString()}</span>}
          </div>
        </div>

        <section className="role-section">
          <div className="role-section-header"><div><h2>Driver performance</h2><p>Current workload, completion flow, and shipment mix.</p></div></div>
          <div className="kpi-grid">
            <div className="kpi-card kpi-violet"><span>Available Jobs</span><strong>{liveRides.length}</strong><small>Unclaimed or open ride requests waiting for a driver.</small></div>
            <div className="kpi-card kpi-cyan"><span>Accepted Queue</span><strong>{assignedKpis.queue}</strong><small>Upcoming rides already assigned to you.</small></div>
            <div className="kpi-card kpi-blue"><span>In Progress</span><strong>{assignedKpis.inProgress}</strong><small>Trips currently underway and heading to destination.</small></div>
            <div className="kpi-card kpi-green"><span>Completed</span><strong>{assignedKpis.done}</strong><small>Successfully completed deliveries.</small></div>
          </div>
          <div className="kpi-grid" style={{ marginTop: 14 }}>
            <div className="kpi-card kpi-orange"><span>Parcel</span><strong>{packageKpis.parcel}</strong><small>Standard parcel jobs in your assignment history.</small></div>
            <div className="kpi-card kpi-pink"><span>Fragile</span><strong>{packageKpis.fragile}</strong><small>Fragile consignments requiring careful handling.</small></div>
            <div className="kpi-card kpi-indigo"><span>Document</span><strong>{packageKpis.document}</strong><small>Secure document deliveries on your route.</small></div>
            <div className="kpi-card kpi-rose"><span>Cancelled</span><strong>{assignedKpis.cancelled}</strong><small>Trips that were cancelled before completion.</small></div>
          </div>
        </section>

        <section className="role-section role-split">
          <div className="role-card">
            <div className="role-panel-header"><div><h3>Publish schedule capacity</h3><p className="role-card-subtitle">Create reusable route windows so matching customer bookings can land directly in your queue.</p></div></div>
            <div className="role-grid-2">
              <div className="role-field location-autocomplete">
                <label>From location</label>
                <input value={scheduleForm.fromLocation} onChange={(e) => setScheduleForm((prev) => ({ ...prev, fromLocation: e.target.value }))} placeholder="From location" />
                {scheduleForm.fromLocation.trim().length >= 3 && renderSuggestions(fromSuggestions, (s) => {
                  setScheduleForm((prev) => ({ ...prev, fromLocation: s.label }));
                  setFromSuggestions([]);
                })}
              </div>
              <div className="role-field location-autocomplete">
                <label>To location</label>
                <input value={scheduleForm.toLocation} onChange={(e) => setScheduleForm((prev) => ({ ...prev, toLocation: e.target.value }))} placeholder="To location" />
                {scheduleForm.toLocation.trim().length >= 3 && renderSuggestions(toSuggestions, (s) => {
                  setScheduleForm((prev) => ({ ...prev, toLocation: s.label }));
                  setToSuggestions([]);
                })}
              </div>
              <div className="role-field"><label>Departure time</label><input type="datetime-local" value={scheduleForm.departureAt} onChange={(e) => setScheduleForm((prev) => ({ ...prev, departureAt: e.target.value }))} /></div>
              <div className="role-field"><label>Available capacity</label><input type="number" value={scheduleForm.capacity} onChange={(e) => setScheduleForm((prev) => ({ ...prev, capacity: e.target.value }))} placeholder="Available capacity" /></div>
            </div>
            <div className="role-panel-actions" style={{ marginTop: 16 }}>
              <button onClick={createSchedule}>Publish Schedule</button>
            </div>
            <table><thead><tr><th>ID</th><th>From</th><th>To</th><th>Departure</th><th>Capacity</th><th>Active</th></tr></thead><tbody>
              {schedules.length === 0 ? <tr><td colSpan={6}>No schedules yet. Create a schedule route to start receiving matching bookings.</td></tr> : schedules.map((s) => (
                <tr key={s.id}><td>{s.id}</td><td>{s.fromLocation}</td><td>{s.toLocation}</td><td>{fmtDate(s.departureAt)}</td><td>{s.capacityAvailable} / {s.capacityTotal}</td><td>{s.active ? "Yes" : "No"}</td></tr>
              ))}
            </tbody></table>
          </div>

          <div className="role-stack">
            <div className="role-card">
              <div className="role-panel-header"><div><h3>Navigation focus</h3><p className="role-card-subtitle">Work from one selected ride and keep route execution visible at all times.</p></div></div>
              <div className="role-status-row">
                <span className="role-chip">Selected ride: {selectedRideId || "None"}</span>
                <span className="role-chip">Pickup: {tracking?.pickupLocation || selectedRide?.pickupLocation || "-"}</span>
                <span className="role-chip">Drop: {tracking?.dropLocation || selectedRide?.dropLocation || "-"}</span>
              </div>
              <div className="role-inline-note" style={{ marginTop: 14 }}>Use Navigate from a ride row to open Google Maps while keeping the dashboard context in sync.</div>
            </div>
          </div>
        </section>
        <section className="role-section">
          <div className="role-section-header"><div><h2>Live jobs board</h2><p>Accept new work, manage shipment communication, and progress rides through pickup and completion.</p></div></div>
          <div className="role-card">
            <table><thead><tr><th>ID</th><th>Status</th><th>Route</th><th>Package</th><th>Shipment</th><th>SOS</th><th>Actions</th></tr></thead><tbody>
              {liveRides.length === 0 ? <tr><td colSpan={7}>No live rides yet. Book a ride from Customer Dashboard or wait for incoming requests.</td></tr> : liveRides.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td><td>{r.status}</td><td>{r.pickupLocation} -&gt; {r.dropLocation}</td><td>{r.packageType} / {r.packageWeightKg || 0}kg</td>
                  <td>
                    <select value={shipmentStage[r.id] || "IN_TRANSIT"} onChange={(e) => setShipmentStage((prev) => ({ ...prev, [r.id]: e.target.value }))}>
                      <option value="IN_TRANSIT">IN_TRANSIT</option><option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option><option value="DELAYED">DELAYED</option><option value="DELIVERED">DELIVERED</option>
                    </select>
                    <input value={shipmentNote[r.id] || ""} onChange={(e) => setShipmentNote((prev) => ({ ...prev, [r.id]: e.target.value }))} placeholder="Shipment note" className="role-mini-input" />
                    {r.driverId === session?.userId && <button onClick={() => doAction(r.id, "shipment-update")}>Update Shipment</button>}
                  </td>
                  <td>{r.sosActive ? <button className="danger" onClick={() => doAction(r.id, "sos-resolve")}>Resolve SOS</button> : "None"}</td>
                  <td className="role-table-actions">
                    {r.driverId === session?.userId && (r.status === "ACCEPTED" || r.status === "IN_PROGRESS") && (
                      <input value={pins[r.id] || ""} onChange={(e) => setPins((prev) => ({ ...prev, [r.id]: e.target.value }))} placeholder={r.status === "ACCEPTED" ? "Pickup PIN" : "Drop PIN"} className="role-mini-input" />
                    )}
                    {r.driverId === session?.userId && r.status === "IN_PROGRESS" && (
                      <div className="role-compact-text">Use customer Drop PIN to complete this ride.</div>
                    )}
                    {(r.status === "REQUESTED" || r.status === "SCHEDULED") && !r.driverId && <button onClick={() => doAction(r.id, "accept")}>Accept Ride</button>}
                    {r.status === "ACCEPTED" && r.driverId === session?.userId && <button onClick={() => doAction(r.id, "start")}>Start Ride</button>}
                    {r.status === "IN_PROGRESS" && r.driverId === session?.userId && <button onClick={() => doAction(r.id, "complete")}>Complete Ride</button>}
                    {r.driverId === session?.userId && <button type="button" onClick={() => { setSelectedRideId(r.id); openNavigation(r); }}>Navigate</button>}
                  </td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </section>

        <section className="role-section role-split">
          <div className="role-card">
            <div className="role-panel-header"><div><h3>Assigned rides</h3><p className="role-card-subtitle">Track the jobs already attached to your account and jump into navigation instantly.</p></div></div>
            <table><thead><tr><th>ID</th><th>Status</th><th>Route</th><th>Pickup Coords</th><th>Updated</th><th>Navigation</th></tr></thead><tbody>
              {myRides.length === 0 ? <tr><td colSpan={6}>No assigned rides yet. Accept a live ride or wait for schedule-matched bookings.</td></tr> : myRides.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td><td>{r.status}</td><td>{r.pickupLocation} -&gt; {r.dropLocation}</td>
                  <td>{r.pickupLat != null && r.pickupLng != null ? `${Number(r.pickupLat).toFixed(5)}, ${Number(r.pickupLng).toFixed(5)}` : "-"}</td>
                  <td>{fmtDate(r.updatedAt)}</td>
                  <td><button type="button" onClick={() => { setSelectedRideId(r.id); openNavigation(r); }}>Navigate</button></td>
                </tr>
              ))}
            </tbody></table>
          </div>

          <div className="role-card">
            <div className="role-panel-header"><div><h3>Route map</h3><p className="role-card-subtitle">Live pickup and drop visualization for the currently selected ride.</p></div></div>
            <div className="role-metrics">
              <div className="role-metric"><div>Ride ID</div><strong>{selectedRideId || "Not selected"}</strong></div>
              <div className="role-metric"><div>Status</div><strong>{tracking?.status || selectedRide?.status || "-"}</strong></div>
              <div className="role-metric"><div>Customer Pickup</div><strong>{tracking?.pickupLocation || selectedRide?.pickupLocation || "-"}</strong></div>
              <div className="role-metric"><div>Delivery Drop</div><strong>{tracking?.dropLocation || selectedRide?.dropLocation || "-"}</strong></div>
            </div>
            {!selectedRideId && <p className="role-empty" style={{ marginTop: 14 }}>Select a ride and click Navigate to view live pickup and delivery path.</p>}
            <div className="ride-map-box">
              <MapContainer center={mapCenter} zoom={12} scrollWheelZoom style={{ height: 340, width: "100%" }}>
                <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {pickupLat != null && pickupLng != null && <Marker position={[pickupLat, pickupLng]} />}
                {dropLat != null && dropLng != null && <Marker position={[dropLat, dropLng]} />}
                {driverLat != null && driverLng != null && <Marker position={[driverLat, driverLng]} />}
                {routeLine.length > 1 && <Polyline positions={routeLine} />}
              </MapContainer>
            </div>
          </div>
        </section>

        {message && <div className="role-message">{message}</div>}
      </div>
    </div>
  );
};

export default DriverDashboard;
