import fetch from 'node-fetch';
import logger from './logger.js'; 
import { getApiConfig, endpoints} from './apiConfig.js'; // Configuration handler
import base64 from 'base-64';

class apiService {
  constructor() {
    this.baseUrl = getApiConfig('API_URL');
    this.username = getApiConfig('API_USERNAME');
    this.password = getApiConfig('API_PASSWORD');
    this.practice = getApiConfig('PRACTICE')
    this.cookie = null; 
  }

  // Initialize the session by getting a session cookie
  async initSession() {
    const loginData = new URLSearchParams({ login_user: this.username, login_passwd: this.password });

    try {
        const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: loginData.toString()
        });
      if (!response.ok) {
        throw new Error(`Session initialization failed: ${response.statusText}`);
      }

      this.cookie = response.headers.get('set-cookie'); // Store session cookie
      logger.info(`Session initialized successfully with value : ${this.cookie}` );
    } catch (error) {
      logger.error(`Failed to initialize session: ${error.message}`);
      throw error;
    }
  }

  // Generic request method
  async request(endpoint, optionalParam = null, body = null, method = 'GET') {

    if (!this.cookie) await this.initSession(); // Ensure session is initialized

    const apiEndpoint = this.getEndpoint(endpoint); // Fetch the API endpoint from config
    const url = `${this.baseUrl}/${base64.encode(`${method}/${apiEndpoint}/${optionalParam}`)}`;

    try {
        const response = await fetch(url, {
                      method,
                       headers: {
                         'Content-Type': 'application/json',
                         'cookie': `${this.cookie}`
                       },
                       body: body ? JSON.stringify(body) : null
                     });
      if (!response.ok) {
        logger.error(`API Error: ${response.message || 'Unknown error'}`);
        throw new Error(response.message || 'API request failed');
      }

      return await response.json();
    } catch (error) {
      logger.error(`Request failed: ${error.message}`);
      throw error;
    }
  }

  // API methods
  get(endpoint, optionalParam) {
    return this.request(endpoint, optionalParam, null, 'GET');
  }

  post(endpoint, optionalParam, data) {
    return this.request(endpoint, optionalParam, data, 'POST');
  }

  put(endpoint, optionalParam, data) {
    const jsonBody = Array.isArray(data) ? data : [data];
    return this.request(endpoint, optionalParam, jsonBody, 'PUT');
  }

  // Function to fetch the endpoint from the configured endpoints
  getEndpoint(endpoint) {
    const lowerCaseEndpoint = endpoint.toLowerCase();
    for (const key in endpoints) {
      if (key.toLowerCase() === lowerCaseEndpoint) {
        return endpoints[key];
      }
    }
    return null;
  }
}
// Exported a single instance for reuse
export default new apiService(); 
