export const SESSION_KEY = "ride_session";

export const getSession = () => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const saveSession = (session) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

export const clearSession = () => {
  localStorage.removeItem(SESSION_KEY);
};

export const getAuthHeaders = () => {
  const session = getSession();
  if (!session?.token) {
    return {};
  }
  return { Authorization: `Bearer ${session.token}` };
};
