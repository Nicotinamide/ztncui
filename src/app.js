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

const index = require('./routes/index');
const fs = require('fs');
const crypto = require('crypto');
const users = require('./routes/users');
const zt_controller = require('./routes/zt_controller');

const app = express();

// Secure persistent session secret
function getSessionSecret() {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim()) {
    return process.env.SESSION_SECRET.trim();
  }
  const secretFile = path.join(__dirname, 'etc', 'session.secret');
  try {
    if (fs.existsSync(secretFile)) {
      const s = fs.readFileSync(secretFile, 'utf8').trim();
      if (s.length >= 32) return s;
    }
  } catch {}

  const newSecret = crypto.randomBytes(32).toString('hex');
  try {
    fs.writeFileSync(secretFile, newSecret, { mode: 0o600, encoding: 'utf8' });
  } catch {}
  return newSecret;
}

const session_secret = getSessionSecret();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(helmet());
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
app.use('/fonts', express.static(path.join(__dirname, 'node_modules/bootstrap/fonts')));
app.use('/bscss', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/css')));
app.use('/jqjs', express.static(path.join(__dirname, 'node_modules/jquery/dist')));
app.use('/bsjs', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/js')));

// CSRF Defense: Origin & Referer verification for state-changing requests
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  // Allow login endpoint directly
  if (req.path === '/login') {
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

app.use('/', index);
app.use('/users', users);
app.use('/controller', zt_controller);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = req.session.error;
  var msg = req.session.success;
  delete req.session.error;
  delete req.session.success;
  res.locals.message = '';
  if (err) res.locals.message = '<p class="msg error">' + err + '</p>';
  if (msg) res.locals.message = '<p class="msg success">' + msg + '</p>';
next();
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
