/*
  ztncui - ZeroTier network controller UI
  Copyright (C) 2017-2021  Key Networks (https://key-networks.com)
  Licensed under GPLv3 - see LICENSE for details.
*/

const express = require('express');
const auth = require('../controllers/auth');
const authenticate = auth.authenticate;
const restrict = auth.restrict;
const router = express.Router();

/** Redirect logged user to controler page */
function guest_only(req, res, next) {
  if (req.session.user) {
    res.redirect('/controller');
  } else {
    next();
  }
}

/* GET home page. */
router.get('/', guest_only, function(req, res, next) {
  res.render('front_door', {title: 'ztncui'});
});

router.get('/logout', function(req, res) {
  req.session.destroy(function() {
    res.redirect('/');
  });
});

router.get('/login', guest_only, function(req, res) {
  let message = null;
  if (req.session.error) {
    if (req.session.error !== 'Access denied!') {
      message = req.session.error;
    }
    delete req.session.error; // Flash message: clear after display
  } else if (req.session.success) {
    message = req.session.success;
    delete req.session.success;
  }
  res.render('login', { title: 'Login', message: message });
});

/** Sanitize redirect parameter to prevent Open Redirect vulnerabilities */
function sanitizeRedirect(url) {
  if (!url || typeof url !== 'string') return '/controller';
  const trimmed = url.trim();
  // Must start with single '/' and not '//' to prevent protocol-relative redirects or backslashes
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('\\')) {
    return trimmed;
  }
  return '/controller';
}

// In-memory rate limiting to prevent brute-force attacks on login
const loginAttempts = new Map(); // key -> { count, resetTime }
const MAX_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes

function getClientIp(req) {
  if (req.headers['x-forwarded-for']) {
    return req.headers['x-forwarded-for'].split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function loginRateLimiter(req, res, next) {
  const ip = getClientIp(req);
  const username = (req.body.username || '').trim().toLowerCase();
  const now = Date.now();

  // Check IP lock
  const ipRecord = loginAttempts.get(`ip:${ip}`);
  if (ipRecord && now < ipRecord.resetTime && ipRecord.count >= MAX_ATTEMPTS) {
    const remainingMins = Math.ceil((ipRecord.resetTime - now) / 60000);
    console.warn(`[SECURITY] Blocked brute-force attempt from IP: ${ip} (Locked for ${remainingMins}m)`);
    req.session.error = `登录尝试过于频繁，该 IP [${ip}] 已被临时锁定，请 ${remainingMins} 分钟后再试。`;
    return res.status(429).redirect('/login');
  }

  // Check Username lock
  if (username) {
    const userRecord = loginAttempts.get(`user:${username}`);
    if (userRecord && now < userRecord.resetTime && userRecord.count >= MAX_ATTEMPTS) {
      const remainingMins = Math.ceil((userRecord.resetTime - now) / 60000);
      console.warn(`[SECURITY] Blocked brute-force attempt for user: ${username} (Locked for ${remainingMins}m)`);
      req.session.error = `账号 [${username}] 密码错误过多已被临时锁定，请 ${remainingMins} 分钟后再试。`;
      return res.status(429).redirect('/login');
    }
  }

  next();
}

function recordLoginFailure(req) {
  const ip = getClientIp(req);
  const username = (req.body.username || '').trim().toLowerCase();
  const now = Date.now();

  // Record IP failure
  let ipRecord = loginAttempts.get(`ip:${ip}`);
  if (!ipRecord || now > ipRecord.resetTime) {
    ipRecord = { count: 0, resetTime: now + LOCK_TIME_MS };
  }
  ipRecord.count += 1;
  loginAttempts.set(`ip:${ip}`, ipRecord);

  // Record User failure
  let userRecord = null;
  if (username) {
    userRecord = loginAttempts.get(`user:${username}`);
    if (!userRecord || now > userRecord.resetTime) {
      userRecord = { count: 0, resetTime: now + LOCK_TIME_MS };
    }
    userRecord.count += 1;
    loginAttempts.set(`user:${username}`, userRecord);
  }

  const currentCount = Math.max(ipRecord.count, userRecord ? userRecord.count : 0);
  console.warn(`[SECURITY] Failed login for user [${username || 'empty'}] from IP [${ip}], attempts: ${currentCount}/${MAX_ATTEMPTS}`);
  return currentCount;
}

function clearLoginAttempts(req) {
  const ip = getClientIp(req);
  const username = (req.body.username || '').trim().toLowerCase();
  loginAttempts.delete(`ip:${ip}`);
  if (username) loginAttempts.delete(`user:${username}`);
}

router.post('/login', loginRateLimiter, async function(req, res) {
  await authenticate(req.body.username, req.body.password, function(err, user) {
    if (user) {
      clearLoginAttempts(req);
      req.session.regenerate(function() {
        req.session.user = user;
        req.session.success = 'Authenticated as ' + user.name;
        if (user.pass_set) {
          res.redirect(sanitizeRedirect(req.query.redirect));
        } else {
          res.redirect('/users/' + user.name + '/password');
        }
      });
    } else {
      const failCount = recordLoginFailure(req);
      const remaining = MAX_ATTEMPTS - failCount;
      if (remaining > 0) {
        req.session.error = `用户名或密码错误（已失败 ${failCount} 次，还剩 ${remaining} 次机会，超限将锁定 15 分钟）`;
      } else {
        req.session.error = `连续登录失败已达上限（5 次），已被安全锁定 15 分钟，拒绝继续尝试！`;
      }
      res.redirect('/login');
    }
  });
});
module.exports = router;
