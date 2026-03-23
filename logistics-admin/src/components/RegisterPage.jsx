import React, { useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import "../styles/role-dashboards.css";

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

  const register = async () => {
    try {
      await axios.post(`${API}/auth/register`, form);
      setMessage("Registration successful. Continue to Sign In.");
    } catch (error) {
      setMessage(readError(error, "Registration failed"));
    }
  };

  return (
    <div className="auth-page auth-register-bg">
      <div className="auth-card">
        <p className="auth-kicker">Create Fleet Account</p>
        <h1>Register</h1>
        <p className="auth-subtitle">Create customer, driver, or admin profile.</p>

        <input
          placeholder="Full Name"
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
        />
        <input
          placeholder="Username"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
        />
        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
        >
          <option value="CUSTOMER">CUSTOMER</option>
          <option value="DRIVER">DRIVER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <button onClick={register}>Create Account</button>

        <div className="auth-switch">
          Already have an account? <Link to="/auth/login">Sign in</Link>
        </div>

        {message && <div className="role-message">{message}</div>}
      </div>
    </div>
  );
};

export default RegisterPage;
