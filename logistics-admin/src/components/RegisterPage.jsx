import React, { useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import "../styles/auth-pages.css";

const API = "http://localhost:8080/api";

const readError = (error, fallback) => (
  error?.response?.data?.message
  || error?.response?.data?.error
  || error?.message
  || fallback
);

const RegisterPage = () => {
  const [form, setForm] = useState({
    username: "",
    password: "",
    fullName: "",
    role: "CUSTOMER",
  });
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const register = async (event) => {
    event.preventDefault();
    try {
      await axios.post(`${API}/auth/register`, form);
      setMessage("Registration successful. Continue to Sign In.");
      setIsSuccess(true);
    } catch (error) {
      setMessage(readError(error, "Registration failed"));
      setIsSuccess(false);
    }
  };

  return (
    <main className="auth-shell auth-register-theme">
      <section className="auth-showcase" aria-label="Platform capabilities">
        <p className="auth-eyebrow">Operations Workspace</p>
        <h1 className="auth-showcase-title">Create your secure fleet account</h1>
        <p className="auth-showcase-copy">
          Join the logistics command center to manage drivers, monitor routes, and resolve issues quickly.
        </p>

        <div className="auth-feature-grid">
          <article className="auth-feature-card">
            <h2>Real-Time Dashboard</h2>
            <p>Monitor active rides, statuses, and route anomalies in one place.</p>
          </article>
          <article className="auth-feature-card">
            <h2>Analytics Insights</h2>
            <p>View trend data to improve safety, efficiency, and delivery accuracy.</p>
          </article>
          <article className="auth-feature-card">
            <h2>Role Profiles</h2>
            <p>Assign customer, driver, or admin access using clear permission rules.</p>
          </article>
        </div>
      </section>

      <section className="auth-panel" aria-label="Create account form">
        <div className="auth-panel-header">
          <p className="auth-kicker">Account setup</p>
          <h2>Register</h2>
          <p className="auth-subtitle">Fill in your details to get started.</p>
        </div>

        <form className="auth-form" onSubmit={register}>
          <label htmlFor="register-fullName">Full Name</label>
          <input
            id="register-fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            required
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />

          <label htmlFor="register-username">Username</label>
          <input
            id="register-username"
            name="username"
            type="text"
            autoComplete="username"
            required
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />

          <label htmlFor="register-password">Password</label>
          <input
            id="register-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />

          <label htmlFor="register-role">Role</label>
          <select
            id="register-role"
            name="role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="CUSTOMER">CUSTOMER</option>
            <option value="DRIVER">DRIVER</option>
            <option value="ADMIN">ADMIN</option>
          </select>

          <button type="submit" className="auth-submit-btn">Create Account</button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/auth/login">Sign in</Link>
        </p>

        {message && (
          <p className={`auth-alert ${isSuccess ? "auth-alert-success" : "auth-alert-error"}`}>
            {message}
          </p>
        )}
      </section>
    </main>
  );
};

export default RegisterPage;
