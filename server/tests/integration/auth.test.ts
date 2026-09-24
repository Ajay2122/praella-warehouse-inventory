import { client } from '../helpers/testClient';
import { unique } from '../helpers/fixtures';

describe('auth', () => {
  it('signs up a new org + admin user and returns tokens', async () => {
    const email = `${unique('signup')}@test.local`;
    const res = await client
      .post('/api/auth/signup')
      .send({ organizationName: unique('SignupOrg'), email, password: 'Passw0rd!' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('ADMIN');
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).toEqual(expect.any(String));
  });

  it('rejects signup with a duplicate email', async () => {
    const email = `${unique('dup')}@test.local`;
    await client.post('/api/auth/signup').send({ organizationName: unique('Org'), email, password: 'Passw0rd!' });

    const res = await client
      .post('/api/auth/signup')
      .send({ organizationName: unique('Org2'), email, password: 'Passw0rd!' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rejects login with a wrong password without revealing whether the user exists', async () => {
    const email = `${unique('login')}@test.local`;
    await client.post('/api/auth/signup').send({ organizationName: unique('Org'), email, password: 'Passw0rd!' });

    const wrongPassword = await client.post('/api/auth/login').send({ email, password: 'wrong-password' });
    const noSuchUser = await client.post('/api/auth/login').send({ email: 'nobody@test.local', password: 'x' });

    expect(wrongPassword.status).toBe(401);
    expect(noSuchUser.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(noSuchUser.body.error.message);
  });

  it('rejects /me without a token, and with a garbage token', async () => {
    const noToken = await client.get('/api/auth/me');
    const badToken = await client.get('/api/auth/me').set('Authorization', 'Bearer not-a-real-token');

    expect(noToken.status).toBe(401);
    expect(badToken.status).toBe(401);
  });

  it('accepts /me with a valid token', async () => {
    const email = `${unique('me')}@test.local`;
    const signup = await client
      .post('/api/auth/signup')
      .send({ organizationName: unique('Org'), email, password: 'Passw0rd!' });

    const res = await client.get('/api/auth/me').set('Authorization', `Bearer ${signup.body.data.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(email);
  });

  it('rotates refresh tokens and rejects reuse of an already-rotated one', async () => {
    const email = `${unique('refresh')}@test.local`;
    const signup = await client
      .post('/api/auth/signup')
      .send({ organizationName: unique('Org'), email, password: 'Passw0rd!' });
    const originalRefreshToken = signup.body.data.refreshToken;

    const first = await client.post('/api/auth/refresh').send({ refreshToken: originalRefreshToken });
    expect(first.status).toBe(200);
    expect(first.body.data.refreshToken).not.toBe(originalRefreshToken);

    const replay = await client.post('/api/auth/refresh').send({ refreshToken: originalRefreshToken });
    expect(replay.status).toBe(401);
  });
});
