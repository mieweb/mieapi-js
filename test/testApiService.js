import { expect } from 'chai';
import sinon from 'sinon';
import apiService from '../src/apiService.js';
import logger from '../src/logger.js';

describe('apiService Class', () => {
  let service;
  const validConfig = {
    baseUrl: 'https://api.example.com',
    username: 'user123',
    password: 'password123',
    practice: 'examplePractice'
  };

  beforeEach(() => {
    service = new apiService(validConfig);
    sinon.stub(logger, 'info'); // Stub the logger methods to prevent actual logging
    sinon.stub(logger, 'error');
  });

  afterEach(() => {
    sinon.restore(); // Restore original methods
    apiService.sessionCache.clear(); // Clear the session cache after each test
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(service.baseUrl).to.equal(validConfig.baseUrl);
      expect(service.username).to.equal(validConfig.username);
      expect(service.password).to.equal(validConfig.password);
      expect(service.practice).to.equal(validConfig.practice);
    });
  });

  describe('Session Caching', () => {
    it('should generate the correct session key', () => {
      const sessionKey = apiService.getSessionKey(validConfig.baseUrl, validConfig.username);
      expect(sessionKey).to.equal(`${validConfig.baseUrl}_${validConfig.username}`);
    });

    it('should store session data in cache', () => {
      const sessionKey = apiService.getSessionKey(validConfig.baseUrl, validConfig.username);
      const mockSession = {
        cookie: 'mock_cookie',
        refreshedAt: new Date(),
        expiration: new Date(new Date().getTime() + 300000) // Valid for 5 minutes
      };

      apiService.sessionCache.set(sessionKey, mockSession);
      const cachedSession = apiService.sessionCache.get(sessionKey);

      expect(cachedSession).to.deep.equal(mockSession);
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
      sinon.stub(service, 'initSession').resolves(); // Stub initSession to prevent actual call
      service.isRefreshingSession = false;

      service.refreshSession();
      expect(service.isRefreshingSession).to.be.true;
    });
  });
});
