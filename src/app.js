/*
  ztncui - ZeroTier network controller UI
  Copyright (C) 2017-2021  Key Networks (https://key-networks.com)
  Licensed under GPLv3 - see LICENSE for details.
*/

require('dotenv').config();

const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const expressValidator = require('express-validator');
const session = require('express-session');
const helmet = require('helmet');

const fs = require('fs');
const crypto = require('crypto');

const app = express();

// Secure persistent session secret
function getSessionSecret() {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim()) {
    return process.env.SESSION_SECRET.trim();
  }
  const secretPaths = [
    path.join(process.cwd(), 'etc', 'session.secret'),
    path.join(__dirname, 'etc', 'session.secret'),
    path.join(__dirname, '..', 'etc', 'session.secret')
  ];
  for (const p of secretPaths) {
    try {
      if (fs.existsSync(p)) {
        const s = fs.readFileSync(p, 'utf8').trim();
        if (s.length >= 32) return s;
      }
    } catch {}
  }

  const newSecret = crypto.randomBytes(32).toString('hex');
  for (const p of secretPaths) {
    try {
      const dir = path.dirname(p);
      if (fs.existsSync(dir)) {
        fs.writeFileSync(p, newSecret, { mode: 0o600, encoding: 'utf8' });
        break;
      }
    } catch {}
  }
  return newSecret;
}

const session_secret = getSessionSecret();

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
  resave: false,
  saveUninitialized: false,
  secret: session_secret,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: !!process.env.HTTPS_PORT
  }
}));
app.use(expressValidator());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// CSRF Defense: Origin & Referer verification for state-changing requests
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  // Allow login endpoint directly
  if (req.path === '/login' || req.path === '/api/v1/auth/login') {
    return next();
  }

  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return res.status(403).send('Forbidden: Cross-site request rejected.');
      }
    } catch {
      return res.status(403).send('Forbidden: Invalid Origin header.');
    }
  }
  next();
});

// RESTful API (v1)
const api = require('./routes/api');
app.use('/api/v1', api);

// Serve modern SPA
const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
} else {
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.status(503).send('Frontend SPA dist files not built. Please run `npm run build` in frontend directory.');
  });
}

// Error handler
app.use(function(err, req, res, next) {
  const status = err.status || 500;
  res.status(status);
  if (req.path.startsWith('/api/')) {
    return res.json({ error: err.message || 'Internal Server Error' });
  }
  res.type('html').send(`<!DOCTYPE html><html><head><title>Error</title></head><body style="font-family:sans-serif;padding:40px;text-align:center;"><h2>Error ${status}</h2><p>${err.message || 'An error occurred'}</p></body></html>`);
});

module.exports = app;
