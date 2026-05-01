import request from 'supertest';
import app from '../server.js';

describe('URL Shortener API', () => {
  describe('POST /shorten', () => {
    test('valid url returns 200 with 6-char code', async () => {
      const response = await request(app)
        .post('/shorten')
        .send({ url: 'https://example.com' });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('code');
      expect(response.body.code).toHaveLength(6);
    });

    test('empty body returns 400', async () => {
      const response = await request(app)
        .post('/shorten')
        .send({});
      
      expect(response.status).toBe(400);
    });

    test('invalid url string returns 400', async () => {
      const response = await request(app)
        .post('/shorten')
        .send({ url: 'not-a-valid-url' });
      
      expect(response.status).toBe(400);
    });
  });

  describe('GET /:code', () => {
    test('unknown code returns 404', async () => {
      const response = await request(app)
        .get('/unknowncode123');
      
      expect(response.status).toBe(404);
    });

    test('valid code returns 302 with location header', async () => {
      const originalUrl = 'https://example.com/test';
      
      const shortenResponse = await request(app)
        .post('/shorten')
        .send({ url: originalUrl });
      
      const code = shortenResponse.body.code;
      
      const response = await request(app)
        .get(`/${code}`);
      
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(originalUrl);
    });
  });
});
