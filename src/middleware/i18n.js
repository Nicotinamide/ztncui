const fs = require('fs');
const path = require('path');

const locales = {};
const supportedLangs = [
  { code: 'zh-CN', name: '简体中文' },
  { code: 'en-US', name: 'English' }
];

function loadLocales() {
  const possibleDirs = [
    path.join(__dirname, '..', 'locales'),
    path.join(__dirname, 'locales'),
    path.join(process.cwd(), 'locales'),
    path.join(process.cwd(), 'src', 'locales')
  ];

  let loaded = false;
  for (const dir of possibleDirs) {
    const zhPath = path.join(dir, 'zh-CN.json');
    const enPath = path.join(dir, 'en-US.json');
    if (fs.existsSync(zhPath) && fs.existsSync(enPath)) {
      try {
        locales['zh-CN'] = JSON.parse(fs.readFileSync(zhPath, 'utf8'));
        locales['en-US'] = JSON.parse(fs.readFileSync(enPath, 'utf8'));
        loaded = true;
        break;
      } catch (e) {
        console.error('[i18n] Error loading locale JSON:', e);
      }
    }
  }

  if (!loaded) {
    console.warn('[i18n] Could not find locales directory, falling back to empty dictionaries');
    locales['zh-CN'] = {};
    locales['en-US'] = {};
  }
}

loadLocales();

function getNestedValue(obj, keyPath) {
  if (!obj) return null;
  const parts = keyPath.split('.');
  let curr = obj;
  for (const part of parts) {
    if (curr && typeof curr === 'object' && part in curr) {
      curr = curr[part];
    } else {
      return null;
    }
  }
  return typeof curr === 'string' ? curr : null;
}

function translate(lang, key, params = {}) {
  const currentDict = locales[lang] || locales['zh-CN'] || {};
  const fallbackDict = locales['en-US'] || {};

  let text = getNestedValue(currentDict, key);
  if (!text) {
    text = getNestedValue(fallbackDict, key);
  }
  if (!text) {
    // Return the last key fragment if not found
    return key.split('.').pop();
  }

  // Replace {param} placeholders
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  return text;
}

function detectLanguage(req) {
  // 1. Explicit query param (e.g. ?lang=en-US or ?lang=zh-CN)
  if (req.query && req.query.lang) {
    const qLang = req.query.lang.toLowerCase();
    if (qLang.startsWith('en')) return 'en-US';
    if (qLang.startsWith('zh')) return 'zh-CN';
  }

  // 2. Cookie
  if (req.cookies && req.cookies.ztncui_lang) {
    const cLang = req.cookies.ztncui_lang;
    if (cLang === 'en-US' || cLang === 'zh-CN') return cLang;
  }

  // 3. Session
  if (req.session && req.session.lang) {
    const sLang = req.session.lang;
    if (sLang === 'en-US' || sLang === 'zh-CN') return sLang;
  }

  // 4. Accept-Language header (default to zh-CN if contains zh)
  const acceptLang = req.headers['accept-language'] || '';
  if (acceptLang.toLowerCase().includes('zh')) {
    return 'zh-CN';
  }

  // Default to English if non-Chinese browser
  return 'en-US';
}

function i18nMiddleware(req, res, next) {
  const lang = detectLanguage(req);

  // If query changed language, persist to session and cookie
  if (req.query && req.query.lang) {
    if (req.session) req.session.lang = lang;
    res.cookie('ztncui_lang', lang, { maxAge: 365 * 24 * 3600 * 1000, httpOnly: false });
  }

  req.lang = lang;
  req.t = (key, params) => translate(lang, key, params);

  // Expose to Pug template locals
  res.locals.t = req.t;
  res.locals.currentLang = lang;
  res.locals.supportedLangs = supportedLangs;

  next();
}

module.exports = {
  i18nMiddleware,
  translate,
  supportedLangs
};
