import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { MapContainer, Marker, Polyline, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../styles/role-dashboards.css";
import { clearSession, getAuthHeaders, getSession } from "../utils/session";
import { useNavigate } from "react-router-dom";

const API = "http://localhost:8080/api";
const defaultPickup = { lat: 17.385, lng: 78.4867, label: "Hyderabad Center" };
const defaultDrop = { lat: 17.43, lng: 78.39, label: "Delivery Destination" };
const fmtDate = (value) => (value ? new Date(value).toLocaleString() : "-");
const fmtDistance = (value) => (value ? `${value} km` : "-");
const fmtEta = (value) => (value ? `${value} mins` : "Calculating");

const loadRazorpayCheckout = () => new Promise((resolve) => {
  if (window.Razorpay) {
    resolve(true);
    return;
  }
  const script = document.createElement("script");
  script.src = "https://checkout.razorpay.com/v1/checkout.js";
  script.onload = () => resolve(true);
  script.onerror = () => resolve(false);
  document.body.appendChild(script);
});

const readApiError = (error, fallback) => {
  const status = error?.response?.status;
  const data = error?.response?.data;
  if (status === 401 || status === 403) return "Session expired or unauthorized. Please login again.";
  if (typeof data === "string" && data.trim()) return data;
  return data?.error || data?.message || error?.message || fallback;
};

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

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const reverseGeocode = async (lat, lng) => {
  try {
    const response = await axios.get("https://nominatim.openstreetmap.org/reverse", {
      params: { lat, lon: lng, format: "jsonv2", "accept-language": "en" },
    });
    return response.data?.display_name || `${lat.toFixed(5)},${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)},${lng.toFixed(5)}`;
  }
};

const fetchRouteFromOsrm = async (source, destination) => {
  if (!source || !destination) return { path: [], distanceKm: null, etaMin: null };
  try {
    const response = await axios.get(
      `https://router.project-osrm.org/route/v1/driving/${source.lng},${source.lat};${destination.lng},${destination.lat}`,
      { params: { overview: "full", geometries: "geojson" } }
    );
    const route = response.data?.routes?.[0];
    if (!route?.geometry?.coordinates?.length) return { path: [], distanceKm: null, etaMin: null };
    return {
      path: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      distanceKm: Math.round((route.distance / 1000) * 100) / 100,
      etaMin: Math.max(1, Math.round(route.duration / 60)),
    };
  } catch {
    return { path: [], distanceKm: null, etaMin: null };
  }
};

const LocationPicker = ({ onDropPick }) => {
  useMapEvents({ click: (event) => onDropPick(event.latlng.lat, event.latlng.lng) });
  return null;
};

const CustomerDashboard = () => {
  const navigate = useNavigate();
  const session = getSession();
  const [profileImages, setProfileImages] = useState({ idProofImage: "", profileImage: "" });
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
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [searchedSchedules, setSearchedSchedules] = useState(false);
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [dropSuggestions, setDropSuggestions] = useState([]);
  const [pickupInputFocused, setPickupInputFocused] = useState(false);
  const [dropInputFocused, setDropInputFocused] = useState(false);
  const [suppressNextPickupLookup, setSuppressNextPickupLookup] = useState(false);
  const [suppressNextDropLookup, setSuppressNextDropLookup] = useState(false);
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
  const [paymentForm, setPaymentForm] = useState({ method: "UPI", amount: "", transactionRef: "" });
  const [paymentUiError, setPaymentUiError] = useState("");
  const [shipmentForm, setShipmentForm] = useState({ stage: "IN_TRANSIT", note: "" });
  const [sosMessage, setSosMessage] = useState("I need urgent support for this shipment.");
  const [feedbackForm, setFeedbackForm] = useState({ rating: 5, feedback: "" });

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

  const liveRide = rides.find((r) => r.id === selectedRideId);
  const effectivePaymentStatus = tracking?.paymentStatus || liveRide?.paymentStatus || "PENDING";
  const usesGatewayCheckout = paymentForm.method !== "CASH";
  const showPickupPin = Boolean(
    tracking?.pickupPin
    && !tracking?.pickupVerified
    && ["REQUESTED", "SCHEDULED", "ACCEPTED"].includes(tracking?.status)
  );
  const showDropPin = Boolean(
    tracking?.dropPin
    && !tracking?.dropVerified
    && tracking?.status === "IN_PROGRESS"
  );
  const packageLocationText = useMemo(() => {
    const lat = tracking?.currentPackageLat;
    const lng = tracking?.currentPackageLng;
    return lat == null || lng == null ? "Not available" : `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
  }, [tracking]);

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
      if ([401, 403].includes(error?.response?.status)) {
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
      const res = await axios.get(`${API}/rides/${rideId}/tracking`, { headers: getAuthHeaders() });
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
    const loadProfileImages = async () => {
      if (!session?.token) return;
      try {
        const res = await axios.get(`${API}/auth/profile/images`, { headers: getAuthHeaders() });
        setProfileImages({
          idProofImage: res.data?.idProofImage || "",
          profileImage: res.data?.profileImage || "",
        });
      } catch {
        setProfileImages({ idProofImage: "", profileImage: "" });
      }
    };

    loadProfileImages();
  }, [session?.token]);

  useEffect(() => {
    loadTracking(selectedRideId);
    const timer = setInterval(() => loadTracking(selectedRideId), 4000);
    return () => clearInterval(timer);
  }, [selectedRideId, loadTracking]);

  useEffect(() => {
    const source = tracking?.driverLocation
      ? { lat: tracking.driverLocation.latitude, lng: tracking.driverLocation.longitude }
      : (tracking?.pickupLat != null && tracking?.pickupLng != null ? { lat: tracking.pickupLat, lng: tracking.pickupLng } : null);
    const destination = tracking?.dropLat != null && tracking?.dropLng != null
      ? { lat: tracking.dropLat, lng: tracking.dropLng }
      : null;

    const run = async () => {
      const route = await fetchRouteFromOsrm(source, destination);
      setRoutePath(route.path);
      setRouteMeta({ distanceKm: route.distanceKm, etaMin: route.etaMin });
    };

    if (selectedRideId && source && destination) run();
    else {
      setRoutePath([]);
      setRouteMeta({ distanceKm: null, etaMin: null });
    }
  }, [tracking, selectedRideId]);

  useEffect(() => {
    if (suppressNextPickupLookup) {
      setSuppressNextPickupLookup(false);
      return;
    }
    const timer = setTimeout(async () => setPickupSuggestions(await fetchLocationSuggestions(form.pickupLocation)), 300);
    return () => clearTimeout(timer);
  }, [form.pickupLocation, suppressNextPickupLookup]);

  useEffect(() => {
    if (suppressNextDropLookup) {
      setSuppressNextDropLookup(false);
      return;
    }
    const timer = setTimeout(async () => setDropSuggestions(await fetchLocationSuggestions(form.dropLocation)), 300);
    return () => clearTimeout(timer);
  }, [form.dropLocation, suppressNextDropLookup]);

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
        setSuppressNextPickupLookup(true);
        setForm((prev) => ({ ...prev, pickupLocation: label }));
        setPickupSuggestions([]);
      },
      () => setMessage("Unable to fetch current location")
    );
  };

  const handleDropPick = async (lat, lng) => {
    const label = await reverseGeocode(lat, lng);
    setDropPoint({ lat, lng, label });
    setSuppressNextDropLookup(true);
    setForm((prev) => ({ ...prev, dropLocation: label }));
    setDropSuggestions([]);
  };

  const book = async () => {
    try {
      await axios.post(`${API}/rides/book`, {
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
      }, { headers: getAuthHeaders() });
      setMessage("Ride booked successfully");
      setSelectedScheduleId(null);
      load();
    } catch (error) {
      setMessage(readApiError(error, "Booking failed"));
    }
  };

  const loadAvailableSchedules = async () => {
    setScheduleLoading(true);
    setSearchedSchedules(true);
    try {
      const res = await axios.get(`${API}/rides/available-schedules`, {
        params: { fromLocation: form.pickupLocation, toLocation: form.dropLocation },
        headers: getAuthHeaders(),
      });

      let schedules = Array.isArray(res.data) ? res.data : [];
      if (schedules.length === 0) {
        const fallback = await axios.get(`${API}/rides/available-schedules`, {
          headers: getAuthHeaders(),
        });
        schedules = Array.isArray(fallback.data) ? fallback.data : [];

        if (schedules.length > 0) {
          setMessage("No exact route match found. Showing all active schedules.");
        } else {
          setMessage("No driver schedules available right now. Please try again shortly.");
        }
      } else {
        setMessage(`Found ${schedules.length} matching schedule(s).`);
      }

      setAvailableSchedules(schedules);
      if (schedules.length === 0) {
        setSelectedScheduleId(null);
      }
    } catch (error) {
      setMessage(readApiError(error, "Failed to fetch available schedules"));
    } finally {
      setScheduleLoading(false);
    }
  };

  const cancel = async (rideId) => {
    try {
      await axios.post(`${API}/rides/${rideId}/cancel`, null, {
        params: { reason: "Customer cancelled" },
        headers: getAuthHeaders(),
      });
      load();
      if (selectedRideId === rideId) loadTracking(rideId);
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
    () => axios.post(`${API}/rides/${selectedRideId}/shipment-update`, shipmentForm, { headers: getAuthHeaders() }),
    "Shipment update submitted"
  );

  const processPayment = async () => runRideAction(
    () => axios.post(`${API}/rides/${selectedRideId}/payment/initiate`, {
      method: paymentForm.method,
      amount: paymentForm.amount ? Number(paymentForm.amount) : Number(liveRide?.estimatedFare || 0),
      transactionRef: paymentForm.transactionRef || `SIM-${Date.now()}`,
    }, { headers: getAuthHeaders() }),
    "Cash payment marked successfully"
  );

  const processRazorpayPayment = async () => {
    setPaymentUiError("");
    if (!selectedRideId) {
      setMessage("Select a ride first");
      return;
    }

    const amount = paymentForm.amount ? Number(paymentForm.amount) : Number(liveRide?.estimatedFare || 0);
    if (!amount || amount <= 0) {
      setMessage("Enter a valid amount for payment");
      return;
    }

    setActionBusy(true);
    try {
      const sdkLoaded = await loadRazorpayCheckout();
      if (!sdkLoaded || !window.Razorpay) {
        throw new Error("Unable to load Razorpay checkout");
      }

      const orderRes = await axios.post(
        `${API}/rides/${selectedRideId}/payment/razorpay/order`,
        { amount },
        { headers: getAuthHeaders() }
      );

      const options = {
        key: orderRes.data.keyId,
        amount: orderRes.data.amountPaise,
        currency: orderRes.data.currency || "INR",
        name: "Logistics Live Payments",
        description: `Ride #${selectedRideId} Payment`,
        order_id: orderRes.data.orderId,
        prefill: {
          name: session?.fullName || "Customer",
          contact: session?.mobileNumber || "",
        },
        method: {
          upi: paymentForm.method === "UPI" || paymentForm.method === "RAZORPAY",
          card: paymentForm.method === "CARD" || paymentForm.method === "RAZORPAY",
          netbanking: paymentForm.method === "NETBANKING" || paymentForm.method === "RAZORPAY",
          wallet: paymentForm.method === "RAZORPAY",
          emi: false,
          paylater: false,
        },
        handler: async (response) => {
          await axios.post(
            `${API}/rides/${selectedRideId}/payment/razorpay/verify`,
            {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              amount,
            },
            { headers: getAuthHeaders() }
          );
          setMessage("Razorpay payment successful");
          await Promise.all([load(), loadTracking(selectedRideId)]);
        },
        modal: {
          ondismiss: () => {
            setMessage("Payment cancelled by user");
            setPaymentUiError("Payment window closed before completion.");
          },
        },
        theme: {
          color: "#0f6cbd",
        },
      };

      const rz = new window.Razorpay(options);
      rz.open();
    } catch (error) {
      const friendly = readApiError(error, "Razorpay payment failed");
      setMessage(friendly);
      setPaymentUiError(friendly);
    } finally {
      setActionBusy(false);
    }
  };

  const refreshPaymentStatus = useCallback(async () => {
    if (!selectedRideId) {
      setMessage("Select a ride first");
      return;
    }
    try {
      await axios.get(`${API}/rides/${selectedRideId}/payment/status`, { headers: getAuthHeaders() });
      await loadTracking(selectedRideId);
    } catch (error) {
      setMessage(readApiError(error, "Unable to refresh payment status"));
    }
  }, [selectedRideId, loadTracking]);

  useEffect(() => {
    if (!selectedRideId) return;
    if (effectivePaymentStatus !== "PROCESSING") return;

    const timer = setInterval(() => {
      refreshPaymentStatus();
    }, 2000);

    return () => clearInterval(timer);
  }, [selectedRideId, effectivePaymentStatus, refreshPaymentStatus]);

  const raiseSos = async () => runRideAction(
    () => axios.post(`${API}/rides/${selectedRideId}/sos`, { message: sosMessage }, { headers: getAuthHeaders() }),
    "SOS raised to customer support"
  );

  const resolveSos = async () => runRideAction(
    () => axios.post(`${API}/rides/${selectedRideId}/sos/resolve`, {
      resolvedBy: `customer-${session?.userId || "portal"}`,
    }, { headers: getAuthHeaders() }),
    "SOS marked as resolved"
  );

  const submitFeedback = async () => runRideAction(
    () => axios.post(`${API}/rides/${selectedRideId}/feedback`, {
      rating: Number(feedbackForm.rating),
      feedback: feedbackForm.feedback,
    }, { headers: getAuthHeaders() }),
    "Feedback submitted"
  );

  const trackedPickupLat = tracking?.pickupLat ?? pickupPoint.lat;
  const trackedPickupLng = tracking?.pickupLng ?? pickupPoint.lng;
  const trackedDropLat = tracking?.dropLat ?? dropPoint.lat;
  const trackedDropLng = tracking?.dropLng ?? dropPoint.lng;
  const trackingPath = routePath.length > 1
    ? routePath
    : (tracking?.driverLocation
      ? [[tracking.driverLocation.latitude, tracking.driverLocation.longitude], [trackedDropLat, trackedDropLng]]
      : [[trackedPickupLat, trackedPickupLng], [trackedDropLat, trackedDropLng]]);

  const renderSuggestions = (items, onSelect) => items.length > 0 && (
    <div className="location-suggestions">
      {items.map((item, idx) => (
        <button
          key={`${item.label}-${idx}`}
          type="button"
          className="location-suggestion-item"
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(item);
          }}
        >
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
            <span className="role-eyebrow">Customer Operations</span>
            <h1>Customer delivery dashboard</h1>
            <p className="role-subtitle">Plan bookings, monitor active deliveries, and manage payment, support, and feedback from one clear workspace.</p>
            <div className="role-topbar-meta">
              <span className="role-meta-chip">Customer ID: {session?.userId || "-"}</span>
              <span className="role-meta-chip">Name: {session?.fullName || "-"}</span>
              <span className="role-meta-chip">Live rides: {rideKpis.live}</span>
              <span className="role-meta-chip">Completed deliveries: {rideKpis.completed}</span>
            </div>
          </div>

          <div className="role-command">
            <div>
              <p className="role-command-label">Control Center</p>
              <h2>Shipment command panel</h2>
              <p>Keep bookings moving, review the freshest route status, and jump into urgent actions without hunting through tables.</p>
            </div>
            <div className="role-profile-card">
              <div className="role-profile-details">
                <p className="role-profile-title">Customer Profile</p>
                <p className="role-profile-item"><strong>Mobile:</strong> {session?.mobileNumber || "-"}</p>
                <p className="role-profile-item"><strong>Address:</strong> {session?.address || "-"}</p>
                <p className="role-profile-item"><strong>ID Proof:</strong> {profileImages?.idProofImage ? "Uploaded" : "Not uploaded"}</p>
              </div>
              {(profileImages?.profileImage || profileImages?.idProofImage)
                && <img src={profileImages?.profileImage || profileImages?.idProofImage} alt="Customer Profile" className="role-profile-image" />}
            </div>
            <div className="role-command-actions">
              <button className="role-btn role-btn-secondary" type="button" onClick={useCurrentLocation}>Use Current Location</button>
              <button className="role-btn" type="button" onClick={loadAvailableSchedules}>Find Matching Schedules</button>
              <button className="role-btn role-btn-danger" onClick={() => { clearSession(); navigate("/auth/login"); }}>Logout</button>
            </div>
            {lastUpdatedAt && <span className="role-last-updated">Last synced {lastUpdatedAt.toLocaleTimeString()}</span>}
          </div>
        </div>

        <section className="role-section">
          <div className="role-section-header"><div><h2>Booking performance</h2><p>High-level ride and package mix at a glance.</p></div></div>
          <div className="kpi-grid">
            <div className="kpi-card kpi-blue"><span>Total Rides</span><strong>{rideKpis.total}</strong><small>All customer bookings created in this account.</small></div>
            <div className="kpi-card kpi-violet"><span>Live Rides</span><strong>{rideKpis.live}</strong><small>Requests currently in progress or waiting on fulfilment.</small></div>
            <div className="kpi-card kpi-green"><span>Completed</span><strong>{rideKpis.completed}</strong><small>Orders that have reached successful delivery.</small></div>
            <div className="kpi-card kpi-rose"><span>Cancelled</span><strong>{rideKpis.cancelled}</strong><small>Trips cancelled before completion.</small></div>
          </div>
          <div className="kpi-grid" style={{ marginTop: 14 }}>
            <div className="kpi-card kpi-orange"><span>Parcel</span><strong>{packageKpis.parcel}</strong><small>Standard parcel shipments currently tracked.</small></div>
            <div className="kpi-card kpi-cyan"><span>Food</span><strong>{packageKpis.food}</strong><small>Food or grocery deliveries requested.</small></div>
            <div className="kpi-card kpi-indigo"><span>Document</span><strong>{packageKpis.document}</strong><small>Documents requiring secure transfer.</small></div>
            <div className="kpi-card kpi-pink"><span>Fragile</span><strong>{packageKpis.fragile}</strong><small>Fragile packages needing extra handling care.</small></div>
          </div>
        </section>

        <section className="role-section role-split">
          <div className="role-card">
            <div className="role-panel-header">
              <div><h3>Create a new booking</h3><p className="role-card-subtitle">Set route, timing, package details, and optional price expectations before confirming the ride.</p></div>
              <span className="role-inline-pill">Interactive map enabled</span>
            </div>
            <div className="role-grid-2">
              <div className="role-field location-autocomplete">
                <label>Pickup location</label>
                <input
                  value={form.pickupLocation}
                  onFocus={() => setPickupInputFocused(true)}
                  onBlur={() => setTimeout(() => setPickupInputFocused(false), 120)}
                  onChange={(e) => setForm({ ...form, pickupLocation: e.target.value })}
                  placeholder="Pickup location name"
                />
                {pickupInputFocused && form.pickupLocation.trim().length >= 3 && renderSuggestions(pickupSuggestions, (s) => {
                  setSuppressNextPickupLookup(true);
                  setForm((prev) => ({ ...prev, pickupLocation: s.label }));
                  setPickupPoint({ lat: s.lat, lng: s.lng, label: s.label });
                  setPickupSuggestions([]);
                })}
              </div>
              <div className="role-field location-autocomplete">
                <label>Drop location</label>
                <input
                  value={form.dropLocation}
                  onFocus={() => setDropInputFocused(true)}
                  onBlur={() => setTimeout(() => setDropInputFocused(false), 120)}
                  onChange={(e) => setForm({ ...form, dropLocation: e.target.value })}
                  placeholder="Drop location name"
                />
                {dropInputFocused && form.dropLocation.trim().length >= 3 && renderSuggestions(dropSuggestions, (s) => {
                  setSuppressNextDropLookup(true);
                  setForm((prev) => ({ ...prev, dropLocation: s.label }));
                  setDropPoint({ lat: s.lat, lng: s.lng, label: s.label });
                  setDropSuggestions([]);
                })}
              </div>
              <div className="role-field"><label>Scheduled pickup</label><input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></div>
              <div className="role-field"><label>Estimated fare</label><input type="number" value={form.estimatedFare} onChange={(e) => setForm({ ...form, estimatedFare: e.target.value })} placeholder="Estimated fare" /></div>
              <div className="role-field">
                <label>Package type</label>
                <select value={form.packageType} onChange={(e) => setForm({ ...form, packageType: e.target.value })}>
                  <option value="PARCEL">PARCEL</option><option value="DOCUMENT">DOCUMENT</option><option value="FOOD">FOOD</option><option value="FRAGILE">FRAGILE</option>
                </select>
              </div>
              <div className="role-field"><label>Weight in kg</label><input type="number" value={form.packageWeightKg} onChange={(e) => setForm({ ...form, packageWeightKg: e.target.value })} placeholder="Package kg" /></div>
            </div>
            <div className="role-field"><label>Package description</label><textarea value={form.packageDescription} onChange={(e) => setForm({ ...form, packageDescription: e.target.value })} placeholder="Package details" /></div>
            <div className="role-inline-note">Click the map to place the delivery destination with OpenStreetMap precision.</div>
            <div className="ride-map-box">
              <MapContainer center={[pickupPoint.lat, pickupPoint.lng]} zoom={12} scrollWheelZoom style={{ height: 320, width: "100%" }}>
                <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <LocationPicker onDropPick={handleDropPick} />
                <Marker position={[pickupPoint.lat, pickupPoint.lng]} />
                <Marker position={[dropPoint.lat, dropPoint.lng]} />
                <Polyline positions={[[pickupPoint.lat, pickupPoint.lng], [dropPoint.lat, dropPoint.lng]]} />
              </MapContainer>
            </div>
            <div className="role-panel-actions" style={{ marginTop: 16 }}>
              <button className="role-btn" type="button" onClick={loadAvailableSchedules} disabled={scheduleLoading}>
                {scheduleLoading ? "Searching Schedules..." : "Find Driver Schedules for This Route"}
              </button>
              <button className="role-btn role-btn-secondary" type="button" onClick={book}>Confirm Booking</button>
            </div>
          </div>

          <div className="role-stack">
            <div className="role-card">
              <div className="role-panel-header">
                <div><h3>Schedule matches</h3><p className="role-card-subtitle">Select a planned route when you want predictable departure slots and available capacity.</p></div>
                <span className="role-section-side">{availableSchedules.length} options</span>
              </div>
              {availableSchedules.length === 0 ? (
                <p className="role-empty">
                  {scheduleLoading
                    ? "Searching schedules..."
                    : (searchedSchedules
                      ? "No schedules found for this route right now."
                      : "Search the current route to surface driver schedules with matching pickup and drop coverage.")}
                </p>
              ) : (
                <table><thead><tr><th>Select</th><th>Driver</th><th>From</th><th>To</th><th>Departure</th><th>Capacity</th></tr></thead><tbody>
                  {availableSchedules.map((s) => (
                    <tr key={s.id}>
                      <td><input type="radio" name="selectedSchedule" checked={selectedScheduleId === s.id} onChange={() => setSelectedScheduleId(s.id)} /></td>
                      <td>{s.driverId}</td><td>{s.fromLocation}</td><td>{s.toLocation}</td><td>{fmtDate(s.departureAt)}</td><td>{s.capacityAvailable} / {s.capacityTotal}</td>
                    </tr>
                  ))}
                </tbody></table>
              )}
            </div>
            <div className="role-card">
              <div className="role-panel-header"><div><h3>Tracking focus</h3><p className="role-card-subtitle">Stay aligned on the currently selected ride and intervene quickly when something changes.</p></div></div>
              <div className="role-status-row">
                <span className="role-chip">Selected ride: {selectedRideId || "None"}</span>
                <span className="role-chip">Payment: {effectivePaymentStatus}</span>
                <span className={`role-chip ${tracking?.sosActive ? "alert" : ""}`}>SOS: {tracking?.sosActive ? "Active" : "Normal"}</span>
              </div>
              <div className="role-inline-note" style={{ marginTop: 14 }}>Choose a ride from the table below to unlock live route ETA, package location, payment, support, and feedback controls.</div>
            </div>
          </div>
        </section>
        <section className="role-section">
          <div className="role-section-header"><div><h2>Ride portfolio</h2><p>Operational view of every customer booking, status, assigned driver, and service outcome.</p></div></div>
          <div className="role-card">
            <table><thead><tr><th>ID</th><th>Status</th><th>Driver</th><th>Route</th><th>Package</th><th>Schedule</th><th>Shipment</th><th>Payment</th><th>Rating</th><th>Tracking</th><th>Action</th></tr></thead><tbody>
              {rides.length === 0 ? (
                <tr><td colSpan={11}>No rides yet. Create a booking above and it will appear here automatically.</td></tr>
              ) : rides.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td><td>{r.status}</td><td>{r.driverId || "Pending"}</td><td>{r.pickupLocation} -&gt; {r.dropLocation}</td>
                  <td>{r.packageType} / {r.packageWeightKg || 0}kg</td><td>{r.routeScheduleId || "-"}</td><td>{r.shipmentStage || r.packageStatus || "-"}</td>
                  <td>{r.paymentStatus || "PENDING"}</td><td>{r.customerRating || "-"}</td>
                  <td><button type="button" onClick={() => setSelectedRideId(r.id)}>Track Ride</button></td>
                  <td>{(r.status !== "COMPLETED" && r.status !== "CANCELLED") && <button className="danger" onClick={() => cancel(r.id)}>Cancel Ride</button>}</td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </section>

        <section className="role-section role-split">
          <div className="role-card">
            <div className="role-panel-header"><div><h3>Live tracking and route intelligence</h3><p className="role-card-subtitle">Real-time visibility into route progress, package position, delivery ETA, and current ride state.</p></div></div>
            {!selectedRideId ? <p className="role-empty">Select a ride to view live tracking, route path, ETA, and package position.</p> : (
              <>
                <div className="role-metrics">
                  <div className="role-metric"><div>Ride ID</div><strong>{selectedRideId}</strong></div>
                  <div className="role-metric"><div>Current Status</div><strong>{tracking?.status || liveRide?.status || "-"}</strong></div>
                  <div className="role-metric"><div>Shipment Stage</div><strong>{tracking?.shipmentStage || tracking?.packageStatus || "-"}</strong></div>
                  <div className="role-metric">
                    <div>Pickup PIN</div>
                    <strong>{showPickupPin ? tracking?.pickupPin : (tracking?.pickupVerified ? "Verified" : "Not required")}</strong>
                  </div>
                  <div className="role-metric">
                    <div>Drop PIN</div>
                    <strong>{showDropPin ? tracking?.dropPin : (tracking?.dropVerified ? "Verified" : "Available after pickup")}</strong>
                  </div>
                  <div className="role-metric"><div>ETA</div><strong>{fmtEta(routeMeta.etaMin || tracking?.etaMinutes)}</strong></div>
                  <div className="role-metric"><div>Route Distance</div><strong>{fmtDistance(routeMeta.distanceKm || tracking?.distanceToDropKm)}</strong></div>
                  <div className="role-metric"><div>Package Location</div><strong>{packageLocationText}</strong></div>
                  <div className="role-metric"><div>Payment Status</div><strong>{effectivePaymentStatus}</strong></div>
                  <div className="role-metric"><div>SOS Status</div><strong>{tracking?.sosActive ? "ACTIVE" : "NORMAL"}</strong></div>
                </div>
                <div className="ride-map-box">
                  <MapContainer center={[trackedPickupLat, trackedPickupLng]} zoom={12} scrollWheelZoom style={{ height: 360, width: "100%" }}>
                    <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Marker position={[trackedPickupLat, trackedPickupLng]} />
                    <Marker position={[trackedDropLat, trackedDropLng]} />
                    {tracking?.driverLocation && <Marker position={[tracking.driverLocation.latitude, tracking.driverLocation.longitude]} />}
                    {(tracking?.currentPackageLat != null && tracking?.currentPackageLng != null) && <Marker position={[tracking.currentPackageLat, tracking.currentPackageLng]} />}
                    <Polyline positions={trackingPath} />
                  </MapContainer>
                </div>
              </>
            )}
          </div>

          <div className="role-stack">
            <div className="role-card">
              <div className="role-panel-header"><div><h3>Shipment communication</h3><p className="role-card-subtitle">Publish customer-facing updates when parcel status changes or delivery timing shifts.</p></div></div>
              <div className="role-field"><label>Shipment stage</label>
                <select value={shipmentForm.stage} onChange={(e) => setShipmentForm((prev) => ({ ...prev, stage: e.target.value }))} disabled={actionBusy}>
                  <option value="IN_TRANSIT">IN_TRANSIT</option><option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option><option value="DELAYED">DELAYED</option><option value="DELIVERED">DELIVERED</option>
                </select>
              </div>
              <div className="role-field"><label>Customer note</label><textarea value={shipmentForm.note} onChange={(e) => setShipmentForm((prev) => ({ ...prev, note: e.target.value }))} placeholder="Add shipment note for customer visibility" /></div>
              <button disabled={actionBusy} onClick={updateShipment}>Publish Shipment Update</button>
            </div>

            <div className="role-card">
              <div className="role-panel-header"><div><h3>Payment and support</h3><p className="role-card-subtitle">Initiate payments and watch status update in real-time while it is being processed.</p></div></div>
              <div className="role-grid-2">
                <div>
                  <div className="role-field"><label>Payment method</label>
                    <select value={paymentForm.method} onChange={(e) => setPaymentForm((prev) => ({ ...prev, method: e.target.value }))} disabled={actionBusy}>
                      <option value="UPI">UPI</option><option value="CARD">CARD</option><option value="NETBANKING">NETBANKING</option><option value="CASH">CASH</option><option value="RAZORPAY">RAZORPAY</option>
                    </select>
                  </div>
                  <div className="role-field"><label>Amount</label><input type="number" placeholder="Amount" value={paymentForm.amount} onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))} /></div>
                  <div className="role-field"><label>Transaction reference</label><input placeholder="Transaction Ref (optional)" value={paymentForm.transactionRef} onChange={(e) => setPaymentForm((prev) => ({ ...prev, transactionRef: e.target.value }))} /></div>
                  <div className="role-inline-note" style={{ marginBottom: 8 }}>Current: {effectivePaymentStatus} {tracking?.paymentTransactionRef ? `| Ref: ${tracking.paymentTransactionRef}` : ""}</div>
                  {paymentUiError && <div className="role-message" style={{ marginTop: 0, marginBottom: 8 }}>{paymentUiError}</div>}
                  <div className="role-panel-actions">
                    <button
                      disabled={actionBusy || effectivePaymentStatus === "SUCCESS"}
                      onClick={usesGatewayCheckout ? processRazorpayPayment : processPayment}
                    >
                      {effectivePaymentStatus === "PROCESSING"
                        ? "Payment Processing..."
                        : (usesGatewayCheckout ? `Pay with ${paymentForm.method === "RAZORPAY" ? "Razorpay" : paymentForm.method}` : "Pay Cash")}
                    </button>
                    <button className="role-btn-secondary" type="button" disabled={actionBusy || !selectedRideId} onClick={refreshPaymentStatus}>Refresh Payment Status</button>
                  </div>
                </div>
                <div>
                  <div className="role-field"><label>SOS message</label><textarea value={sosMessage} onChange={(e) => setSosMessage(e.target.value)} placeholder="Describe emergency or support issue" /></div>
                  <div className="role-panel-actions">
                    <button className="danger" disabled={actionBusy || !!tracking?.sosActive} onClick={raiseSos}>Raise SOS</button>
                    <button className="role-btn-secondary" disabled={actionBusy || !tracking?.sosActive} onClick={resolveSos}>Resolve SOS</button>
                  </div>
                  <div className="role-inline-note">Active SOS: {tracking?.sosActive ? "Yes" : "No"}</div>
                </div>
              </div>
            </div>

            <div className="role-card">
              <div className="role-panel-header"><div><h3>Experience feedback</h3><p className="role-card-subtitle">Close the loop with a delivery rating and a short review once the trip is complete.</p></div></div>
              <div className="role-field"><label>Rating</label>
                <select value={feedbackForm.rating} onChange={(e) => setFeedbackForm((prev) => ({ ...prev, rating: e.target.value }))} disabled={actionBusy}>
                  <option value={5}>5 - Excellent</option><option value={4}>4 - Good</option><option value={3}>3 - Average</option><option value={2}>2 - Poor</option><option value={1}>1 - Very Poor</option>
                </select>
              </div>
              <div className="role-field"><label>Feedback</label><textarea value={feedbackForm.feedback} onChange={(e) => setFeedbackForm((prev) => ({ ...prev, feedback: e.target.value }))} placeholder="Share delivery feedback" /></div>
              <button disabled={actionBusy} onClick={submitFeedback}>Submit Rating</button>
            </div>
          </div>
        </section>

        {message && <div className="role-message">{message}</div>}
      </div>
    </div>
  );
};

export default CustomerDashboard;
