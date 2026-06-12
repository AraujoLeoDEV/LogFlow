import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return config;
});

// TODO (Fase 1 - módulo auth): interceptor de resposta para renovar o access
// token via refresh token (cookie httpOnly) em caso de 401, e redirecionar
// para /login se o refresh também falhar.
api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error),
);
