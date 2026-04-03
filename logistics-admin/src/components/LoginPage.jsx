import React, { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { saveSession } from "../utils/session";
import "../styles/auth-pages.css";

const API = "http://localhost:8080/api";

const readError = (error, fallback) => (
  error?.response?.data?.message
  || error?.response?.data?.error
  || error?.message
  || fallback
);

const LoginPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [message, setMessage] = useState("");

  const login = async (event) => {
    event.preventDefault();
    try {
      const res = await axios.post(`${API}/auth/login`, form);
      let session = res.data;
      try {
        const profileRes = await axios.get(`${API}/auth/profile`, {
          headers: { Authorization: `Bearer ${res.data.token}` },
        });
        session = { ...res.data, ...profileRes.data };
      } catch {
        // Continue with login response data if profile endpoint is unavailable.
      }

      saveSession(session);
      if (session.role === "CUSTOMER") navigate("/customer/dashboard");
      else if (session.role === "DRIVER") navigate("/driver/dashboard");
      else navigate("/admin/rides");
    } catch (error) {
      setMessage(readError(error, "Sign in failed"));
    }
  };

  return (
    <main className="auth-shell auth-login-theme">
      <section className="auth-showcase" aria-label="Platform summary">
        <p className="auth-eyebrow">AI Fleet Monitor</p>
        <h1 className="auth-showcase-title">Secure access to live fleet intelligence</h1>
        <p className="auth-showcase-copy">
          Monitor driver safety, route anomalies, and operational alerts from one reliable dashboard.
        </p>

        <div className="auth-feature-grid">
          <article className="auth-feature-card">
            <h2>Dashboard</h2>
            <p>Unified view of trips, exceptions, and system health in real time.</p>
          </article>
          <article className="auth-feature-card">
            <h2>Analytics</h2>
            <p>Actionable metrics for safety trends, route performance, and incidents.</p>
          </article>
          <article className="auth-feature-card">
            <h2>Profile Access</h2>
            <p>Role-based permissions for customers, drivers, and operations admins.</p>
          </article>
        </div>
      </section>

      <section className="auth-panel" aria-label="Sign in form">
        <div className="auth-panel-header">
          <p className="auth-kicker">Welcome back</p>
          <h2>Sign In</h2>
          <p className="auth-subtitle">Use your account credentials to continue.</p>
        </div>

        <form className="auth-form" onSubmit={login}>
          <label htmlFor="login-username">Username</label>
          <input
            id="login-username"
            name="username"
            type="text"
            autoComplete="username"
            required
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />

          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />

          <button type="submit" className="auth-submit-btn">Sign In</button>
        </form>

        <p className="auth-switch">
          New here? <Link to="/auth/register">Create account</Link>
        </p>

        {message && <p className="auth-alert auth-alert-error">{message}</p>}
      </section>
    </main>
  );
};

export default LoginPage;
