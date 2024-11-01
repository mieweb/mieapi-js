import axios from 'axios';
import logger from './logger.js';
import { endpoints } from './apiConfig.js';
import packageJson from "../package.json"  assert { type: "json" };


const version = packageJson.version;
class MIEApi {
  static sessionCache = new Map();

  constructor({ baseUrl, connectToken, userId, ip }) {
    this.baseUrl = baseUrl;
    this.connectToken = connectToken;
    this.userId = userId;
    this.ip = ip;
    this.isRefreshingSession = false;
    logger.info(`MIEApi instance created for userId: ${this.userId}`, { baseUrl: this.baseUrl });
  }

  static getSessionKey(baseUrl, userId) {
    const sessionKey = `${baseUrl}_${userId}`;
    logger.debug(`Generated session key: ${sessionKey}`);
    return sessionKey;
  }

  async refreshSession() {
    if (this.isRefreshingSession) {
      logger.info(`Session refresh already in progress for userId: ${this.userId}`);
      return;
    }
    this.isRefreshingSession = true;
    logger.info(`Starting session refresh for userId: ${this.userId}`);

    try {
      const refreshUrl = `${this.baseUrl}?f=layoutnouser&name=BlueHive_Refresh_Session&user_id=${encodeURIComponent(this.userId)}&connectToken=${encodeURIComponent(this.connectToken)}&ip_address=${encodeURIComponent(this.ip)}&raw&json`;

      logger.debug(`Attempting to refresh session with URL: ${refreshUrl}`);
      const response = await axios.get(refreshUrl, {
        headers: {
          'User-Agent': `mieapi (Refresh Connection)/${version}`
        }
      });

      if (!response || response.data.status !== 200) {
        logger.warn(`Session refresh failed with status: ${response?.data?.status || 'unknown'}`);
        throw new Error(response?.data?.message || 'Error connecting to WebChart.');
      }

      const getCookieResponse = await axios.get(`${this.baseUrl}?f=wcrelease&json`, {
        headers: {
          'User-Agent': `mieapi (Get x-db_name)/${version}`,
        }
      });

      const dbName = getCookieResponse.headers['x-db_name'];
      if (!dbName) {
        logger.error('Failed to retrieve DB name from response headers');
        throw new Error('DB name not found in response.');
      }

      const sessionCookie = `${dbName}_session_id=${this.connectToken}`;
      const sessionKey = MIEApi.getSessionKey(this.baseUrl, this.userId);

      MIEApi.sessionCache.set(sessionKey, {
        sessionCookie,
        connectTokenRefreshedAt: new Date(),
        expiration: new Date(Date.now() + 5 * 60 * 1000),
      });

      this.sessionCookie = sessionCookie;
      logger.info(`Session successfully refreshed for userId: ${this.userId}`);
    } catch (error) {
      logger.error(`Error during session refresh for userId: ${this.userId}:`, { error });
      throw error;
    } finally {
      this.isRefreshingSession = false;
      logger.info(`Session refresh completed for userId: ${this.userId}`);
    }
  }

  async ensureSession() {
    const sessionKey = MIEApi.getSessionKey(this.baseUrl, this.userId);
    const cachedSession = MIEApi.sessionCache.get(sessionKey);

    if (cachedSession && cachedSession.sessionCookie) {
      const now = Date.now();
      const timeElapsed = now - new Date(cachedSession.connectTokenRefreshedAt).getTime();
      if (timeElapsed < 5 * 60 * 1000) {
        logger.info(`Using valid cached session for userId: ${this.userId}`);
        this.sessionCookie = cachedSession.sessionCookie;
        return;
      } else {
        logger.info(`Cached session expired for userId: ${this.userId}, refreshing`);
        MIEApi.sessionCache.delete(sessionKey);
      }
    } else {
      logger.info(`No cached session available for userId: ${this.userId}, creating a new one`);
    }

    await this.refreshSession();
  }

  async request(endpoint, params = {}, body = null, method = 'GET') {
    logger.info(`Initiating ${method} request to endpoint: ${endpoint}`, { userId: this.userId, params });

    await this.ensureSession();
    const apiEndpoint = this.getEndpoint(endpoint) || endpoint;
    const queryString = params.filter + params.limit;
    const b64Endpoint = Buffer.from(`${method}/${apiEndpoint}/${queryString}`).toString('base64');
    const url = `${this.baseUrl}/json/${b64Endpoint}`;

    try {
      const response = await axios({
        method: method.toLowerCase(),
        url,
        headers: {
          'Content-Type': method === 'GET' ? 'application/x-www-form-urlencoded' : 'application/json',
          Cookie: this.sessionCookie,
        },
        data: body,
      });

      if (!response.data || (response.data.meta && response.data.meta.status !== '200')) {
        logger.warn(`Request failed at endpoint: ${endpoint}, Status: ${response.data?.meta?.status}`);
        throw new Error(response.data?.meta?.message || 'API request failed');
      }

      logger.info(`Request successful for endpoint: ${endpoint}`, { userId: this.userId, status: response.data.meta.status });
      return response.data;
    } catch (error) {
      logger.error(`Error in ${method} request to endpoint: ${endpoint} for userId: ${this.userId}`, { error });
      throw error;
    }
  }

  get(endpoint, params) {
    logger.info(`GET request to endpoint: ${endpoint}`, { userId: this.userId });
    return this.request(endpoint, params);
  }

  post(endpoint, params, data) {
    logger.info(`POST request to endpoint: ${endpoint}`, { userId: this.userId });
    return this.request(endpoint, params, data, 'POST');
  }

  put(endpoint, params, data) {
    logger.info(`PUT request to endpoint: ${endpoint}`, { userId: this.userId });
    return this.request(endpoint, params, data, 'PUT');
  }

  getEndpoint(endpoint) {
    const apiEndpoint = endpoints[endpoint.toLowerCase()];
    logger.debug(`Resolved endpoint: ${endpoint} to ${apiEndpoint}`);
    return apiEndpoint || endpoint;
  }
}

export default MIEApi;
