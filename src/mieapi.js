import axios from 'axios';

export class MIEApi {
    // Static session cache map to store session tokens globally
    static sessionCache = new Map();

    constructor({ baseUrl, connectToken, userId, ip }) {
        this.baseUrl = baseUrl;
        this.connectToken = connectToken;
        this.userId = userId;
        this.ip = ip;
        this.isRefreshingSession = false; // A flag to handle simultaneous refresh requests
    }

    // Helper to create a unique cache key using baseUrl and userId
    static getSessionKey(baseUrl, userId) {
        return `${baseUrl}_${userId}`;
    }

    // Refresh session and update the cache
    async refreshSession() {
        // Prevent multiple simultaneous refresh calls by using a flag
        if (this.isRefreshingSession) return;
        this.isRefreshingSession = true;

        try {
            const refreshUrl = `${this.baseUrl}?f=layoutnouser&name=BlueHive_Refresh_Session&user_id=${encodeURIComponent(this.userId)}&connectToken=${encodeURIComponent(this.connectToken)}&ip_address=${encodeURIComponent(this.ip)}&raw&json`;

            console.log('Refreshing connection to:', refreshUrl, 'for userId', this.userId);

            const response = await axios({
                method: 'get',
                url: refreshUrl,
                responseType: 'json',
                headers: {
                    'User-Agent': 'BlueHive AI (Refresh Connection)',
                }
            });

            if (!response) {
                throw new Error('Error connecting to WebChart.');
            }

            if (!response.data || response.data.status !== 200) {
                throw new Error(response.data.message || 'Error connecting to WebChart.');
            }

            console.log('We got a response for refreshing the session!:', response.data);

            const getCookieResponse = await axios({
                method: 'get',
                url: `${this.baseUrl}?f=wcrelease&json`,
                responseType: 'json',
                headers: {
                    'User-Agent': 'BlueHive AI (Get x-db_name)',
                }
            });

            if (!getCookieResponse) {
                console.error('Error getting session cookie.');
                throw new Error('Error getting session cookie.');
            }

            const dbName = getCookieResponse.headers['x-db_name'];

            if (!dbName) {
                console.error('db name not found in response.');
                throw new Error('db name not found in response.');
            }

            const sessionCookie = `${dbName}_session_id=${this.connectToken}`;

            // Cache the session and timestamp for the given baseUrl and userId
            const sessionKey = MIEApi.getSessionKey(this.baseUrl, this.userId);
            MIEApi.sessionCache.set(sessionKey, {
                sessionCookie,
                connectTokenRefreshedAt: new Date(),
                expiration: new Date(new Date().getTime() + 5 * 60 * 1000) // Assuming 5 minutes validity
            });

            this.sessionCookie = sessionCookie;

            console.log('Session refreshed for userId', this.userId);

            return response.data;
        } catch (error) {
            console.error('Failed to refresh session:', error);
            throw error;
        } finally {
            this.isRefreshingSession = false; // Release the lock after refreshing
        }
    }

    // Ensure a valid session exists, either from cache or by refreshing it
    async ensureSession() {
        const sessionKey = MIEApi.getSessionKey(this.baseUrl, this.userId);
        const cachedSession = MIEApi.sessionCache.get(sessionKey);

        // Check if a valid session exists in the cache
        if (cachedSession && cachedSession.sessionCookie) {
            const timeElapsed = new Date() - new Date(cachedSession.connectTokenRefreshedAt);
            if (timeElapsed < 5 * 60 * 1000) { // Less than 5 minutes
                console.log('Using cached session for userId', this.userId);
                this.sessionCookie = cachedSession.sessionCookie;
                return;
            } else {
                console.log('Cached session is too old for userId', this.userId, 'refreshing...');
                // Invalidate the session if it is too old
                MIEApi.sessionCache.delete(sessionKey);
            }
        }

        console.log('no valid cached session found for userId', this.userId, 'refreshing...');

        // If no valid cached session, refresh session
        await this.refreshSession();
    }

    // Helper function to handle PUT requests with retries on failure
    async put(endpoint, data) {
        try {
            // Ensure a valid session before making the request
            await this.ensureSession();
            return await this._makePutRequest(endpoint, data);
        } catch (error) {
            // Retry by refreshing the session if the first attempt fails
            console.error('First PUT attempt failed, refreshing session...', error);
            await this.refreshSession();
            return await this._makePutRequest(endpoint, data);
        }
    }

    // Internal method to handle the actual PUT request
    async _makePutRequest(endpoint, data) {
        const b64Endpoint = Buffer.from('PUT/' + endpoint).toString('base64');
        const url = `${this.baseUrl}/json/${b64Endpoint}`;

        console.log('PUT', url, data);

        try {
            const response = await axios.post(url, data, {
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: this.sessionCookie
                }
            });

            return response.data;
        } catch (error) {
            console.error('PUT error', error);
            throw error;
        }
    }

    // Helper function to handle GET requests with retries on failure
    async get(endpoint, params) {
        try {
            // Ensure a valid session before making the request
            await this.ensureSession();
            return await this._makeGetRequest(endpoint, params);
        } catch (error) {
            // Retry by refreshing the session if the first attempt fails
            console.error('First GET attempt failed, refreshing session...', error);
            await this.refreshSession();
            return await this._makeGetRequest(endpoint, params);
        }
    }

    // Internal method to handle the actual GET request
    async _makeGetRequest(endpoint, params) {
        const queryString = params && typeof params === 'object' ? new URLSearchParams(params).toString() : params;
        const b64Endpoint = Buffer.from(`GET/${endpoint}/${queryString}`).toString('base64');
        const url = `${this.baseUrl}/json/${b64Endpoint}`;

        console.log('GET', url);

        try {
            const response = await axios.get(url, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Cookie: this.sessionCookie
                }
            });
            return response.data;
        } catch (error) {
            console.error('GET error', error);
            throw error;
        }
    }

    /**
     * Fetches a layout via an AJAX call using the connectToken as the session cookie.
     * 
     * @param {Object} options - The layout parameters.
     * @param {string} options.module - The module name.
     * @param {string} options.name - The layout name.
     * @param {Object} [options.params={}] - Additional CGI parameters to include in the request (excluding `raw` and `json`).
     * @param {boolean} [options.raw=true] - Whether to include the `&raw` parameter (default is true).
     * @param {boolean} [options.json=true] - Whether to include the `&json` parameter (default is true).
     * @returns {Promise<Object>} The response data from the API.
     */
    async fetchLayout({ module, name, params = {}, raw = true, json = true }) {
        try {
            // Ensure a valid session before making the request
            await this.ensureSession();

            // Prepare the base URL for the layout request
            let layoutUrl = `${this.baseUrl}?f=layout&module=${encodeURIComponent(module)}&name=${encodeURIComponent(name)}&user_id=${encodeURIComponent(this.userId)}&connectToken=${encodeURIComponent(this.connectToken)}`;

            // Add optional parameters
            Object.keys(params).forEach((key) => {
                layoutUrl += `&${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`;
            });

            // Append `raw` and `json` as default parameters unless explicitly disabled
            if (raw) {
                layoutUrl += '&raw';
            }
            if (json) {
                layoutUrl += '&json';
            }

            console.log('Fetching layout from:', layoutUrl, 'using session cookie:', this.sessionCookie);

            // Make the GET request to fetch the layout
            const response = await axios.get(layoutUrl, {
                headers: {
                    Cookie: this.sessionCookie
                }
            });

            return response.data;
        } catch (error) {
            console.error('Error fetching layout:', error);
            throw error;
        }
    }
}
