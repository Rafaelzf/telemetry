import { init } from 'web-monitoring-sdk';

// Deliberately hardcoded, not env-overridable: this demo always reports to the
// one deployed backend, so events from every environment land in the same
// place instead of scattering across whatever endpoint each machine happens
// to have configured.
export const API_BASE = 'https://telemetry-back.onrender.com';
export const APP_ID = 'telemetry-demo-front';

init({
  endpoint: `${API_BASE}/api/v1/telemetry`,
  appId: APP_ID,
  environment: import.meta.env.MODE === 'production' ? 'production' : 'development',
  release: '0.1.0'
});
