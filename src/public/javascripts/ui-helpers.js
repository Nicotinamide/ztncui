/**
 * ztncui Modern UI Helpers
 */

(function () {
  'use strict';

  // Floating Toast Notification
  function showToast(message, type = 'success') {
    let toast = document.getElementById('zt-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'zt-toast';
      toast.className = 'zt-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = 'zt-toast zt-toast-show ' + (type === 'error' ? 'zt-toast-error' : '');

    clearTimeout(window._ztToastTimeout);
    window._ztToastTimeout = setTimeout(function () {
      toast.className = 'zt-toast';
    }, 2500);
  }

  // Copy to Clipboard
  window.copyToClipboard = function (text, successMsg) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () {
        showToast(successMsg || 'Copied to clipboard!');
      }).catch(function () {
        fallbackCopy(text, successMsg);
      });
    } else {
      fallbackCopy(text, successMsg);
    }
  };

  function fallbackCopy(text, successMsg) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      showToast(successMsg || 'Copied to clipboard!');
    } catch (err) {
      showToast('Copy failed', 'error');
    }
    document.body.removeChild(textArea);
  }

  // Table Filter Helper
  window.filterTable = function (inputId, tableId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const filter = input.value.toLowerCase();
    const table = document.getElementById(tableId);
    if (!table) return;
    const rows = table.getElementsByTagName('tr');

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const text = row.textContent || row.innerText;
      if (text.toLowerCase().indexOf(filter) > -1) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    }
  };

  // Language switcher helper
  window.switchLanguage = function (lang) {
    const url = new URL(window.location.href);
    url.searchParams.set('lang', lang);
    window.location.href = url.toString();
  };

})();
