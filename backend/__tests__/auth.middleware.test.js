import { jest } from '@jest/globals';
import {
  authenticateToken,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../src/middleware/auth.js';

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('authenticateToken', () => {
  it('returns 401 when no token provided', async () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();
    await authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 for an invalid token', async () => {
    const req = { headers: { authorization: 'Bearer not-a-real-token' } };
    const res = mockRes();
    const next = jest.fn();
    await authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when a refresh token is used as an access token', async () => {
    const token = generateRefreshToken('user-id', null);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();
    await authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token type' });
  });

  it('calls next and sets req.user for a valid access token', async () => {
    const token = generateAccessToken('user-123', 'test@example.com');
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();
    await authenticateToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ userId: 'user-123', email: 'test@example.com' });
  });
});

describe('token helpers', () => {
  it('generateAccessToken produces a JWT', () => {
    const token = generateAccessToken('user-123', 'test@example.com');
    expect(token.split('.')).toHaveLength(3);
  });

  it('generateRefreshToken produces a JWT', () => {
    const token = generateRefreshToken('user-123', 'device-1');
    expect(token.split('.')).toHaveLength(3);
  });

  it('verifyRefreshToken succeeds for a valid refresh token', () => {
    const token = generateRefreshToken('user-123', 'device-1');
    const decoded = verifyRefreshToken(token);
    expect(decoded.userId).toBe('user-123');
    expect(decoded.type).toBe('refresh');
  });

  it('verifyRefreshToken throws when given an access token', () => {
    const token = generateAccessToken('user-123', 'test@example.com');
    expect(() => verifyRefreshToken(token)).toThrow();
  });
});
