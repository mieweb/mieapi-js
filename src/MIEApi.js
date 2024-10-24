import axios from 'axios';
import logger from './logger.js'; 
import { endpoints } from './apiConfig.js';

class MIEApi {
  static sessionCache = new Map();

  constructor({ baseUrl, connectToken, userId, ip }) {
    this.baseUrl = baseUrl;
    this.connectToken = connectToken;
    this.userId = userId;
    this.ip = ip;
    this.isRefreshingSession = false;
  }

  static getSessionKey(baseUrl, userId) {
    return `${baseUrl}_${userId}`;
  }

  async refreshSession() {
    if (this.isRefreshingSession) return;
    this.isRefreshingSession = true;

    try {
      const refreshUrl = `${this.baseUrl}?f=layoutnouser&name=BlueHive_Refresh_Session&user_id=${encodeURIComponent(this.userId)}&connectToken=${encodeURIComponent(this.connectToken)}&ip_address=${encodeURIComponent(this.ip)}&raw&json`;

      logger.info(`Refreshing connection to: ${refreshUrl}, 'for userId:', ${this.userId}`);

      const response = await axios.get(refreshUrl, {
        headers: {
          'User-Agent': 'BlueHive AI (Refresh Connection)',
        }
      });

      if (!response || response.data.status !== 200) {
        throw new Error(response?.data?.message || 'Error connecting to WebChart.');
      }

      const getCookieResponse = await axios.get(`${this.baseUrl}?f=wcrelease&json`, {
        headers: {
          'User-Agent': 'BlueHive AI (Get x-db_name)',
        }
      });

      const dbName = getCookieResponse.headers['x-db_name'];
      if (!dbName) throw new Error('DB name not found in response.');

      const sessionCookie = `${dbName}_session_id=${this.connectToken}`;

      const sessionKey = MIEApi.getSessionKey(this.baseUrl, this.userId);
      MIEApi.sessionCache.set(sessionKey, {
        sessionCookie,
        connectTokenRefreshedAt: new Date(),
        expiration: new Date(new Date().getTime() + 5 * 60 * 1000),
      });

      this.sessionCookie = sessionCookie;
      logger.info('Session refreshed for userId:', this.userId);
    } catch (error) {
      logger.error('Failed to refresh session:', error);
      throw error;
    } finally {
      this.isRefreshingSession = false;
    }
  }

  async ensureSession() {
    const sessionKey = MIEApi.getSessionKey(this.baseUrl, this.userId);
    const cachedSession = MIEApi.sessionCache.get(sessionKey);

    if (cachedSession && cachedSession.sessionCookie) {
      const now = new Date();
      const timeElapsed = now - new Date(cachedSession.connectTokenRefreshedAt);
      if (timeElapsed < 5 * 60 * 1000) {
        logger.info('Using cached session for userId:', this.userId);
        this.sessionCookie = cachedSession.sessionCookie;
        return;
      } else {
        logger.info('Cached session expired for userId:', this.userId);
        MIEApi.sessionCache.delete(sessionKey);
      }
    }

    logger.info('No valid session found, refreshing session for userId:', this.userId);
    await this.refreshSession();
  }

  async request(endpoint, params = {}, body = null, method = 'GET') {
    await this.ensureSession();

    const apiEndpoint = this.getEndpoint(endpoint) || endpoint;
    const queryString = params.filter+params.limit;
    const b64Endpoint = Buffer.from(`${method}/${apiEndpoint}/${queryString}`).toString('base64');
    const url = `${this.baseUrl}/json/${b64Endpoint}`;
    console.log(url);

    try {
      const response = await axios({
        method: method.toLowerCase(),
        url,
        headers: {
          'Content-Type': method === 'GET' ? 'application/x-www-form-urlencoded' : 'application/json',
          Cookie: this.sessionCookie
        },
        data: body
      });
      console.log(response);
      if (!response.data || (response.data.meta && response.data.meta.status !== '200')) {
        throw new Error(response.data?.meta?.message || 'API request failed');
      }

      return response.data;
    } catch (error) {
      logger.error(`${method} error:`, error);
      throw error;
    }
  }

  // Update API methods to handle params correctly
  get(endpoint, params) {
    return this.request(endpoint, params);
  }

  post(endpoint, params, data) {
    return this.request(endpoint, params, data, 'POST');
  }

  put(endpoint, params, data) {
    return this.request(endpoint, params, data, 'PUT');
  }

  getEndpoint(endpoint) {
    const apiEndpoint = endpoints[endpoint.toLowerCase()];
    return apiEndpoint || endpoint;
  }
}
  
export default MIEApi;
