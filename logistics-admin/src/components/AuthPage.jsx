import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/role-dashboards.css";
import { saveSession } from "../utils/session";
import { API_BASE_URL } from "../config";

const API = API_BASE_URL;

const msgFrom = (error, fallback) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.message ||
  fallback;

const AuthPage = () => {
  const navigate = useNavigate();
  const [registerForm, setRegisterForm] = useState({
    username: "",
    password: "",
    fullName: "",
    role: "CUSTOMER",
  });
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [message, setMessage] = useState("");

  const register = async () => {
    try {
      await axios.post(`${API}/auth/register`, registerForm);
      setMessage("Registration successful. Now login.");
    } catch (error) {
      setMessage(msgFrom(error, "Registration failed"));
    }
  };

  const login = async () => {
    try {
      const res = await axios.post(`${API}/auth/login`, loginForm);
      saveSession(res.data);
      setMessage("Login successful");
      if (res.data.role === "CUSTOMER") navigate("/customer/dashboard");
      else if (res.data.role === "DRIVER") navigate("/driver/dashboard");
      else navigate("/admin/rides");
    } catch (error) {
      setMessage(msgFrom(error, "Login failed"));
    }
  };

  return (
    <div className="role-page">
      <h1>Fleet Auth</h1>
      <div className="role-grid">
        <section className="role-card">
          <h3>Register</h3>
          <input placeholder="Username" value={registerForm.username} onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })} />
          <input placeholder="Full Name" value={registerForm.fullName} onChange={(e) => setRegisterForm({ ...registerForm, fullName: e.target.value })} />
          <input type="password" placeholder="Password" value={registerForm.password} onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })} />
          <select value={registerForm.role} onChange={(e) => setRegisterForm({ ...registerForm, role: e.target.value })}>
            <option value="CUSTOMER">CUSTOMER</option>
            <option value="DRIVER">DRIVER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          <button onClick={register}>Create Account</button>
        </section>

        <section className="role-card">
          <h3>Login</h3>
          <input placeholder="Username" value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} />
          <input type="password" placeholder="Password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} />
          <button onClick={login}>Sign In</button>
        </section>
      </div>

      {message && <div className="role-message">{message}</div>}
    </div>
  );
};

export default AuthPage;
