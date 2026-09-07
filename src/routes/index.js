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
  } else {
    message = req.session.success;
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
const loginAttempts = new Map(); // ip -> { count, resetTime }

function loginRateLimiter(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 5;

  const record = loginAttempts.get(ip);
  if (record && now < record.resetTime && record.count >= maxAttempts) {
    const remainingMins = Math.ceil((record.resetTime - now) / 60000);
    req.session.error = `登录尝试过于频繁，IP 已被临时限制，请 ${remainingMins} 分钟后再试。`;
    return res.redirect('/login');
  }
  next();
}

function recordLoginFailure(ip) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  let record = loginAttempts.get(ip);
  if (!record || now > record.resetTime) {
    record = { count: 0, resetTime: now + windowMs };
  }
  record.count += 1;
  loginAttempts.set(ip, record);
}

function clearLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

router.post('/login', loginRateLimiter, async function(req, res) {
  const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  await authenticate(req.body.username, req.body.password, function(err, user) {
    if (user) {
      clearLoginAttempts(clientIp);
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
      recordLoginFailure(clientIp);
      req.session.error = 'Authentication failed, please check your username and password.';
      res.redirect('/login');
    }
  });
});
module.exports = router;
