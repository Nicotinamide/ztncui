/**
 * RESTful API client for ztncui
 */

async function request(endpoint, options = {}) {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  const config = {
    credentials: 'include',
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    }
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch('/api/v1' + endpoint, config);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
      return;
    }
    const error = new Error(data.error || `HTTP error ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Auth
  login: (username, password) => request('/auth/login', { method: 'POST', body: { username, password } }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  getMe: () => request('/auth/me'),
  getApiToken: () => request('/auth/token'),
  toggleApiAccess: (enabled) => request('/auth/token/toggle', { method: 'POST', body: { enabled } }),
  regenerateApiToken: () => request('/auth/token/regenerate', { method: 'POST' }),

  // Status & Peers
  getStatus: () => request('/status'),
  getPeers: () => request('/peers'),

  // Networks
  getNetworks: () => request('/networks'),
  createNetwork: (name) => request('/networks', { method: 'POST', body: { name } }),
  getNetwork: (nwid) => request(`/networks/${nwid}`),
  renameNetwork: (nwid, name) => request(`/networks/${nwid}/name`, { method: 'PUT', body: { name } }),
  setPrivate: (nwid, isPrivate) => request(`/networks/${nwid}/private`, { method: 'PUT', body: { private: isPrivate } }),
  deleteNetwork: (nwid) => request(`/networks/${nwid}`, { method: 'DELETE' }),

  // Network Sub-configurations
  easySetup: (nwid, routes, ipAssignmentPools, v4AssignMode) =>
    request(`/networks/${nwid}/easy`, { method: 'POST', body: { routes, ipAssignmentPools, v4AssignMode } }),
  addRoute: (nwid, target, via) => request(`/networks/${nwid}/routes`, { method: 'POST', body: { target, via } }),
  deleteRoute: (nwid, target) => request(`/networks/${nwid}/routes`, { method: 'DELETE', body: { target } }),
  addPool: (nwid, ipRangeStart, ipRangeEnd) =>
    request(`/networks/${nwid}/pools`, { method: 'POST', body: { ipRangeStart, ipRangeEnd } }),
  deletePool: (nwid, ipRangeStart, ipRangeEnd) =>
    request(`/networks/${nwid}/pools`, { method: 'DELETE', body: { ipRangeStart, ipRangeEnd } }),
  updateDns: (nwid, domain, servers) => request(`/networks/${nwid}/dns`, { method: 'POST', body: { domain, servers } }),
  updateAssignMode: (nwid, v4AssignMode, v6AssignMode) =>
    request(`/networks/${nwid}/assign-mode`, { method: 'POST', body: { v4AssignMode, v6AssignMode } }),

  // Members
  getMembers: (nwid) => request(`/networks/${nwid}/members`),
  setMemberAuth: (nwid, id, authorized) =>
    request(`/networks/${nwid}/members/${id}/auth`, { method: 'PUT', body: { authorized } }),
  setMemberBridge: (nwid, id, activeBridge) =>
    request(`/networks/${nwid}/members/${id}/bridge`, { method: 'PUT', body: { activeBridge } }),
  setMemberName: (nwid, id, name) =>
    request(`/networks/${nwid}/members/${id}/name`, { method: 'PUT', body: { name } }),
  addMemberIp: (nwid, id, ipAddress) =>
    request(`/networks/${nwid}/members/${id}/ips`, { method: 'POST', body: { ipAddress } }),
  deleteMemberIp: (nwid, id, index) =>
    request(`/networks/${nwid}/members/${id}/ips/${index}`, { method: 'DELETE' }),
  deleteMember: (nwid, id) =>
    request(`/networks/${nwid}/members/${id}`, { method: 'DELETE' }),

  // Users
  getUsers: () => request('/users'),
  createUser: (username, password) => request('/users', { method: 'POST', body: { username, password } }),
  updatePassword: (name, password) => request(`/users/${name}/password`, { method: 'PUT', body: { password } }),
  deleteUser: (name) => request(`/users/${name}`, { method: 'DELETE' })
};
