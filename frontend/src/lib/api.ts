import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

let accessToken: string | null = null;
let onSessionExpired: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function setOnSessionExpired(callback: (() => void) | null) {
  onSessionExpired = callback;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return config;
});

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

let refreshPromise: Promise<string | null> | null = null;

function refreshAccessToken(): Promise<string | null> {
  refreshPromise ??= api
    .post<{ accessToken: string }>('/auth/refresh')
    .then((response) => {
      const token = response.data.accessToken;
      setAccessToken(token);
      return token;
    })
    .catch(() => {
      setAccessToken(null);
      return null;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

// Em caso de 401 (access token expirado), tenta renovar via /auth/refresh
// (cookie httpOnly) e repete a requisição original uma única vez.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      originalRequest.url !== '/auth/refresh' &&
      originalRequest.url !== '/auth/login'
    ) {
      originalRequest._retry = true;
      const token = await refreshAccessToken();

      if (token) {
        originalRequest.headers.set('Authorization', `Bearer ${token}`);
        return api(originalRequest);
      }

      onSessionExpired?.();
    }

    return Promise.reject(error);
  },
);
