<template>
  <div>
    <!-- Error State -->
    <div v-if="error" class="card text-center" style="padding: 48px 20px;">
      <div style="font-size: 48px; margin-bottom: 12px;">⚠️</div>
      <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 8px; color: var(--text-main);">加载网络失败</h2>
      <p style="color: var(--danger); margin-bottom: 24px; font-size: 14px;">{{ error }}</p>
      <div style="display: flex; justify-content: center; gap: 12px;">
        <button class="btn btn-primary" @click="loadData">
          <span>🔄 重新加载</span>
        </button>
        <router-link to="/networks" class="btn btn-secondary">
          <span>← 返回网络列表</span>
        </router-link>
      </div>
    </div>

    <!-- Initial Network Loading Skeleton -->
    <div v-else-if="loading" class="card text-center" style="padding: 64px 20px;">
      <div class="loading-spinner"></div>
      <h3 style="font-size: 17px; font-weight: 700; color: var(--text-main); margin-top: 16px;">正在加载网络配置...</h3>
      <p style="font-size: 13px; color: var(--text-muted); margin-top: 6px;">网络 ID: <code>{{ nwid }}</code></p>
    </div>

    <!-- Main Network View -->
    <div v-else-if="network">
      <!-- Top Header Card -->
      <div class="card" style="margin-bottom: 20px;">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
        <div>
          <!-- Network Name Editable -->
          <div style="display: flex; align-items: center; gap: 10px;">
            <template v-if="!editingName">
              <h1 style="font-size: 24px; font-weight: 800; color: var(--text-main); margin: 0;">
                {{ network.name || 'Unnamed Network' }}
              </h1>
              <button class="copy-btn" @click="startEditName" title="编辑网络名称" style="font-size: 16px;">
                ✏️
              </button>
            </template>
            <template v-else>
              <input
                v-model="nameInput"
                type="text"
                class="form-control"
                style="max-width: 240px; height: 36px; font-size: 16px; font-weight: 600;"
                @blur="saveName"
                @keyup.enter="saveName"
                autofocus
              />
              <button class="btn btn-primary btn-sm" @click="saveName">保存</button>
              <button class="btn btn-secondary btn-sm" @click="editingName = false">取消</button>
            </template>
          </div>

          <!-- Network ID & Status Badge -->
          <div style="display: flex; align-items: center; gap: 10px; margin-top: 8px; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="badge-id" style="font-size: 14px;">{{ network.nwid }}</span>
              <button class="copy-btn" @click="copyText(network.nwid, t('common.copied'))" :title="t('common.copy')">
                📋
              </button>
            </div>

            <!-- Mode Toggle Badge -->
            <button
              :class="['badge', network.private ? 'badge-muted' : 'badge-success']"
              style="cursor: pointer; font-size: 13px; padding: 4px 10px;"
              @click="togglePrivate"
              title="点击切换公开/私有模式"
            >
              <span v-if="network.private">🔒 {{ t('networks.private_mode') }}</span>
              <span v-else>🌐 {{ t('networks.public_mode') }}</span>
              <span style="font-size: 11px; opacity: 0.7; margin-left: 4px;">(点击切换)</span>
            </button>
          </div>
        </div>

        <div>
          <router-link to="/networks" class="btn btn-secondary">
            <span>← {{ t('common.back') }}</span>
          </router-link>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="tabs" style="margin-top: 24px; margin-bottom: 0;">
        <button
          v-for="tab in tabList"
          :key="tab.id"
          :class="['tab-btn', currentTab === tab.id ? 'active' : '']"
          @click="currentTab = tab.id"
        >
          <span>{{ tab.icon }}</span>
          <span>{{ tab.label }}</span>
          <span v-if="tab.badge !== undefined" class="badge badge-muted" style="margin-left: 4px; font-size: 11px;">
            {{ tab.badge }}
          </span>
        </button>
      </div>
    </div>

    <!-- Tab 1: Members -->
    <div v-if="currentTab === 'members'" class="card">
      <div class="card-header">
        <div>
          <h2 class="card-title">{{ t('detail.tab_members') }} ({{ members.length }})</h2>
          <p class="card-subtitle">管理已加入此虚拟网络的设备节点与授权权限</p>
        </div>
        <div style="display: flex; gap: 10px; align-items: center;">
          <button class="btn btn-secondary btn-sm" @click="loadMembers" :disabled="membersLoading" title="刷新成员列表">
            <span>🔄</span>
            <span v-if="!membersLoading">刷新</span>
          </button>
          <div style="max-width: 280px; width: 100%;">
            <input
              v-model="memberSearch"
              type="text"
              class="form-control"
              :placeholder="t('detail.search_members')"
            />
          </div>
        </div>
      </div>

      <!-- Members Loading Spinner inside tab -->
      <div v-if="membersLoading" style="text-align: center; padding: 48px 20px;">
        <div class="loading-spinner"></div>
        <p style="color: var(--text-muted); font-size: 14px; margin-top: 14px;">正在加载已连接设备与成员列表...</p>
      </div>

      <!-- Members Table -->
      <div v-else-if="paginatedMembers.length > 0">
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th style="width: 4%;"></th>
                <th style="width: 18%;">{{ t('detail.col_name') }}</th>
                <th style="width: 14%;">{{ t('detail.col_node') }}</th>
                <th style="width: 8%; text-align: center;">{{ t('detail.col_auth') }}</th>
                <th style="width: 8%; text-align: center;">{{ t('detail.col_bridge') }}</th>
                <th style="width: 20%;">{{ t('detail.col_managed_ips') }}</th>
                <th style="width: 14%;">{{ t('detail.col_status') }}</th>
                <th style="width: 14%;">{{ t('detail.col_endpoint') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in paginatedMembers" :key="m.id">
                <td style="text-align: center;">
                  <button
                    class="copy-btn"
                    style="color: var(--danger);"
                    @click="confirmDeleteMember(m)"
                    title="删除该成员"
                  >
                    🗑️
                  </button>
                </td>
                <td>
                  <input
                    :value="m.name"
                    type="text"
                    class="form-control"
                    style="height: 32px; font-size: 13px;"
                    placeholder="添加设备备注..."
                    @change="saveMemberName(m.id, $event.target.value)"
                  />
                </td>
                <td>
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span class="badge-id" style="font-size: 12px;">{{ m.id }}</span>
                    <button class="copy-btn" @click="copyText(m.id, t('common.copied'))">📋</button>
                  </div>
                </td>
                <td style="text-align: center;">
                  <label class="switch">
                    <input
                      type="checkbox"
                      :checked="m.authorized"
                      @change="toggleMemberAuth(m.id, $event.target.checked)"
                    />
                    <span class="slider"></span>
                  </label>
                </td>
                <td style="text-align: center;">
                  <label class="switch">
                    <input
                      type="checkbox"
                      :checked="m.activeBridge"
                      @change="toggleMemberBridge(m.id, $event.target.checked)"
                    />
                    <span class="slider"></span>
                  </label>
                </td>
                <td>
                  <div style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center;">
                    <span
                      v-for="(ip, idx) in m.ipAssignments"
                      :key="idx"
                      class="badge badge-success"
                      style="font-family: monospace; font-size: 12px;"
                    >
                      {{ ip }}
                      <span
                        style="cursor: pointer; margin-left: 4px; font-weight: bold;"
                        @click="deleteMemberIp(m.id, idx)"
                        title="移除此 IP"
                      >×</span>
                    </span>
                    <button
                      class="btn btn-secondary btn-sm"
                      style="padding: 2px 6px; font-size: 11px;"
                      @click="openAddIpModal(m)"
                    >
                      + IP
                    </button>
                  </div>
                </td>
                <td>
                  <div v-if="m.id === ztAddress" style="color: var(--primary); font-weight: 600; display: flex; align-items: center; gap: 6px; font-size: 13px;">
                    <span class="dot" style="background: var(--primary);"></span>
                    <span>CONTROLLER</span>
                  </div>
                  <div v-else-if="m.peer && m.peer.latency !== -1 && m.peer.latency !== undefined" style="color: var(--success); font-weight: 600; display: flex; align-items: center; gap: 6px; font-size: 13px;">
                    <span class="dot dot-online"></span>
                    <span>ONLINE (v{{ m.peer.version || '1.x' }})</span>
                  </div>
                  <div v-else style="color: var(--text-light); display: flex; align-items: center; gap: 6px; font-size: 13px;">
                    <span class="dot dot-offline"></span>
                    <span>OFFLINE</span>
                  </div>
                </td>
                <td>
                  <div v-if="getPreferredPath(m.peer)" style="font-size: 12px; font-family: monospace;">
                    <div>{{ getPreferredPath(m.peer).address }}</div>
                    <span v-if="m.peer.latency !== -1 && m.peer.latency !== undefined" class="badge badge-muted" style="margin-top: 2px;">
                      ⚡ {{ m.peer.latency }} ms
                    </span>
                  </div>
                  <div v-else style="color: var(--text-light); font-size: 12px;">-</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination Bar -->
        <div v-if="totalPages > 1" style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px; padding: 0 4px; font-size: 13px; color: var(--text-muted);">
          <div>
            共 {{ filteredMembers.length }} 个成员，当前显示第 {{ (currentPage - 1) * pageSize + 1 }} ~ {{ Math.min(currentPage * pageSize, filteredMembers.length) }} 个
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button class="btn btn-secondary btn-sm" :disabled="currentPage <= 1" @click="currentPage--">上一页</button>
            <span>第 {{ currentPage }} / {{ totalPages }} 页</span>
            <button class="btn btn-secondary btn-sm" :disabled="currentPage >= totalPages" @click="currentPage++">下一页</button>
          </div>
        </div>
      </div>

      <div v-else style="text-align: center; padding: 48px 20px; color: var(--text-muted);">
        <p>{{ t('detail.no_members') }}</p>
      </div>
    </div>

    <!-- Tab 2: Easy Setup -->
    <div v-if="currentTab === 'easy'" class="card">
      <div class="card-header">
        <div>
          <h2 class="card-title">{{ t('detail.easy_title') }}</h2>
          <p class="card-subtitle">{{ t('detail.easy_desc') }}</p>
        </div>
      </div>

      <div style="max-width: 600px;">
        <div class="form-group">
          <label class="form-label">{{ t('detail.cidr_preset') }}</label>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 8px;">
            <button
              v-for="p in easyPresets"
              :key="p.cidr"
              type="button"
              :class="['btn', selectedPreset.cidr === p.cidr ? 'btn-primary' : 'btn-secondary']"
              style="justify-content: flex-start; padding: 12px 16px; text-align: left;"
              @click="selectedPreset = p"
            >
              <div>
                <div style="font-weight: 700; font-size: 14px;">{{ p.cidr }}</div>
                <div style="font-size: 12px; opacity: 0.8; margin-top: 2px;">{{ p.desc }}</div>
              </div>
            </button>
          </div>
        </div>

        <div style="background: #f8fafc; border: 1px dashed var(--border); border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 13px;">
          <div style="font-weight: 600; margin-bottom: 6px;">📋 配置预览:</div>
          <div>• 路由规则: <code>{{ selectedPreset.cidr }}</code></div>
          <div>• IP 分配池: <code>{{ selectedPreset.start }} ~ {{ selectedPreset.end }}</code></div>
          <div>• 自动分配模式: <code>IPv4 Auto-assign (开启)</code></div>
        </div>

        <button class="btn btn-primary" @click="applyEasySetup" :disabled="applyingEasy">
          <span v-if="applyingEasy">⏳ 正在应用...</span>
          <span v-else>🚀 {{ t('detail.apply_easy') }}</span>
        </button>
      </div>
    </div>

    <!-- Tab 3: Routes -->
    <div v-if="currentTab === 'routes'" class="card">
      <div class="card-header">
        <div>
          <h2 class="card-title">{{ t('detail.routes_title') }}</h2>
          <p class="card-subtitle">ZeroTier 虚拟专用网络内部路由表规则</p>
        </div>
        <button class="btn btn-primary btn-sm" @click="showAddRouteModal = true">
          <span>➕ {{ t('detail.add_route') }}</span>
        </button>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>{{ t('detail.target_cidr') }}</th>
              <th>{{ t('detail.gateway') }}</th>
              <th style="width: 15%; text-align: right;">{{ t('common.action') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in network.routes || []" :key="r.target">
              <td><span class="badge-id">{{ r.target }}</span></td>
              <td><code>{{ r.via || 'Direct (LAN)' }}</code></td>
              <td style="text-align: right;">
                <button class="btn btn-danger btn-sm" @click="deleteRoute(r.target)">{{ t('common.delete') }}</button>
              </td>
            </tr>
            <tr v-if="(!network.routes || network.routes.length === 0)">
              <td colspan="3" style="text-align: center; padding: 24px; color: var(--text-muted);">暂无路由规则</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tab 4: IP Pools -->
    <div v-if="currentTab === 'pools'" class="card">
      <div class="card-header">
        <div>
          <h2 class="card-title">{{ t('detail.pools_title') }}</h2>
          <p class="card-subtitle">新加入设备自动获取虚拟 IP 的起始与结束地址范围</p>
        </div>
        <button class="btn btn-primary btn-sm" @click="showAddPoolModal = true">
          <span>➕ {{ t('detail.add_pool') }}</span>
        </button>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>{{ t('detail.pool_start') }}</th>
              <th>{{ t('detail.pool_end') }}</th>
              <th style="width: 15%; text-align: right;">{{ t('common.action') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in network.ipAssignmentPools || []" :key="p.ipRangeStart + '-' + p.ipRangeEnd">
              <td><code>{{ p.ipRangeStart }}</code></td>
              <td><code>{{ p.ipRangeEnd }}</code></td>
              <td style="text-align: right;">
                <button class="btn btn-danger btn-sm" @click="deletePool(p.ipRangeStart, p.ipRangeEnd)">{{ t('common.delete') }}</button>
              </td>
            </tr>
            <tr v-if="(!network.ipAssignmentPools || network.ipAssignmentPools.length === 0)">
              <td colspan="3" style="text-align: center; padding: 24px; color: var(--text-muted);">暂无动态分配池</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tab 5: Assign Modes -->
    <div v-if="currentTab === 'assign'" class="card">
      <div class="card-header">
        <div>
          <h2 class="card-title">IP 分配模式开关</h2>
          <p class="card-subtitle">控制网络对加入设备的 IPv4 与 IPv6 自动化配置策略</p>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 20px; max-width: 500px;">
        <!-- IPv4 -->
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px; border: 1px solid var(--border); border-radius: var(--radius-md);">
          <div>
            <div style="font-weight: 700; font-size: 15px;">IPv4 自动分配</div>
            <div style="font-size: 13px; color: var(--text-muted); margin-top: 2px;">{{ t('detail.v4_auto') }}</div>
          </div>
          <label class="switch">
            <input
              type="checkbox"
              :checked="!!network.v4AssignMode?.zt"
              @change="updateAssignModes('v4', $event.target.checked)"
            />
            <span class="slider"></span>
          </label>
        </div>

        <!-- IPv6 Modes -->
        <div style="padding: 16px; border: 1px solid var(--border); border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 16px;">
          <div style="font-weight: 700; font-size: 15px;">{{ t('detail.v6_title') }}</div>

          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 14px;">ZT 6plane (/80 每个设备独立网段)</span>
            <label class="switch">
              <input
                type="checkbox"
                :checked="!!network.v6AssignMode?.['6plane']"
                @change="updateAssignModes('6plane', $event.target.checked)"
              />
              <span class="slider"></span>
            </label>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 14px;">ZT rfc4193 (/128 每个设备固定)</span>
            <label class="switch">
              <input
                type="checkbox"
                :checked="!!network.v6AssignMode?.['rfc4193']"
                @change="updateAssignModes('rfc4193', $event.target.checked)"
              />
              <span class="slider"></span>
            </label>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 14px;">IPv6 Auto-assign from IP Pool</span>
            <label class="switch">
              <input
                type="checkbox"
                :checked="!!network.v6AssignMode?.zt"
                @change="updateAssignModes('v6zt', $event.target.checked)"
              />
              <span class="slider"></span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab 6: DNS -->
    <div v-if="currentTab === 'dns'" class="card">
      <div class="card-header">
        <div>
          <h2 class="card-title">{{ t('detail.dns_title') }}</h2>
          <p class="card-subtitle">为支持 ZeroTier 客户端 DNS 接管的设备下发域名与服务器</p>
        </div>
      </div>

      <form @submit.prevent="saveDns" style="max-width: 500px;">
        <div class="form-group">
          <label class="form-label">{{ t('detail.domain') }}</label>
          <input v-model="dnsDomain" type="text" class="form-control" placeholder="例如: corp.lan" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('detail.dns_servers') }}</label>
          <textarea v-model="dnsServers" class="form-control" rows="3" placeholder="例如: 10.147.17.1, 1.1.1.1"></textarea>
        </div>
        <button type="submit" class="btn btn-primary">保存 DNS 配置</button>
      </form>
    </div>

    <!-- Tab 7: Raw JSON -->
    <div v-if="currentTab === 'json'" class="card">
      <div class="card-header">
        <h2 class="card-title">{{ t('detail.raw_json_title') }}</h2>
      </div>
      <pre style="background: #0f172a; color: #f8fafc; padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 13px; font-family: monospace;">{{ JSON.stringify(network, null, 2) }}</pre>
    </div>

    <!-- Add Member IP Modal -->
    <Modal v-model="showAddIpModal" title="为成员分配虚拟 IP">
      <div class="form-group">
        <label class="form-label">成员节点 ID</label>
        <input :value="selectedMember?.id" type="text" class="form-control" disabled />
      </div>
      <div class="form-group">
        <label class="form-label">IPv4 地址</label>
        <input v-model="newIpInput" type="text" class="form-control" :placeholder="t('detail.ip_placeholder')" required />
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
        <button type="button" class="btn btn-secondary" @click="showAddIpModal = false">{{ t('common.cancel') }}</button>
        <button type="button" class="btn btn-primary" @click="submitAddIp">{{ t('common.confirm') }}</button>
      </div>
    </Modal>

    <!-- Add Route Modal -->
    <Modal v-model="showAddRouteModal" title="添加网络路由">
      <div class="form-group">
        <label class="form-label">目标网段 (CIDR)</label>
        <input v-model="newRouteTarget" type="text" class="form-control" placeholder="例如: 192.168.10.0/24" required />
      </div>
      <div class="form-group">
        <label class="form-label">网关 IP (可选)</label>
        <input v-model="newRouteVia" type="text" class="form-control" placeholder="留空代表局域网直连" />
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
        <button type="button" class="btn btn-secondary" @click="showAddRouteModal = false">{{ t('common.cancel') }}</button>
        <button type="button" class="btn btn-primary" @click="submitAddRoute">{{ t('common.confirm') }}</button>
      </div>
    </Modal>

    <!-- Add Pool Modal -->
    <Modal v-model="showAddPoolModal" title="添加 IP 分配池">
      <div class="form-group">
        <label class="form-label">起始 IP</label>
        <input v-model="newPoolStart" type="text" class="form-control" placeholder="例如: 10.147.17.1" required />
      </div>
      <div class="form-group">
        <label class="form-label">结束 IP</label>
        <input v-model="newPoolEnd" type="text" class="form-control" placeholder="例如: 10.147.17.254" required />
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
        <button type="button" class="btn btn-secondary" @click="showAddPoolModal = false">{{ t('common.cancel') }}</button>
        <button type="button" class="btn btn-primary" @click="submitAddPool">{{ t('common.confirm') }}</button>
      </div>
    </Modal>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { t } from '../i18n';
import { api } from '../api';
import { copyText, showToast } from '../toast';
import Modal from '../components/Modal.vue';

const route = useRoute();
const nwid = route.params.nwid;

const loading = ref(true);
const membersLoading = ref(true);
const error = ref(null);

const network = ref(null);
const members = ref([]);
const ztAddress = ref('');
const currentTab = ref('members');
const memberSearch = ref('');

// Pagination
const currentPage = ref(1);
const pageSize = 20;

// Name Editing
const editingName = ref(false);
const nameInput = ref('');

// Easy Setup presets
const easyPresets = [
  { cidr: '10.147.17.0/24', start: '10.147.17.1', end: '10.147.17.254', desc: '经典 10.147.17.* 私网' },
  { cidr: '192.168.192.0/24', start: '192.168.192.1', end: '192.168.192.254', desc: '标准 C 类内网' },
  { cidr: '172.24.0.0/24', start: '172.24.0.1', end: '172.24.0.254', desc: 'B 类私有段 172.24.*' },
  { cidr: '10.244.0.0/24', start: '10.244.0.1', end: '10.244.0.254', desc: '大局域网 10.244.*' },
];
const selectedPreset = ref(easyPresets[0]);
const applyingEasy = ref(false);

// DNS form
const dnsDomain = ref('');
const dnsServers = ref('');

// Modals
const showAddIpModal = ref(false);
const selectedMember = ref(null);
const newIpInput = ref('');

const showAddRouteModal = ref(false);
const newRouteTarget = ref('');
const newRouteVia = ref('');

const showAddPoolModal = ref(false);
const newPoolStart = ref('');
const newPoolEnd = ref('');

const tabList = computed(() => [
  { id: 'members', icon: '👥', label: t('detail.tab_members'), badge: members.value.length },
  { id: 'easy', icon: '🪄', label: t('detail.tab_easy') },
  { id: 'routes', icon: '🔀', label: t('detail.tab_routes'), badge: (network.value?.routes || []).length },
  { id: 'pools', icon: '🏊', label: t('detail.tab_pools'), badge: (network.value?.ipAssignmentPools || []).length },
  { id: 'assign', icon: '⚙️', label: t('detail.tab_assign') },
  { id: 'dns', icon: '🌐', label: t('detail.tab_dns') },
  { id: 'json', icon: '📄', label: t('detail.tab_json') },
]);

const filteredMembers = computed(() => {
  const q = memberSearch.value.trim().toLowerCase();
  if (!q) return members.value;
  return members.value.filter(m =>
    (m.name && m.name.toLowerCase().includes(q)) ||
    (m.id && m.id.toLowerCase().includes(q)) ||
    (m.ipAssignments && m.ipAssignments.some(ip => ip.includes(q)))
  );
});

const totalPages = computed(() => {
  return Math.ceil(filteredMembers.value.length / pageSize) || 1;
});

const paginatedMembers = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filteredMembers.value.slice(start, start + pageSize);
});

watch(memberSearch, () => {
  currentPage.value = 1;
});

function getPreferredPath(peer) {
  if (!peer || !peer.paths || !Array.isArray(peer.paths) || peer.paths.length === 0) return null;
  return peer.paths.find(p => p && p.preferred) || peer.paths[0] || null;
}

// 1. Load Network Details first (Fast, <30ms)
async function loadData() {
  loading.value = true;
  error.value = null;
  try {
    const netRes = await api.getNetwork(nwid);
    network.value = netRes.network || {};
    nameInput.value = network.value.name || '';
    if (network.value.dns) {
      dnsDomain.value = network.value.dns.domain || '';
      dnsServers.value = (network.value.dns.servers || []).join(', ');
    }
    loading.value = false;

    // Load members concurrently in the background
    loadMembers();
  } catch (err) {
    console.error('Failed to load network:', err);
    error.value = err.message || '获取网络详情失败';
    loading.value = false;
  }
}

// 2. Load Members concurrently in background
async function loadMembers() {
  membersLoading.value = true;
  try {
    const memRes = await api.getMembers(nwid);
    members.value = memRes.members || [];
    ztAddress.value = memRes.zt_address || '';
  } catch (err) {
    console.error('Failed to load members:', err);
    showToast('成员设备列表加载失败: ' + err.message, 'warning');
  } finally {
    membersLoading.value = false;
  }
}

function startEditName() {
  nameInput.value = network.value.name || '';
  editingName.value = true;
}

async function saveName() {
  const newName = nameInput.value.trim();
  if (!newName || newName === network.value.name) {
    editingName.value = false;
    return;
  }
  try {
    await api.renameNetwork(nwid, newName);
    network.value.name = newName;
    editingName.value = false;
    showToast('网络名称修改成功');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function togglePrivate() {
  const nextPrivate = !network.value.private;
  try {
    await api.setPrivate(nwid, nextPrivate);
    network.value.private = nextPrivate;
    showToast(nextPrivate ? '已切换为私有模式' : '已切换为公开模式');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Members operations
async function toggleMemberAuth(id, authorized) {
  try {
    await api.setMemberAuth(nwid, id, authorized);
    const m = members.value.find(x => x.id === id);
    if (m) m.authorized = authorized;
    showToast(authorized ? '设备已授权' : '已取消授权');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function toggleMemberBridge(id, activeBridge) {
  try {
    await api.setMemberBridge(nwid, id, activeBridge);
    const m = members.value.find(x => x.id === id);
    if (m) m.activeBridge = activeBridge;
    showToast('桥接模式已更新');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function saveMemberName(id, name) {
  try {
    await api.setMemberName(nwid, id, name);
    const m = members.value.find(x => x.id === id);
    if (m) m.name = name;
    showToast('设备备注已保存');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openAddIpModal(member) {
  selectedMember.value = member;
  newIpInput.value = '';
  showAddIpModal.value = true;
}

async function submitAddIp() {
  if (!newIpInput.value.trim() || !selectedMember.value) return;
  try {
    await api.addMemberIp(nwid, selectedMember.value.id, newIpInput.value.trim());
    showToast('虚拟 IP 添加成功');
    showAddIpModal.value = false;
    await loadMembers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteMemberIp(id, index) {
  try {
    await api.deleteMemberIp(nwid, id, index);
    showToast('虚拟 IP 已删除');
    await loadMembers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function confirmDeleteMember(member) {
  if (!confirm(`确定要从网络中删除设备 ${member.name || member.id} 吗？`)) return;
  try {
    await api.deleteMember(nwid, member.id);
    showToast('成员已删除');
    members.value = members.value.filter(m => m.id !== member.id);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Fast reload for network config only
async function refreshNetworkOnly() {
  try {
    const netRes = await api.getNetwork(nwid);
    network.value = netRes.network || {};
  } catch (err) {
    console.error('Failed to refresh network config:', err);
  }
}

// Easy Setup
async function applyEasySetup() {
  applyingEasy.value = true;
  try {
    const p = selectedPreset.value;
    const routes = [{ target: p.cidr, via: null }];
    const pools = [{ ipRangeStart: p.start, ipRangeEnd: p.end }];
    await api.easySetup(nwid, routes, pools, { zt: true });
    showToast('快速向导配置已生效！');
    await refreshNetworkOnly();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    applyingEasy.value = false;
  }
}

// Routes
async function submitAddRoute() {
  if (!newRouteTarget.value.trim()) return;
  try {
    await api.addRoute(nwid, newRouteTarget.value.trim(), newRouteVia.value.trim());
    showToast('路由规则添加成功');
    showAddRouteModal.value = false;
    newRouteTarget.value = '';
    newRouteVia.value = '';
    await refreshNetworkOnly();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteRoute(target) {
  if (!confirm(`确定删除路由规则 ${target} 吗？`)) return;
  try {
    await api.deleteRoute(nwid, target);
    showToast('路由已删除');
    await refreshNetworkOnly();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Pools
async function submitAddPool() {
  if (!newPoolStart.value.trim() || !newPoolEnd.value.trim()) return;
  try {
    await api.addPool(nwid, newPoolStart.value.trim(), newPoolEnd.value.trim());
    showToast('分配池添加成功');
    showAddPoolModal.value = false;
    newPoolStart.value = '';
    newPoolEnd.value = '';
    await refreshNetworkOnly();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deletePool(start, end) {
  if (!confirm(`确定删除分配池 ${start} ~ ${end} 吗？`)) return;
  try {
    await api.deletePool(nwid, start, end);
    showToast('分配池已删除');
    await refreshNetworkOnly();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Assign Modes
async function updateAssignModes(key, value) {
  const v4 = { zt: key === 'v4' ? value : (network.value?.v4AssignMode?.zt || false) };
  const v6 = {
    '6plane': key === '6plane' ? value : (network.value?.v6AssignMode?.['6plane'] || false),
    'rfc4193': key === 'rfc4193' ? value : (network.value?.v6AssignMode?.['rfc4193'] || false),
    'zt': key === 'v6zt' ? value : (network.value?.v6AssignMode?.zt || false),
  };
  try {
    await api.updateAssignMode(nwid, v4, v6);
    if (!network.value.v4AssignMode) network.value.v4AssignMode = {};
    if (!network.value.v6AssignMode) network.value.v6AssignMode = {};
    network.value.v4AssignMode = v4;
    network.value.v6AssignMode = v6;
    showToast('分配模式已更新');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// DNS
async function saveDns() {
  try {
    const s = dnsServers.value.split(/[\n,]+/).map(x => x.trim()).filter(Boolean);
    await api.updateDns(nwid, dnsDomain.value.trim(), s);
    showToast('DNS 配置已保存');
    await refreshNetworkOnly();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.loading-spinner {
  margin: 0 auto;
  width: 32px;
  height: 32px;
  border: 3px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
