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
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    const slim = { ...session };
    delete slim.idProofImage;
    delete slim.profileImage;
    localStorage.setItem(SESSION_KEY, JSON.stringify(slim));
  }
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
