'use client';
import ReactDOM from 'react-dom';
import { API_BASE_URL } from '@/lib/api/client';

/**
 * Opens the connection to the API while the page is still loading, so the first request (the session
 * check, then any data) doesn't wait for DNS, TCP and TLS. The browser's API calls carry the login
 * cookies, so the connection is opened in credentialed mode to be reusable for them.
 */
export function PreconnectApi() {
  const origin = new URL(API_BASE_URL).origin;
  ReactDOM.preconnect(origin, { crossOrigin: 'use-credentials' });
  return null;
}
