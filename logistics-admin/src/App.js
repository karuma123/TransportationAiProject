import { BrowserRouter as Router, Routes, Route, Navigate, NavLink } from "react-router-dom";
import AdminDashboard from "./components/AdminDashboard";
import GpsUpload from "./components/GpsUpload";
import RealtimeDashboard from "./components/RealtimeDashboard";
import LoginPage from "./components/LoginPage";
import RegisterPage from "./components/RegisterPage";
import CustomerDashboard from "./components/CustomerDashboard";
import DriverDashboard from "./components/DriverDashboard";
import AdminRideDashboard from "./components/AdminRideDashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import "./styles/nav.css";
import { clearSession, getSession } from "./utils/session";

function App() {
  const session = getSession();

  return (
    <Router>
      <nav className="app-nav">
        <div className="nav-brand">
          <span className="nav-logo">🛰️</span>
          <span className="nav-title">AI Fleet Monitor</span>
        </div>
        <div className="nav-links">
          <NavLink to="/realtime" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            📡 Real-Time
          </NavLink>
          {!session && (
            <>
              <NavLink to="/auth/login" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                🔐 Login
              </NavLink>
              <NavLink to="/auth/register" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                ✨ Register
              </NavLink>
            </>
          )}
          {session?.role === "CUSTOMER" && (
            <NavLink to="/customer/dashboard" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
              👤 Customer
            </NavLink>
          )}
          {session?.role === "DRIVER" && (
            <NavLink to="/driver/dashboard" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
              🚗 Driver
            </NavLink>
          )}
          {session?.role === "ADMIN" && (
            <>
              <NavLink to="/admin/rides" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                🚚 Admin Rides
              </NavLink>
              <NavLink to="/admin/dashboard" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                📊 Admin Risk
              </NavLink>
              <NavLink to="/admin/gps-upload" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                📤 GPS Upload
              </NavLink>
            </>
          )}
          {session && (
            <button
              className="nav-link"
              onClick={() => {
                clearSession();
                window.location.href = "/auth/login";
              }}
            >
              ⏻ Logout
            </button>
          )}
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<Navigate to="/realtime" />} />
        <Route path="/realtime" element={<RealtimeDashboard />} />
        <Route path="/auth" element={<Navigate to="/auth/login" />} />
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />

        <Route
          path="/customer/dashboard"
          element={
            <ProtectedRoute roles={["CUSTOMER"]}>
              <CustomerDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/driver/dashboard"
          element={
            <ProtectedRoute roles={["DRIVER"]}>
              <DriverDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/rides"
          element={
            <ProtectedRoute roles={["ADMIN"]}>
              <AdminRideDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute roles={["ADMIN"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/gps-upload"
          element={
            <ProtectedRoute roles={["ADMIN"]}>
              <GpsUpload />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;