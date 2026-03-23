import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import "../styles/ride-ops.css";

const API = "http://localhost:8080/api";

const extractErrorMessage = (error, fallback) => {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
};

const RideOps = () => {
  const [registerForm, setRegisterForm] = useState({
    username: "",
    password: "",
    fullName: "",
    role: "CUSTOMER",
  });
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [bookingForm, setBookingForm] = useState({
    pickupLocation: "",
    dropLocation: "",
    scheduledAt: "",
    packageType: "PARCEL",
    packageWeightKg: "",
    packageDescription: "",
    estimatedFare: "",
  });
  const [session, setSession] = useState(() => {
    const raw = localStorage.getItem("ride_session");
    return raw ? JSON.parse(raw) : null;
  });
  const [rides, setRides] = useState([]);
  const [liveRides, setLiveRides] = useState([]);
  const [metrics, setMetrics] = useState({
    liveRides: 0,
    scheduled: 0,
    deliveries: 0,
    cancellations: 0,
  });
  const [message, setMessage] = useState("");
  const [cancelReason, setCancelReason] = useState("Customer cancelled");

  const authHeaders = useMemo(
    () => (session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
    [session]
  );

  const fetchData = useCallback(async () => {
    try {
      const [liveRes, metricsRes, ridesRes] = await Promise.all([
        axios.get(`${API}/rides/live`, { headers: authHeaders }),
        axios.get(`${API}/rides/metrics`, { headers: authHeaders }),
        session
          ? axios.get(`${API}/rides`, {
              params: {
                userId: session.userId,
                role: session.role,
              },
              headers: authHeaders,
            })
          : axios.get(`${API}/rides`, { headers: authHeaders }),
      ]);

      setLiveRides(liveRes.data || []);
      setMetrics(metricsRes.data || {});
      setRides(ridesRes.data || []);
    } catch (error) {
      setMessage(extractErrorMessage(error, "Request failed"));
    }
  }, [session, authHeaders]);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 4000);
    return () => clearInterval(timer);
  }, [fetchData]);

  const persistSession = (payload) => {
    setSession(payload);
    localStorage.setItem("ride_session", JSON.stringify(payload));
  };

  const clearSession = () => {
    setSession(null);
    localStorage.removeItem("ride_session");
  };

  const register = async () => {
    try {
      await axios.post(`${API}/auth/register`, registerForm);
      setMessage("Registration successful. Please login.");
    } catch (error) {
      setMessage(extractErrorMessage(error, "Registration failed"));
    }
  };

  const login = async () => {
    try {
      const res = await axios.post(`${API}/auth/login`, loginForm);
      persistSession(res.data);
      setMessage(`Logged in as ${res.data.role}`);
    } catch (error) {
      setMessage(extractErrorMessage(error, "Login failed"));
    }
  };

  const bookRide = async () => {
    if (!session) {
      setMessage("Login first to book a ride");
      return;
    }

    try {
      const payload = {
        customerId: session.userId,
        pickupLocation: bookingForm.pickupLocation,
        dropLocation: bookingForm.dropLocation,
        scheduledAt: bookingForm.scheduledAt ? new Date(bookingForm.scheduledAt).toISOString() : null,
        packageType: bookingForm.packageType,
        packageWeightKg: bookingForm.packageWeightKg ? Number(bookingForm.packageWeightKg) : null,
        packageDescription: bookingForm.packageDescription,
        estimatedFare: bookingForm.estimatedFare ? Number(bookingForm.estimatedFare) : null,
      };

      await axios.post(`${API}/rides/book`, payload, { headers: authHeaders });
      setMessage("Ride created successfully");
      setBookingForm({
        pickupLocation: "",
        dropLocation: "",
        scheduledAt: "",
        packageType: "PARCEL",
        packageWeightKg: "",
        packageDescription: "",
        estimatedFare: "",
      });
      fetchData();
    } catch (error) {
      setMessage(extractErrorMessage(error, "Booking failed"));
    }
  };

  const acceptRide = async (rideId) => {
    if (!session) return;
    try {
      await axios.post(
        `${API}/rides/${rideId}/accept`,
        null,
        { params: { driverId: session.userId }, headers: authHeaders }
      );
      setMessage(`Ride #${rideId} accepted`);
      fetchData();
    } catch (error) {
      setMessage(extractErrorMessage(error, "Accept failed"));
    }
  };

  const startRide = async (rideId) => {
    try {
      await axios.post(`${API}/rides/${rideId}/start`, null, { headers: authHeaders });
      setMessage(`Ride #${rideId} started`);
      fetchData();
    } catch (error) {
      setMessage(extractErrorMessage(error, "Start failed"));
    }
  };

  const completeRide = async (rideId) => {
    try {
      await axios.post(`${API}/rides/${rideId}/complete`, null, { headers: authHeaders });
      setMessage(`Ride #${rideId} completed`);
      fetchData();
    } catch (error) {
      setMessage(extractErrorMessage(error, "Complete failed"));
    }
  };

  const cancelRide = async (rideId) => {
    try {
      await axios.post(
        `${API}/rides/${rideId}/cancel`,
        null,
        { params: { reason: cancelReason }, headers: authHeaders }
      );
      setMessage(`Ride #${rideId} cancelled`);
      fetchData();
    } catch (error) {
      setMessage(extractErrorMessage(error, "Cancel failed"));
    }
  };

  return (
    <div className="ride-ops-page">
      <h1>Ride Operations</h1>

      <div className="ride-ops-grid">
        <div className="ride-card">
          <h3>Register</h3>
          <input placeholder="Username" value={registerForm.username} onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })} />
          <input placeholder="Full Name" value={registerForm.fullName} onChange={(e) => setRegisterForm({ ...registerForm, fullName: e.target.value })} />
          <input type="password" placeholder="Password" value={registerForm.password} onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })} />
          <select value={registerForm.role} onChange={(e) => setRegisterForm({ ...registerForm, role: e.target.value })}>
            <option value="CUSTOMER">CUSTOMER</option>
            <option value="DRIVER">DRIVER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          <button onClick={register}>Create User</button>
        </div>

        <div className="ride-card">
          <h3>Login</h3>
          <input placeholder="Username" value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} />
          <input type="password" placeholder="Password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} />
          <button onClick={login}>Login</button>
          {session && (
            <div className="session-box">
              <p>User: {session.fullName}</p>
              <p>Role: {session.role}</p>
              <p>ID: {session.userId}</p>
              <button className="danger" onClick={clearSession}>Logout</button>
            </div>
          )}
        </div>

        <div className="ride-card wide">
          <h3>Book / Schedule Ride With Package</h3>
          <div className="form-row">
            <input placeholder="Pickup location" value={bookingForm.pickupLocation} onChange={(e) => setBookingForm({ ...bookingForm, pickupLocation: e.target.value })} />
            <input placeholder="Drop location" value={bookingForm.dropLocation} onChange={(e) => setBookingForm({ ...bookingForm, dropLocation: e.target.value })} />
          </div>
          <div className="form-row">
            <input type="datetime-local" value={bookingForm.scheduledAt} onChange={(e) => setBookingForm({ ...bookingForm, scheduledAt: e.target.value })} />
            <input placeholder="Estimated fare" type="number" value={bookingForm.estimatedFare} onChange={(e) => setBookingForm({ ...bookingForm, estimatedFare: e.target.value })} />
          </div>
          <div className="form-row">
            <select value={bookingForm.packageType} onChange={(e) => setBookingForm({ ...bookingForm, packageType: e.target.value })}>
              <option value="PARCEL">PARCEL</option>
              <option value="FOOD">FOOD</option>
              <option value="DOCUMENT">DOCUMENT</option>
              <option value="FRAGILE">FRAGILE</option>
            </select>
            <input placeholder="Package weight (kg)" type="number" value={bookingForm.packageWeightKg} onChange={(e) => setBookingForm({ ...bookingForm, packageWeightKg: e.target.value })} />
          </div>
          <textarea placeholder="Package details" value={bookingForm.packageDescription} onChange={(e) => setBookingForm({ ...bookingForm, packageDescription: e.target.value })} />
          <button onClick={bookRide}>Book Ride</button>
        </div>
      </div>

      <div className="ride-metrics">
        <div className="metric"><span>Live Rides</span><strong>{metrics.liveRides || 0}</strong></div>
        <div className="metric"><span>Scheduled</span><strong>{metrics.scheduled || 0}</strong></div>
        <div className="metric"><span>Deliveries</span><strong>{metrics.deliveries || 0}</strong></div>
        <div className="metric"><span>Cancellations</span><strong>{metrics.cancellations || 0}</strong></div>
      </div>

      <div className="ride-card">
        <h3>Live Ride Monitoring</h3>
        <p className="help">Lifecycle: BOOKED/SCHEDULED -> ACCEPTED -> IN_PROGRESS -> COMPLETED/CANCELLED</p>
        <div className="form-row">
          <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Cancel reason" />
          <button onClick={fetchData}>Refresh</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Status</th>
              <th>Customer</th>
              <th>Driver</th>
              <th>Route</th>
              <th>Package</th>
              <th>Schedule</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(liveRides.length ? liveRides : rides).map((ride) => (
              <tr key={ride.id}>
                <td>{ride.id}</td>
                <td>{ride.status}</td>
                <td>{ride.customerId}</td>
                <td>{ride.driverId || "-"}</td>
                <td>{ride.pickupLocation} -> {ride.dropLocation}</td>
                <td>{ride.packageType || "-"} / {ride.packageWeightKg || 0}kg</td>
                <td>{ride.scheduledAt ? new Date(ride.scheduledAt).toLocaleString() : "Immediate"}</td>
                <td>
                  {session?.role === "DRIVER" && (ride.status === "REQUESTED" || ride.status === "SCHEDULED") && (
                    <button onClick={() => acceptRide(ride.id)}>Accept</button>
                  )}
                  {session?.role === "DRIVER" && ride.status === "ACCEPTED" && ride.driverId === session.userId && (
                    <button onClick={() => startRide(ride.id)}>Start</button>
                  )}
                  {session?.role === "DRIVER" && ride.status === "IN_PROGRESS" && ride.driverId === session.userId && (
                    <button onClick={() => completeRide(ride.id)}>Complete</button>
                  )}
                  {(ride.status !== "COMPLETED" && ride.status !== "CANCELLED") && (
                    <button className="danger" onClick={() => cancelRide(ride.id)}>Cancel</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {message && <div className="message-box">{message}</div>}
    </div>
  );
};

export default RideOps;
