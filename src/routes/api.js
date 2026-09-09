/*
  ztncui - ZeroTier network controller UI
  Modern RESTful API (v1)
  Supports Single Page Application (SPA) architecture with 100% data compatibility.
*/

const express = require('express');
const router = express.Router();
const argon2 = require('argon2');
const storage = require('node-persist');
const ipaddr = require('ip-address');
const zt = require('../controllers/zt');
const auth = require('../controllers/auth');
const usersController = require('../controllers/usersController');

storage.initSync({ dir: 'etc/storage' });

// --- Security: Rate Limiting for Login ---
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 mins

function getClientIp(req) {
  if (req.headers['x-forwarded-for']) {
    return req.headers['x-forwarded-for'].split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function checkRateLimit(req) {
  const ip = getClientIp(req);
  const username = (req.body.username || '').trim().toLowerCase();
  const now = Date.now();

  const ipRecord = loginAttempts.get(`ip:${ip}`);
  if (ipRecord && now < ipRecord.resetTime && ipRecord.count >= MAX_ATTEMPTS) {
    const remainingMins = Math.ceil((ipRecord.resetTime - now) / 60000);
    return { locked: true, remainingMins, reason: `IP [${ip}] 尝试过多已锁定` };
  }

  if (username) {
    const userRecord = loginAttempts.get(`user:${username}`);
    if (userRecord && now < userRecord.resetTime && userRecord.count >= MAX_ATTEMPTS) {
      const remainingMins = Math.ceil((userRecord.resetTime - now) / 60000);
      return { locked: true, remainingMins, reason: `账号 [${username}] 密码错误过多已锁定` };
    }
  }

  return { locked: false };
}

function recordFailure(req) {
  const ip = getClientIp(req);
  const username = (req.body.username || '').trim().toLowerCase();
  const now = Date.now();

  let ipRecord = loginAttempts.get(`ip:${ip}`);
  if (!ipRecord || now > ipRecord.resetTime) {
    ipRecord = { count: 0, resetTime: now + LOCK_TIME_MS };
  }
  ipRecord.count += 1;
  loginAttempts.set(`ip:${ip}`, ipRecord);

  let userRecord = null;
  if (username) {
    userRecord = loginAttempts.get(`user:${username}`);
    if (!userRecord || now > userRecord.resetTime) {
      userRecord = { count: 0, resetTime: now + LOCK_TIME_MS };
    }
    userRecord.count += 1;
    loginAttempts.set(`user:${username}`, userRecord);
  }

  return Math.max(ipRecord.count, userRecord ? userRecord.count : 0);
}

function clearAttempts(req) {
  const ip = getClientIp(req);
  const username = (req.body.username || '').trim().toLowerCase();
  loginAttempts.delete(`ip:${ip}`);
  if (username) loginAttempts.delete(`user:${username}`);
}

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// --- API Token Management ---
function getApiToken() {
  if (process.env.API_TOKEN && process.env.API_TOKEN.trim()) {
    return process.env.API_TOKEN.trim();
  }
  const tokenPaths = [
    path.join(process.cwd(), 'etc', 'api_token.secret'),
    path.join(__dirname, '..', 'etc', 'api_token.secret'),
    path.join(__dirname, '..', '..', 'etc', 'api_token.secret')
  ];
  for (const p of tokenPaths) {
    try {
      if (fs.existsSync(p)) {
        const s = fs.readFileSync(p, 'utf8').trim();
        if (s.length >= 16) return s;
      }
    } catch {}
  }

  const newToken = 'zt_' + crypto.randomBytes(24).toString('hex');
  saveApiToken(newToken);
  return newToken;
}

function saveApiToken(newToken) {
  const tokenPaths = [
    path.join(process.cwd(), 'etc', 'api_token.secret'),
    path.join(__dirname, '..', 'etc', 'api_token.secret'),
    path.join(__dirname, '..', '..', 'etc', 'api_token.secret')
  ];
  for (const p of tokenPaths) {
    try {
      const dir = path.dirname(p);
      if (fs.existsSync(dir)) {
        fs.writeFileSync(p, newToken, { mode: 0o600, encoding: 'utf8' });
        console.log(`[API] Saved permanent API Token in ${p}`);
        return true;
      }
    } catch {}
  }
  return false;
}

// --- API Master Switch Management (Default: Disabled for security) ---
function getApiEnabledPaths() {
  return [
    path.join(process.cwd(), 'etc', 'api_enabled.secret'),
    path.join(__dirname, '..', 'etc', 'api_enabled.secret'),
    path.join(__dirname, '..', '..', 'etc', 'api_enabled.secret')
  ];
}

function isApiEnabled() {
  if (process.env.API_ENABLED !== undefined) {
    return process.env.API_ENABLED === 'true' || process.env.API_ENABLED === '1';
  }
  for (const p of getApiEnabledPaths()) {
    try {
      if (fs.existsSync(p)) {
        const s = fs.readFileSync(p, 'utf8').trim();
        return s === '1' || s === 'true';
      }
    } catch {}
  }
  return false; // Security default: Disabled by default!
}

function saveApiEnabled(enabled) {
  for (const p of getApiEnabledPaths()) {
    try {
      const dir = path.dirname(p);
      if (fs.existsSync(dir)) {
        fs.writeFileSync(p, enabled ? '1' : '0', { mode: 0o600, encoding: 'utf8' });
        console.log(`[API] Saved API enabled state (${enabled}) in ${p}`);
        return true;
      }
    } catch {}
  }
  return false;
}

let API_TOKEN = getApiToken();
let API_ENABLED = isApiEnabled();

// --- Auth Middleware (Supports Session Cookie and Bearer API Token) ---
function requireAuth(req, res, next) {
  // 1. Check API Token header or query param
  const authHeader = req.headers['authorization'];
  const tokenHeader = req.headers['x-api-token'];
  let candidateToken = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    candidateToken = authHeader.substring(7).trim();
  } else if (tokenHeader) {
    candidateToken = tokenHeader.trim();
  } else if (req.query && req.query.token) {
    candidateToken = req.query.token.trim();
  }

  if (candidateToken && candidateToken === API_TOKEN) {
    if (!API_ENABLED) {
      return res.status(403).json({
        success: false,
        error: 'API 访问已被管理员关闭，请登录 Web 控制台在导航栏手动开启 (API access is disabled by admin)'
      });
    }
    req.isApiCaller = true;
    return next();
  }

  // 2. Check Session
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({ success: false, error: 'Unauthorized: Invalid session or API token' });
}

// ==========================================
// 1. Authentication & Session Endpoints
// ==========================================

router.post('/auth/login', async (req, res) => {
  const rateLimitStatus = checkRateLimit(req);
  if (rateLimitStatus.locked) {
    return res.status(429).json({
      success: false,
      error: `${rateLimitStatus.reason}，请 ${rateLimitStatus.remainingMins} 分钟后再试。`,
      locked: true,
      remainingMinutes: rateLimitStatus.remainingMins
    });
  }

  const username = (req.body.username || '').trim();
  const password = req.body.password || '';

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password required' });
  }

  auth.authenticate(username, password, (err, user) => {
    if (user) {
      clearAttempts(req);
      req.session.regenerate((regenErr) => {
        if (regenErr) return res.status(500).json({ success: false, error: 'Session regeneration error' });
        req.session.user = user;
        req.session.save((saveErr) => {
          if (saveErr) return res.status(500).json({ success: false, error: 'Session save error' });
          return res.json({
            success: true,
            user: {
              name: user.name,
              pass_set: user.pass_set
            }
          });
        });
      });
    } else {
      const failCount = recordFailure(req);
      const remaining = MAX_ATTEMPTS - failCount;
      if (remaining > 0) {
        return res.status(401).json({
          success: false,
          error: `用户名或密码错误，已失败 ${failCount} 次，还剩 ${remaining} 次机会。`,
          attemptsLeft: remaining
        });
      } else {
        return res.status(429).json({
          success: false,
          error: `密码错误已达 ${MAX_ATTEMPTS} 次上限，系统已临时封禁 15 分钟。`,
          locked: true,
          remainingMinutes: 15
        });
      }
    }
  });
});

router.post('/auth/logout', (req, res) => {
  if (req.session) {
    req.session.destroy(() => {
      res.json({ success: true, message: 'Logged out successfully' });
    });
  } else {
    res.json({ success: true });
  }
});

router.get('/auth/me', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({
      success: true,
      user: {
        name: req.session.user.name,
        pass_set: req.session.user.pass_set
      }
    });
  }
  return res.json({ success: true, user: null });
});

router.get('/auth/token', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ success: true, token: API_TOKEN, enabled: API_ENABLED });
  }
  return res.status(401).json({ success: false, error: 'Unauthorized' });
});

router.post('/auth/token/toggle', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  const enabled = !!req.body.enabled;
  API_ENABLED = enabled;
  saveApiEnabled(enabled);
  console.log(`[API] API access changed to ${enabled} by user ${req.session.user.name}`);
  return res.json({ success: true, enabled: API_ENABLED, token: API_TOKEN });
});

router.post('/auth/token/regenerate', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  const newToken = 'zt_' + crypto.randomBytes(24).toString('hex');
  saveApiToken(newToken);
  API_TOKEN = newToken;
  console.log(`[API] Regenerated API Token by user ${req.session.user.name}`);
  return res.json({ success: true, token: API_TOKEN, enabled: API_ENABLED });
});

// ==========================================
// 2. ZeroTier Controller Status & Peers
// ==========================================

router.get('/status', requireAuth, async (req, res) => {
  try {
    const status = await zt.get_zt_status();
    res.json({ success: true, status });
  } catch (err) {
    console.error('API /status error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/peers', requireAuth, async (req, res) => {
  try {
    const peers = await zt.peers();
    res.json({ success: true, peers });
  } catch (err) {
    console.error('API /peers error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 3. Network CRUD
// ==========================================

router.get('/networks', requireAuth, async (req, res) => {
  try {
    const networks = await zt.network_list();
    res.json({ success: true, networks });
  } catch (err) {
    console.error('API GET /networks error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/networks', requireAuth, async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) {
    return res.status(400).json({ success: false, error: 'Network name required' });
  }
  try {
    const network = await zt.network_create({ name });
    res.json({ success: true, network });
  } catch (err) {
    console.error('API POST /networks error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/networks/:nwid', requireAuth, async (req, res) => {
  try {
    const network = await zt.network_detail(req.params.nwid);
    if (!network || (!network.nwid && !network.id)) {
      return res.status(404).json({ success: false, error: `网络 ${req.params.nwid} 未找到或已被删除` });
    }
    network.nwid = network.nwid || network.id || req.params.nwid;
    network.routes = Array.isArray(network.routes) ? network.routes : [];
    network.ipAssignmentPools = Array.isArray(network.ipAssignmentPools) ? network.ipAssignmentPools : [];
    network.v4AssignMode = network.v4AssignMode || { zt: false };
    network.v6AssignMode = network.v6AssignMode || {};
    res.json({ success: true, network });
  } catch (err) {
    console.error(`API GET /networks/${req.params.nwid} error:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/networks/:nwid/name', requireAuth, async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ success: false, error: 'Network name required' });
  try {
    const result = await zt.network_object(req.params.nwid, { name });
    res.json({ success: true, network: result });
  } catch (err) {
    console.error(`API PUT /networks/${req.params.nwid}/name error:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/networks/:nwid/private', requireAuth, async (req, res) => {
  const isPrivate = req.body.private === true;
  try {
    const result = await zt.network_object(req.params.nwid, { private: isPrivate });
    res.json({ success: true, network: result });
  } catch (err) {
    console.error(`API PUT /networks/${req.params.nwid}/private error:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/networks/:nwid', requireAuth, async (req, res) => {
  try {
    const result = await zt.network_delete(req.params.nwid);
    res.json({ success: true, result });
  } catch (err) {
    console.error(`API DELETE /networks/${req.params.nwid} error:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 4. Network Configuration (Routes, Pools, DNS, Easy Setup)
// ==========================================

router.post('/networks/:nwid/easy', requireAuth, async (req, res) => {
  const { routes, ipAssignmentPools, v4AssignMode } = req.body;
  if (!Array.isArray(routes) || !Array.isArray(ipAssignmentPools)) {
    return res.status(400).json({ success: false, error: 'Invalid routes or pools array' });
  }
  try {
    const result = await zt.network_easy_setup(req.params.nwid, routes, ipAssignmentPools, v4AssignMode || { zt: true });
    res.json({ success: true, network: result });
  } catch (err) {
    console.error(`API POST /networks/${req.params.nwid}/easy error:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/networks/:nwid/routes', requireAuth, async (req, res) => {
  const { target, via } = req.body;
  if (!target) return res.status(400).json({ success: false, error: 'Route target required' });
  try {
    const route = { target: target.trim(), via: via ? via.trim() : null };
    const result = await zt.routes(req.params.nwid, route, 'add');
    res.json({ success: true, network: result });
  } catch (err) {
    console.error(`API POST /networks/${req.params.nwid}/routes error:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/networks/:nwid/routes', requireAuth, async (req, res) => {
  const { target } = req.body;
  if (!target) return res.status(400).json({ success: false, error: 'Route target required' });
  try {
    const route = { target: target.trim() };
    const result = await zt.routes(req.params.nwid, route, 'delete');
    res.json({ success: true, network: result });
  } catch (err) {
    console.error(`API DELETE /networks/${req.params.nwid}/routes error:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/networks/:nwid/pools', requireAuth, async (req, res) => {
  const { ipRangeStart, ipRangeEnd } = req.body;
  if (!ipRangeStart || !ipRangeEnd) {
    return res.status(400).json({ success: false, error: 'ipRangeStart and ipRangeEnd required' });
  }
  try {
    const pool = { ipRangeStart: ipRangeStart.trim(), ipRangeEnd: ipRangeEnd.trim() };
    const result = await zt.ipAssignmentPools(req.params.nwid, pool, 'add');
    res.json({ success: true, network: result });
  } catch (err) {
    console.error(`API POST /networks/${req.params.nwid}/pools error:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/networks/:nwid/pools', requireAuth, async (req, res) => {
  const { ipRangeStart, ipRangeEnd } = req.body;
  if (!ipRangeStart || !ipRangeEnd) {
    return res.status(400).json({ success: false, error: 'ipRangeStart and ipRangeEnd required' });
  }
  try {
    const pool = { ipRangeStart: ipRangeStart.trim(), ipRangeEnd: ipRangeEnd.trim() };
    const result = await zt.ipAssignmentPools(req.params.nwid, pool, 'delete');
    res.json({ success: true, network: result });
  } catch (err) {
    console.error(`API DELETE /networks/${req.params.nwid}/pools error:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/networks/:nwid/dns', requireAuth, async (req, res) => {
  const { domain, servers } = req.body;
  const dnsObj = {
    domain: (domain || '').trim(),
    servers: Array.isArray(servers) ? servers.map(s => s.trim()).filter(Boolean) : []
  };
  try {
    const result = await zt.network_object(req.params.nwid, { dns: dnsObj });
    res.json({ success: true, network: result });
  } catch (err) {
    console.error(`API POST /networks/${req.params.nwid}/dns error:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/networks/:nwid/assign-mode', requireAuth, async (req, res) => {
  const { v4AssignMode, v6AssignMode } = req.body;
  const updateObj = {};
  if (v4AssignMode) updateObj.v4AssignMode = v4AssignMode;
  if (v6AssignMode) updateObj.v6AssignMode = v6AssignMode;
  try {
    const result = await zt.network_object(req.params.nwid, updateObj);
    res.json({ success: true, network: result });
  } catch (err) {
    console.error(`API POST /networks/${req.params.nwid}/assign-mode error:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 5. Network Members Management
// ==========================================

function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(fallback), ms))
  ]);
}

async function pMap(items, mapper, concurrency = 10) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await mapper(items[i], i);
    }
  }
  const workers = [];
  for (let i = 0; i < Math.min(concurrency, items.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

const membersCache = new Map();
const MEMBERS_CACHE_TTL = 30000; // 30 seconds cache for rapid widget/browser queries

function invalidateMembersCache(nwid) {
  if (nwid) membersCache.delete(nwid);
}

router.get('/networks/:nwid/members', requireAuth, async (req, res) => {
  const nwid = req.params.nwid;
  const now = Date.now();
  const cached = membersCache.get(nwid);
  if (cached && now - cached.timestamp < MEMBERS_CACHE_TTL) {
    return res.json({ success: true, members: cached.members, zt_address: cached.zt_address, cached: true });
  }

  try {
    const [rawMembers, peersRaw, zt_address] = await Promise.all([
      withTimeout(zt.members(nwid).catch(() => ({})), 3000, {}),
      withTimeout(zt.peers().catch(() => []), 3000, []),
      withTimeout(zt.get_zt_address().catch(() => ''), 2000, '')
    ]);

    const peers = Array.isArray(peersRaw) ? peersRaw : [];
    let member_ids = rawMembers || {};

    if (Array.isArray(member_ids)) {
      let obj = {};
      for (let item of member_ids) {
        if (typeof item === 'object' && item !== null) {
          const key = Object.keys(item)[0];
          if (key) obj[key] = item[key];
        } else if (typeof item === 'string') {
          obj[item] = item;
        }
      }
      member_ids = obj;
    }

    const ids = (typeof member_ids === 'object' && member_ids !== null) ? Object.keys(member_ids) : [];

    // Load member details in controlled batches of 25 for high responsiveness
    const memberResults = await pMap(ids, async id => {
      try {
        const [member, name] = await Promise.all([
          withTimeout(zt.member_detail(nwid, id).catch(() => null), 2000, null),
          withTimeout(storage.getItem(id).catch(() => ''), 500, '')
        ]);
        if (!member) return null;
        member.id = id;
        member.address = member.address || id;
        member.name = name || '';
        member.peer = peers.find(x => x && x.address === member.address) || null;
        member.ipAssignments = Array.isArray(member.ipAssignments) ? member.ipAssignments : [];
        member.authorized = !!member.authorized;
        member.activeBridge = !!member.activeBridge;
        return member;
      } catch {
        return null;
      }
    }, 25);

    const members = memberResults.filter(Boolean);
    membersCache.set(nwid, { members, zt_address, timestamp: now });

    res.json({ success: true, members, zt_address });
  } catch (err) {
    console.error(`API GET /networks/${nwid}/members error:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/networks/:nwid/members/:id/auth', requireAuth, async (req, res) => {
  const { authorized } = req.body;
  invalidateMembersCache(req.params.nwid);
  try {
    const result = await zt.member_object(req.params.nwid, req.params.id, { authorized: !!authorized });
    res.json({ success: true, member: result });
  } catch (err) {
    console.error(`API PUT member auth error:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/networks/:nwid/members/:id/bridge', requireAuth, async (req, res) => {
  const { activeBridge } = req.body;
  invalidateMembersCache(req.params.nwid);
  try {
    const result = await zt.member_object(req.params.nwid, req.params.id, { activeBridge: !!activeBridge });
    res.json({ success: true, member: result });
  } catch (err) {
    console.error(`API PUT member bridge error:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/networks/:nwid/members/:id/name', requireAuth, async (req, res) => {
  const name = (req.body.name || '').trim();
  invalidateMembersCache(req.params.nwid);
  try {
    await storage.setItem(req.params.id, name);
    res.json({ success: true, id: req.params.id, name });
  } catch (err) {
    console.error(`API PUT member name error:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/networks/:nwid/members/:id/ips', requireAuth, async (req, res) => {
  const ipAddress = (req.body.ipAddress || '').trim();
  if (!ipAddress) return res.status(400).json({ success: false, error: 'ipAddress required' });
  invalidateMembersCache(req.params.nwid);
  try {
    const result = await zt.ipAssignmentAdd(req.params.nwid, req.params.id, { ipAddress });
    res.json({ success: true, result });
  } catch (err) {
    console.error(`API POST member ip error:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/networks/:nwid/members/:id/ips/:index', requireAuth, async (req, res) => {
  const index = parseInt(req.params.index, 10);
  if (isNaN(index)) return res.status(400).json({ success: false, error: 'Valid index required' });
  invalidateMembersCache(req.params.nwid);
  try {
    const result = await zt.ipAssignmentDelete(req.params.nwid, req.params.id, index);
    res.json({ success: true, result });
  } catch (err) {
    console.error(`API DELETE member ip error:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/networks/:nwid/members/:id', requireAuth, async (req, res) => {
  invalidateMembersCache(req.params.nwid);
  try {
    const result = await zt.member_delete(req.params.nwid, req.params.id);
    res.json({ success: true, result });
  } catch (err) {
    console.error(`API DELETE member error:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 6. User Management
// ==========================================

router.get('/users', requireAuth, async (req, res) => {
  try {
    const users = await usersController.get_users();
    const userList = Object.keys(users).map(name => ({
      name,
      pass_set: !!users[name].pass_set
    }));
    res.json({ success: true, users: userList });
  } catch (err) {
    console.error('API GET /users error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/users', requireAuth, async (req, res) => {
  const username = (req.body.username || '').trim();
  const password = req.body.password || '';

  if (!username) return res.status(400).json({ success: false, error: 'Username required' });
  if (password.length < 10) return res.status(400).json({ success: false, error: 'Password must be at least 10 characters' });

  try {
    const users = await usersController.get_users();
    if (users[username]) {
      return res.status(400).json({ success: false, error: `User "${username}" already exists` });
    }
    const hash = await argon2.hash(password);
    users[username] = { name: username, hash, pass_set: true };
    await usersController.update_users(users);
    res.json({ success: true, user: { name: username, pass_set: true } });
  } catch (err) {
    console.error('API POST /users error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/users/:name/password', requireAuth, async (req, res) => {
  const targetUser = req.params.name;
  const password = req.body.password || '';

  if (password.length < 10) {
    return res.status(400).json({ success: false, error: 'Password must be at least 10 characters' });
  }

  try {
    const users = await usersController.get_users();
    if (!users[targetUser]) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    users[targetUser].hash = await argon2.hash(password);
    users[targetUser].pass_set = true;
    await usersController.update_users(users);
    res.json({ success: true, message: `Password for ${targetUser} updated` });
  } catch (err) {
    console.error(`API PUT /users/${targetUser}/password error:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/users/:name', requireAuth, async (req, res) => {
  const targetUser = req.params.name;
  try {
    const users = await usersController.get_users();
    if (!users[targetUser]) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    if (Object.keys(users).length <= 1) {
      return res.status(400).json({ success: false, error: 'Cannot delete the last remaining user' });
    }
    delete users[targetUser];
    await usersController.update_users(users);

    // If self deleted, destroy session
    if (req.session && req.session.user && req.session.user.name === targetUser) {
      req.session.destroy(() => {
        res.json({ success: true, selfDeleted: true });
      });
    } else {
      res.json({ success: true });
    }
  } catch (err) {
    console.error(`API DELETE /users/${targetUser} error:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
