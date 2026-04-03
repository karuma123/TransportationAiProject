import axios from "axios";
import { API_DRIVERS_URL } from "../config";

const BASE_URL = API_DRIVERS_URL;

export const fetchDrivers = () =>
  axios.get(BASE_URL);

export const blockDriver = (driverId, reason) =>
  axios.post(`${BASE_URL}/block`, null, {
    params: { driverId, reason }
  });

export const unblockDriver = (driverId) =>
  axios.post(`${BASE_URL}/unblock`, null, {
    params: { driverId }
  });
