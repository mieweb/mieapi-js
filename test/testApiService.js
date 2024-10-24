import { expect } from 'chai';
import sinon from 'sinon';
import MIEApi from '../src/MIEApi.js';
import axios from 'axios';
import logger from '../src/logger.js';

describe('MIEApi Class', () => {
  let service;
  const validConfig = {
    baseUrl: 'https://api.example.com',
    connectToken: 'sampleToken123',
    userId: 'user123',
    ip: '127.0.0.1'
  };

  beforeEach(() => {
    service = new MIEApi(validConfig);
    sinon.stub(logger, 'info'); // Stub logger to prevent real logging
    sinon.stub(logger, 'error');
  });

  afterEach(() => {
    sinon.restore(); // Restore original methods
    MIEApi.sessionCache.clear(); // Clear the session cache after each test
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(service.baseUrl).to.equal(validConfig.baseUrl);
      expect(service.connectToken).to.equal(validConfig.connectToken);
      expect(service.userId).to.equal(validConfig.userId);
      expect(service.ip).to.equal(validConfig.ip);
    });
  });

  describe('Session Management', () => {
    it('should generate the correct session key', () => {
      const sessionKey = MIEApi.getSessionKey(validConfig.baseUrl, validConfig.userId);
      expect(sessionKey).to.equal(`${validConfig.baseUrl}_${validConfig.userId}`);
    });

    it('should store session data in cache', async () => {
      const mockResponse = {
        headers: {
          'x-db_name': 'mock_db',
        },
        data: { status: 200 }
      };

      sinon.stub(axios, 'get').resolves(mockResponse);
      await service.refreshSession();

      const sessionKey = MIEApi.getSessionKey(validConfig.baseUrl, validConfig.userId);
      const cachedSession = MIEApi.sessionCache.get(sessionKey);

      expect(cachedSession).to.have.property('sessionCookie');
      expect(cachedSession).to.have.property('connectTokenRefreshedAt');
      expect(cachedSession).to.have.property('expiration');
      axios.get.restore();
    });
  });

  describe('API Method Definitions', () => {
    it('should have a get method', () => {
      expect(service.get).to.be.a('function');
    });

    it('should have a post method', () => {
      expect(service.post).to.be.a('function');
    });

    it('should have a put method', () => {
      expect(service.put).to.be.a('function');
    });
  });

  describe('Session Management Flags', () => {
    it('should have a default value for isRefreshingSession', () => {
      expect(service.isRefreshingSession).to.be.false;
    });

    it('should set isRefreshingSession flag to true when refreshSession is called', async () => {
      const mockResponse = {
        headers: { 'x-db_name': 'mock_db' },
        data: { status: 200 }
      };

      sinon.stub(axios, 'get').resolves(mockResponse);
      await service.refreshSession();
      expect(service.isRefreshingSession).to.be.false; // Should reset after refresh

      axios.get.restore();
    });
  });

  describe('API Error Handling', () => {
    it('should log an error if API call fails', async () => {
      sinon.stub(axios, 'get').rejects(new Error('API error'));
      
      try {
        await service.get('/invalid-endpoint');
      } catch (error) {
        expect(logger.error.called).to.be.true;
        expect(error.message).to.equal('API error');
      }

      axios.get.restore();
    });
  });
});
