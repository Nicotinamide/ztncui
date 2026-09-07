/*
  ztncui - ZeroTier network controller UI
  Copyright (C) 2017-2021  Key Networks (https://key-networks.com)
  Licensed under GPLv3 - see LICENSE for details.
*/

const fs = require('fs');
const path = require('path');
const util = require('util');

const readFile = util.promisify(fs.readFile);

let _token = process.env.ZT_TOKEN;

function getCandidateTokenPaths() {
  const paths = [
    '/var/lib/zerotier-one/authtoken.secret',
    '/opt/ztncui/zerotier-one/authtoken.secret'
  ];

  if (process.env.LOCALAPPDATA) {
    paths.push(path.join(process.env.LOCALAPPDATA, 'ZeroTier', 'authtoken.secret'));
  }
  if (process.env.ProgramData) {
    paths.push(path.join(process.env.ProgramData, 'ZeroTier', 'One', 'authtoken.secret'));
  }
  if (process.env.HOME) {
    paths.push(path.join(process.env.HOME, 'Library', 'Application Support', 'ZeroTier', 'authtoken.secret'));
    paths.push(path.join(process.env.HOME, '.zeroTier', 'authtoken.secret'));
  }

  return paths;
}

exports.get = async function(forceRefresh = false) {
  if (_token && !forceRefresh) {
    return _token;
  }

  if (process.env.ZT_TOKEN) {
    _token = process.env.ZT_TOKEN.trim();
    return _token;
  }

  const candidatePaths = getCandidateTokenPaths();
  for (const tokenPath of candidatePaths) {
    try {
      if (fs.existsSync(tokenPath)) {
        const content = await readFile(tokenPath, 'utf8');
        if (content && content.trim()) {
          _token = content.trim();
          return _token;
        }
      }
    } catch {}
  }

  throw new Error('Could not find ZeroTier authtoken.secret in any standard path or ZT_TOKEN env.');
};

exports.invalidate = function() {
  _token = null;
};
