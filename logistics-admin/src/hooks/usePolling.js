import { useState, useEffect, useCallback } from "react";

/**
 * Custom hook for polling data at an interval (simulates real-time updates).
 * 
 * @param {Function} fetchFn - async function that returns the data
 * @param {number} intervalMs - polling interval in milliseconds (default 3000)
 * @returns {{ data, loading, error, refresh }}
 */
export const usePolling = (fetchFn, intervalMs = 3000) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const refresh = useCallback(async () => {
        try {
            const result = await fetchFn();
            setData(result);
            setError(null);
        } catch (err) {
            setError(err.message || "Failed to fetch data");
        } finally {
            setLoading(false);
        }
    }, [fetchFn]);

    useEffect(() => {
        refresh();
        const timer = setInterval(refresh, intervalMs);
        return () => clearInterval(timer);
    }, [refresh, intervalMs]);

    return { data, loading, error, refresh };
};
