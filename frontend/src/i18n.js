import { ref, computed } from 'vue';
import zhCN from './locales/zh-CN';
import enUS from './locales/en-US';

const messages = {
  'zh-CN': zhCN,
  'en-US': enUS
};

function getInitialLang() {
  const saved = localStorage.getItem('ztncui_lang');
  if (saved && messages[saved]) return saved;
  const navLang = navigator.language || navigator.userLanguage || '';
  if (navLang.startsWith('zh')) return 'zh-CN';
  return 'en-US';
}

export const currentLang = ref(getInitialLang());

export function setLanguage(lang) {
  if (messages[lang]) {
    currentLang.value = lang;
    localStorage.setItem('ztncui_lang', lang);
    document.documentElement.lang = lang.startsWith('zh') ? 'zh-CN' : 'en';
  }
}

export function t(path, params) {
  const keys = path.split('.');
  let current = messages[currentLang.value] || messages['en-US'];
  for (const k of keys) {
    if (current && current[k] !== undefined) {
      current = current[k];
    } else {
      // Fallback to English
      let fallback = messages['en-US'];
      for (const fk of keys) {
        if (fallback && fallback[fk] !== undefined) {
          fallback = fallback[fk];
        } else {
          return path;
        }
      }
      current = fallback;
      break;
    }
  }
  if (typeof current === 'string' && params && typeof params === 'object') {
    return current.replace(/\{(\w+)\}/g, (match, p1) => {
      return params[p1] !== undefined ? params[p1] : match;
    });
  }
  return current;
}
