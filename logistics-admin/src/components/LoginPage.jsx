import React, { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { saveSession } from "../utils/session";
import "../styles/role-dashboards.css";

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

  const login = async () => {
    try {
      const res = await axios.post(`${API}/auth/login`, form);
      saveSession(res.data);
      if (res.data.role === "CUSTOMER") navigate("/customer/dashboard");
      else if (res.data.role === "DRIVER") navigate("/driver/dashboard");
      else navigate("/admin/rides");
    } catch (error) {
      setMessage(readError(error, "Sign in failed"));
    }
  };

  return (
    <div className="auth-page auth-login-bg">
      <div className="auth-card">
        <p className="auth-kicker">Welcome Back</p>
        <h1>Sign In</h1>
        <p className="auth-subtitle">Track rides, package status, and live operations.</p>

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
        <button onClick={login}>Sign In</button>

        <div className="auth-switch">
          New here? <Link to="/auth/register">Create account</Link>
        </div>

        {message && <div className="role-message">{message}</div>}
      </div>
    </div>
  );
};

export default LoginPage;
