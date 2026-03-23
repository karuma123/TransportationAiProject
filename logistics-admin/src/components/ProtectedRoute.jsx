import React from "react";
import { Navigate } from "react-router-dom";
import { getSession } from "../utils/session";

const ProtectedRoute = ({ roles, children }) => {
  const session = getSession();
  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  if (roles && roles.length > 0 && !roles.includes(session.role)) {
    return <Navigate to="/auth" replace />;
  }

  return children;
};

export default ProtectedRoute;
