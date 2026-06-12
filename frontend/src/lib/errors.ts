import { AxiosError } from 'axios';

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as { message?: string | string[] } | undefined;
    if (Array.isArray(data?.message)) {
      return data.message[0] ?? fallback;
    }
    if (typeof data?.message === 'string') {
      return data.message;
    }
  }
  return fallback;
}
