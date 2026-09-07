/*
  ztncui - ZeroTier network controller UI
  Copyright (C) 2017-2021  Key Networks (https://key-networks.com)
  Licensed under GPLv3 - see LICENSE for details.
  Modernized with native fetch & ZeroTier 1.16+ compatibility.
*/

const http = require('http');
const https = require('https');
const ipaddr = require('ip-address');
const token = require('./token');

const ZT_ADDR = process.env.ZT_ADDR || 'localhost:9993';

function getBaseUrl() {
  if (ZT_ADDR.startsWith('http://') || ZT_ADDR.startsWith('https://')) {
    return ZT_ADDR;
  }
  return 'http://' + ZT_ADDR;
}

// Universal HTTP caller (supports fetch or native http/https fallback for Node 14/16/18/20+)
async function callZt(endpoint, method = 'GET', bodyData = null) {
  const tok = await token.get();
  const fullUrl = `${getBaseUrl()}${endpoint}`;
  const payload = (bodyData !== null && bodyData !== undefined)
    ? (typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData))
    : null;

  // 1. If global fetch is available (Node 18+)
  if (typeof fetch === 'function') {
    const headers = {
      'X-ZT1-Auth': tok,
      'Content-Type': 'application/json',
    };
    const options = {
      method: method.toUpperCase(),
      headers: headers,
    };
    if (payload !== null) options.body = payload;

    const res = await fetch(fullUrl, options);
    if (!res.ok) {
      if (res.status === 404 && endpoint.startsWith('/peer/')) return null;
      let errMsg = `ZeroTier API returned ${res.status}`;
      try {
        const errJson = await res.json();
        errMsg = (errJson && (errJson.message || errJson.error)) || JSON.stringify(errJson);
      } catch {
        try { errMsg = await res.text(); } catch {}
      }
      const err = new Error(errMsg);
      err.statusCode = res.status;
      throw err;
    }
    const text = await res.text();
    try { return text ? JSON.parse(text) : {}; } catch { return text; }
  }

  // 2. Fallback to native http/https for Node 14/16
  return new Promise((resolve, reject) => {
    const urlObj = new URL(fullUrl);
    const client = urlObj.protocol === 'https:' ? https : http;

    const headers = {
      'X-ZT1-Auth': tok,
      'Content-Type': 'application/json',
    };
    if (payload !== null) {
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = client.request({
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: method.toUpperCase(),
      headers: headers,
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(data ? JSON.parse(data) : {});
          } catch {
            resolve(data);
          }
        } else {
          if (res.statusCode === 404 && endpoint.startsWith('/peer/')) {
            return resolve(null);
          }
          let errMsg = `ZeroTier API returned ${res.statusCode}: ${data}`;
          try {
            const errJson = JSON.parse(data);
            if (errJson && (errJson.message || errJson.error)) errMsg = errJson.message || errJson.error;
          } catch {}
          const err = new Error(errMsg);
          err.statusCode = res.statusCode;
          reject(err);
        }
      });
    });

    req.on('error', reject);
    if (payload !== null) req.write(payload);
    req.end();
  });
}

const get_zt_status = async function() {
  return await callZt('/status');
};
exports.get_zt_status = get_zt_status;

const get_zt_address = async function() {
  return (await get_zt_status()).address;
};
exports.get_zt_address = get_zt_address;

exports.network_list = async function() {
  let nwids = await callZt('/controller/network');
  if (!Array.isArray(nwids)) nwids = [];

  const networks = [];
  for (let nwid of nwids) {
    try {
      const net = await callZt('/controller/network/' + nwid);
      networks.push({ name: net.name, nwid: net.nwid });
    } catch (err) {
      console.error(`Error resolving network ${nwid}:`, err.message);
    }
  }
  return networks;
};

const network_detail = async function(nwid) {
  return await callZt('/controller/network/' + nwid);
};
exports.network_detail = network_detail;

exports.network_create = async function(name) {
  const zt_address = await get_zt_address();
  return await callZt('/controller/network/' + zt_address + '______', 'POST', name);
};

exports.network_delete = async function(nwid) {
  const res = await callZt('/controller/network/' + nwid, 'DELETE');
  if (res && typeof res === 'object') res.deleted = true;
  return res;
};

exports.ipAssignmentPools = async function(nwid, ipAssignmentPool, action) {
  const network = await network_detail(nwid);
  let ipAssignmentPools = network.ipAssignmentPools || [];

  if (action === 'add') {
    ipAssignmentPools.push(ipAssignmentPool);
  } else if (action === 'delete') {
    const pool = ipAssignmentPools.find(p =>
      p.ipRangeStart === ipAssignmentPool.ipRangeStart &&
      p.ipRangeEnd === ipAssignmentPool.ipRangeEnd);
    ipAssignmentPools = ipAssignmentPools.filter(p => p != pool);
  }

  return await callZt('/controller/network/' + nwid, 'POST', { ipAssignmentPools: ipAssignmentPools });
};

exports.ipAssignmentDelete = async function(nwid, id, ipAssignmentIndex) {
  const member = await member_detail(nwid, id);
  const ipAssignments = member.ipAssignments || [];
  ipAssignments.splice(ipAssignmentIndex, 1);
  const res = await callZt('/controller/network/' + nwid + '/member/' + id, 'POST', { ipAssignments: ipAssignments });
  if (res && typeof res === 'object') res.deleted = true;
  return res;
};

exports.ipAssignmentAdd = async function(nwid, id, ipAssignment) {
  const member = await member_detail(nwid, id);
  const ipAssignments = member.ipAssignments || [];
  ipAssignments.push(ipAssignment.ipAddress);
  const res = await callZt('/controller/network/' + nwid + '/member/' + id, 'POST', { ipAssignments: ipAssignments });
  if (res && typeof res === 'object') res.added = true;
  return res;
};

function canonicalTarget(target) {
  const target6 = new ipaddr.Address6(target);
  if (target6.isValid()) {
    const parts = target.split('/');
    return target6.canonicalForm() + '/' + parts[1];
  }
  return target;
}

exports.routes = async function(nwid, route, action) {
  const network = await network_detail(nwid);
  let routes = network.routes || [];
  route.target = canonicalTarget(route.target);

  const route_to_del = routes.find(rt => canonicalTarget(rt.target) === route.target);

  if (!route_to_del) {
    if (action === 'add') {
      routes.push(route);
    } else if (action === 'delete') {
      throw new Error('Cannot delete non-existent route target');
    }
  } else {
    if (action === 'add') {
      throw new Error('Route target is not unique');
    } else if (action === 'delete') {
      routes = routes.filter(rt => rt != route_to_del);
    }
  }

  return await callZt('/controller/network/' + nwid, 'POST', { routes: routes });
};

exports.network_object = async function(nwid, object) {
  return await callZt('/controller/network/' + nwid, 'POST', object);
};

exports.members = async function(nwid) {
  return await callZt('/controller/network/' + nwid + '/member');
};

const member_detail = async function(nwid, id) {
  return await callZt('/controller/network/' + nwid + '/member/' + id);
};
exports.member_detail = member_detail;

exports.member_object = async function(nwid, id, object) {
  return await callZt('/controller/network/' + nwid + '/member/' + id, 'POST', object);
};

exports.member_delete = async function(nwid, id) {
  const res = await callZt('/controller/network/' + nwid + '/member/' + id, 'DELETE');
  if (res && typeof res === 'object') res.deleted = true;
  return res;
};

exports.network_easy_setup = async function(nwid, routes, ipAssignmentPools, v4AssignMode) {
  return await callZt('/controller/network/' + nwid, 'POST', {
    ipAssignmentPools: ipAssignmentPools,
    routes: routes,
    v4AssignMode: v4AssignMode
  });
};

exports.peers = async function() {
  const res = await callZt('/peer');
  return Array.isArray(res) ? res : [];
};

exports.peer = async function(id) {
  return await callZt('/peer/' + id);
};
