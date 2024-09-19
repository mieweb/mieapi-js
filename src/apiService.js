import fetch from 'node-fetch';
import logger from './logger.js'; 
import base64 from 'base-64';
import { endpoints} from './apiConfig.js';

class apiService {
  // Static session cache to store session cookies and metadata
  static sessionCache = new Map();

  constructor({ baseUrl, username, password, practice }) {
    this.baseUrl = baseUrl;
    this.username = username;
    this.password = password;
    this.practice = practice;
    this.cookie = null;
    this.isRefreshingSession = false; // Flag to prevent simultaneous refresh calls

  }

  // Generate a unique cache key based on baseUrl and username
  static getSessionKey(baseUrl, username) {
    return `${baseUrl}_${username}`;
  }

  // Initialize session and update the cache
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
      logger.info(`Session initialized successfully with cookie: ${this.cookie}`);

      // Cache session and set expiration
      const sessionKey = apiService.getSessionKey(this.baseUrl, this.username);
      const expiration = new Date(new Date().getTime() + 5 * 60 * 1000); //session is valid for 5 minutes
      apiService.sessionCache.set(sessionKey, {
        cookie: this.cookie,
        refreshedAt: new Date(),
        expiration
      });

    } catch (error) {
      logger.error(`Failed to initialize session: ${error.message}`);
      throw error;
    }
  }

  // Refresh session and update the cache
  async refreshSession() {
    if (this.isRefreshingSession) return;
    this.isRefreshingSession = true;

    try {
      logger.info('Refreshing session for user:', this.username);
      await this.initSession(); // Re-initialize session by calling initSession

      logger.info(`Session refreshed successfully for user: ${this.username}`);
    } catch (error) {
      logger.error('Failed to refresh session:', error);
      throw error;
    } finally {
      this.isRefreshingSession = false;
    }
  }

  // Ensure a valid session exists (either from cache or by refreshing)
  async ensureSession() {
    const sessionKey = apiService.getSessionKey(this.baseUrl, this.username);
    const cachedSession = apiService.sessionCache.get(sessionKey);

    // Check if a valid session exists in the cache
    if (cachedSession && cachedSession.cookie) {
      const now = new Date();
      if (now < cachedSession.expiration) {
        logger.info(`Using cached session for user: ${this.username}`);
        this.cookie = cachedSession.cookie;
        return;
      } else {
        logger.info(`Cached session is expired for user: ${this.username}, refreshing...`);
        apiService.sessionCache.delete(sessionKey); // Invalidate expired session
      }
    }

    // No valid session found, refresh the session
    logger.info(`No valid cached session found for user: ${this.username}, initializing session...`);
    await this.refreshSession();
  }

  // Generic request method with session validation and retry logic
  async request(endpoint, optionalParam = null, body = null, method = 'GET') {
    await this.ensureSession(); // Ensure valid session before making the request

    const apiEndpoint = this.getEndpoint(endpoint);
    const url = `${this.baseUrl}/${base64.encode(`${method}/${apiEndpoint}/${optionalParam}`)}`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'cookie': this.cookie
        },
        body: body ? JSON.stringify(body) : null
      });

      if (!response.ok) {
        logger.error(`API Error: ${response.statusText || 'Unknown error'}`);
        throw new Error(response.statusText || 'API request failed');
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

  // Fetch the endpoint from the configured endpoints in apiconfig.js
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

// Exported the class so parameters can be passed during instantiation
export default apiService;
