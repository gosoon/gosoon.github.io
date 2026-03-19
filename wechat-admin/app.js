(function () {
  const presets = window.WEB_ADMIN_PRESETS || [];
  const config = Object.assign(
    {
      apiBaseUrl: '',
      dataBaseUrl: './data',
      requestTimeoutMs: 5000
    },
    window.WEB_ADMIN_CONFIG || {}
  );

  const NAV_ITEMS = [
    { id: 'articles', label: '所有文章', icon: '📚' },
    { id: 'follows', label: '关注的公众号', icon: '👥' },
    { id: 'favorites', label: '收藏的文章', icon: '⭐' },
    { id: 'groups', label: '分组管理', icon: '🏷' }
  ];

  const state = {
    token: '',
    snapshot: null,
    section: 'articles',
    viewMode: 'card',
    page: 1,
    loadSource: '',
    errorMessage: '',
    runtimeNotice: '',
    runtimeNoticeType: 'info',
    isLoading: true,
    sidebarCollapsed: false,
    noticeTimer: 0,
    filters: {
      form: {
        keyword: '',
        date: '',
        account: 'all',
        group: 'all'
      },
      applied: {
        keyword: '',
        date: '',
        account: 'all',
        group: 'all'
      }
    }
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function resolveToken() {
    const params = new URLSearchParams(window.location.search);
    const queryToken = params.get('token');
    const parts = window.location.pathname.split('/').filter(Boolean);
    const lastPart = parts[parts.length - 1] || '';
    const pathToken = parts.length > 1 && lastPart && !lastPart.includes('.') ? lastPart : '';
    const presetToken = presets[0] && presets[0].token ? presets[0].token : 'demo';

    return queryToken || pathToken || presetToken;
  }

  function buildStaticDataUrl(token) {
    const baseUrl = String(config.dataBaseUrl || './data').replace(/\/$/, '');
    return `${baseUrl}/${encodeURIComponent(token)}.json`;
  }

  function buildApiUrl(token) {
    const baseUrl = String(config.apiBaseUrl || '').trim();

    if (!baseUrl) {
      return '';
    }

    return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
  }

  function buildManageUrl(token) {
    const origin = window.location.origin || '';
    const pathname = window.location.pathname || '/';
    const basePath = pathname.replace(/\/[^/]*$/, '/index.html');
    return `${origin}${basePath}?token=${encodeURIComponent(token)}`;
  }

  function ensureSnapshot(snapshot, token) {
    const next = clone(snapshot || {});
    next.token = next.token || token;
    next.generatedAt = next.generatedAt || '';
    next.profile = next.profile || {
      nickname: '演示账号',
      userId: 'demo-user'
    };
    next.membership = Object.assign(
      {
        membershipLabel: '基础会员',
        statusLabel: '演示模式',
        expireAtLabel: '未连接真实服务',
        detail: '当前页面已加载演示数据，可继续用于界面联调。'
      },
      next.membership || {}
    );
    next.preferences = Object.assign(
      {
        showHomeCover: true,
        readingFontSize: 'default',
        readingFontLabel: '默认'
      },
      next.preferences || {}
    );
    next.webAdmin = Object.assign(
      {
        manageUrl: '',
        webhookStatusLabel: '未开启',
        webhookDescription: '当前未接入 WebHook 推送。'
      },
      next.webAdmin || {}
    );
    next.overview = Object.assign(
      {
        unreadCount: 0,
        followCount: 0,
        groupCount: 0,
        monitoringCount: 0,
        favoriteCount: 0
      },
      next.overview || {}
    );
    next.groups = Array.isArray(next.groups) ? next.groups : [];
    next.follows = Array.isArray(next.follows) ? next.follows : [];
    next.articles = Array.isArray(next.articles) ? next.articles : [];
    next.exportRecords = Array.isArray(next.exportRecords) ? next.exportRecords : [];
    next.parseRecords = Array.isArray(next.parseRecords) ? next.parseRecords : [];

    if (!next.webAdmin.manageUrl) {
      next.webAdmin.manageUrl = buildManageUrl(next.token);
    }

    return next;
  }

  async function fetchJson(url) {
    if (!url || typeof fetch !== 'function') {
      throw new Error('fetch unavailable');
    }

    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller
      ? setTimeout(function () {
          controller.abort();
        }, Number(config.requestTimeoutMs || 5000))
      : 0;

    try {
      const response = await fetch(url, {
        signal: controller ? controller.signal : undefined,
        credentials: 'omit'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  async function loadSnapshot(token) {
    const loadErrors = [];
    const apiUrl = buildApiUrl(token);

    if (apiUrl) {
      try {
        const remote = await fetchJson(apiUrl);
        const snapshot = remote && (remote.snapshot || remote.data || remote);

        if (snapshot && snapshot.profile) {
          return {
            snapshot: ensureSnapshot(snapshot, token),
            source: '云接口'
          };
        }
      } catch (error) {
        loadErrors.push(`云接口加载失败：${error.message}`);
      }
    }

    try {
      const snapshot = await fetchJson(buildStaticDataUrl(token));

      if (snapshot && snapshot.profile) {
        return {
          snapshot: ensureSnapshot(snapshot, token),
          source: '静态 JSON'
        };
      }
    } catch (error) {
      loadErrors.push(`静态 JSON 加载失败：${error.message}`);
    }

    const matched = presets.find(function (item) {
      return item.token === token;
    });
    const fallback = matched || presets[0] || {};

    return {
      snapshot: ensureSnapshot(fallback, token),
      source: matched ? '演示快照' : '回退快照',
      errorMessage: loadErrors.join('；')
    };
  }

  function escapeHtml(input) {
    return String(input || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getCurrentTitle() {
    const current = NAV_ITEMS.find(function (item) {
      return item.id === state.section;
    });
    return current ? current.label : '所有文章';
  }

  function getAccounts() {
    if (!state.snapshot) {
      return [];
    }

    const names = [];
    (state.snapshot.follows || []).forEach(function (item) {
      if (item.name && names.indexOf(item.name) === -1) {
        names.push(item.name);
      }
    });

    return names;
  }

  function getGroups() {
    if (!state.snapshot) {
      return [];
    }

    return (state.snapshot.groups || []).map(function (item) {
      return item.name;
    });
  }

  function getLatestPublishedLabel() {
    if (!state.snapshot || !Array.isArray(state.snapshot.articles) || !state.snapshot.articles.length) {
      return '暂无文章';
    }

    return state.snapshot.articles[0].publishedLabel || '暂无文章';
  }

  function setRuntimeNotice(message, type) {
    state.runtimeNotice = message || '';
    state.runtimeNoticeType = type || 'info';

    if (state.noticeTimer) {
      window.clearTimeout(state.noticeTimer);
    }

    if (message) {
      state.noticeTimer = window.setTimeout(function () {
        state.runtimeNotice = '';
        state.runtimeNoticeType = 'info';
        render();
      }, 2400);
    }
  }

  function hasAppliedFilters() {
    const applied = state.filters.applied;
    return !!(
      applied.keyword ||
      applied.date ||
      (applied.account && applied.account !== 'all') ||
      (applied.group && applied.group !== 'all')
    );
  }

  function filterArticles(articles) {
    const applied = state.filters.applied;

    return (articles || []).filter(function (item) {
      const title = String(item.title || '').toLowerCase();
      const accountName = String(item.accountName || '').toLowerCase();
      const summary = String(item.summary || '').toLowerCase();
      const keyword = String(applied.keyword || '').trim().toLowerCase();
      const keywordPassed = !keyword || title.includes(keyword) || accountName.includes(keyword) || summary.includes(keyword);
      const datePassed = !applied.date || String(item.publishedLabel || '').startsWith(applied.date);
      const accountPassed = applied.account === 'all' || item.accountName === applied.account;
      const groupPassed = applied.group === 'all' || (item.groupNames || []).indexOf(applied.group) >= 0;

      return keywordPassed && datePassed && accountPassed && groupPassed;
    });
  }

  function getSectionItems() {
    if (!state.snapshot) {
      return [];
    }

    if (state.section === 'favorites') {
      return filterArticles((state.snapshot.articles || []).filter(function (item) {
        return !!item.favorite;
      }));
    }

    if (state.section === 'follows') {
      return state.snapshot.follows || [];
    }

    if (state.section === 'groups') {
      return state.snapshot.groups || [];
    }

    return filterArticles(state.snapshot.articles || []);
  }

  function getPageSize() {
    if (state.section === 'articles' || state.section === 'favorites') {
      return state.viewMode === 'table' ? 8 : 6;
    }

    return 6;
  }

  function getPageState(items) {
    const pageSize = getPageSize();
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(state.page, totalPages);
    const start = (page - 1) * pageSize;
    const currentItems = items.slice(start, start + pageSize);

    state.page = page;

    return {
      items: currentItems,
      total,
      page,
      totalPages
    };
  }

  function renderStatCards() {
    const overview = state.snapshot.overview;
    const cards = [
      ['未读文章', overview.unreadCount, '优先处理的新内容'],
      ['关注账号', overview.followCount, '当前同步的公众号'],
      ['监控开启', overview.monitoringCount, '正在自动巡检更新'],
      ['收藏文章', overview.favoriteCount, '沉淀下来的重点内容'],
      ['分组数量', overview.groupCount, '当前使用中的阅读视角']
    ];

    return cards
      .map(function (item) {
        return [
          '<div class="stat-card">',
          `  <div class="stat-card-label">${escapeHtml(item[0])}</div>`,
          `  <div class="stat-card-value">${escapeHtml(item[1])}</div>`,
          `  <div class="stat-card-note">${escapeHtml(item[2])}</div>`,
          '</div>'
        ].join('');
      })
      .join('');
  }

  function renderAppliedFilters() {
    if (state.section !== 'articles' && state.section !== 'favorites') {
      return '';
    }

    const applied = state.filters.applied;
    const chips = [];

    if (applied.keyword) {
      chips.push(`标题包含 ${applied.keyword}`);
    }
    if (applied.date) {
      chips.push(`日期 ${applied.date}`);
    }
    if (applied.account && applied.account !== 'all') {
      chips.push(`公众号 ${applied.account}`);
    }
    if (applied.group && applied.group !== 'all') {
      chips.push(`分组 ${applied.group}`);
    }

    return [
      '<div class="filter-current">',
      '  <span class="filter-current-label">当前筛选</span>',
      '  <div class="filter-pill-row">',
      chips.length
        ? chips
            .map(function (item) {
              return `<span class="filter-pill">${escapeHtml(item)}</span>`;
            })
            .join('')
        : '<span class="filter-pill filter-pill-muted">全部内容</span>',
      '  </div>',
      '</div>'
    ].join('');
  }

  function renderFilters() {
    const form = state.filters.form;
    const accounts = getAccounts();
    const groups = getGroups();

    return [
      '<section class="panel filter-panel">',
      '  <div class="filter-grid">',
      '    <label class="filter-item filter-item-wide">',
      '      <span class="filter-label">标题关键词</span>',
      `      <input id="keywordInput" class="field-control" type="text" placeholder="输入文章标题、公众号名或摘要关键词" value="${escapeHtml(form.keyword)}" />`,
      '    </label>',
      '    <label class="filter-item">',
      '      <span class="filter-label">发布日期</span>',
      `      <input id="dateInput" class="field-control" type="date" value="${escapeHtml(form.date)}" />`,
      '    </label>',
      '    <label class="filter-item">',
      '      <span class="filter-label">公众号</span>',
      '      <select id="accountSelect" class="field-control field-select">',
      '        <option value="all">全部公众号</option>',
      accounts
        .map(function (item) {
          return `<option value="${escapeHtml(item)}" ${form.account === item ? 'selected' : ''}>${escapeHtml(item)}</option>`;
        })
        .join(''),
      '      </select>',
      '    </label>',
      '    <label class="filter-item">',
      '      <span class="filter-label">阅读分组</span>',
      '      <select id="groupSelect" class="field-control field-select">',
      '        <option value="all">全部分组</option>',
      groups
        .map(function (item) {
          return `<option value="${escapeHtml(item)}" ${form.group === item ? 'selected' : ''}>${escapeHtml(item)}</option>`;
        })
        .join(''),
      '      </select>',
      '    </label>',
      '    <div class="filter-action">',
      '      <button id="searchButton" class="primary-button" type="button">应用筛选</button>',
      '      <button id="resetFilterButton" class="secondary-button" type="button">重置筛选</button>',
      '    </div>',
      '  </div>',
      renderAppliedFilters(),
      '</section>'
    ].join('');
  }

  function renderToolbar() {
    const items = getSectionItems();
    const countLabel = `当前共 ${items.length} 条${state.section === 'groups' ? '分组' : state.section === 'follows' ? '关注' : '内容'}`;

    return [
      '<section class="panel panel-compact toolbar-panel">',
      '  <div class="toolbar-meta">',
      `    <div class="toolbar-title">${escapeHtml(countLabel)}</div>`,
      `    <div class="toolbar-note">${escapeHtml(renderSectionIntro())}</div>`,
      '  </div>',
      (state.section === 'articles' || state.section === 'favorites')
        ? [
            '  <div class="view-switch">',
            `    <button class="view-button ${state.viewMode === 'card' ? 'active' : ''}" data-view="card" type="button">卡片视图</button>`,
            `    <button class="view-button ${state.viewMode === 'table' ? 'active' : ''}" data-view="table" type="button">表格视图</button>`,
            '  </div>'
          ].join('')
        : '<div class="toolbar-badge">列表视图</div>',
      '</section>'
    ].join('');
  }

  function renderLoadingCard(text) {
    return [
      '<section class="panel content-panel loading-panel">',
      '  <div class="spinner"></div>',
      `  <div class="loading-text">${escapeHtml(text || '加载中...')}</div>`,
      '</section>'
    ].join('');
  }

  function renderArticleCards(items) {
    if (!items.length) {
      return '<div class="empty-state">当前筛选条件下没有文章，试试放宽关键词或切换分组。</div>';
    }

    return items
      .map(function (item) {
        return [
          '<article class="content-card">',
          '  <div class="content-card-head">',
          '    <div>',
          `      <div class="content-card-title">${escapeHtml(item.title)}</div>`,
          `      <div class="content-card-meta">${escapeHtml(item.accountName)} · ${escapeHtml(item.publishedLabel)}</div>`,
          '    </div>',
          `    <div class="status-badge ${item.read ? 'muted' : ''}">${item.read ? '已读' : '未读'}</div>`,
          '  </div>',
          `  <div class="content-card-summary">${escapeHtml(item.summary || '')}</div>`,
          `  <div class="content-card-tags">${(item.groupNames || [])
            .map(function (tag) {
              return `<span class="tag-chip">${escapeHtml(tag)}</span>`;
            })
            .join('')}</div>`,
          '  <div class="content-card-foot">',
          `    <span class="meta-flag">${item.favorite ? '已收藏' : '未收藏'}</span>`,
          `    <a class="inline-link" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">查看原文</a>`,
          '  </div>',
          '</article>'
        ].join('');
      })
      .join('');
  }

  function renderArticleTable(items) {
    if (!items.length) {
      return '<div class="empty-state">当前筛选条件下没有文章，试试放宽关键词或切换分组。</div>';
    }

    return [
      '<div class="table-shell">',
      '  <table class="data-table">',
      '    <thead>',
      '      <tr>',
      '        <th>标题</th>',
      '        <th>公众号</th>',
      '        <th>日期</th>',
      '        <th>分组</th>',
      '        <th>状态</th>',
      '        <th>操作</th>',
      '      </tr>',
      '    </thead>',
      '    <tbody>',
      items
        .map(function (item) {
          return [
            '      <tr>',
            `        <td class="table-title-cell">${escapeHtml(item.title)}</td>`,
            `        <td>${escapeHtml(item.accountName)}</td>`,
            `        <td>${escapeHtml(item.publishedLabel)}</td>`,
            `        <td>${escapeHtml((item.groupNames || []).join(' / ') || '未分组')}</td>`,
            `        <td>${item.read ? '已读' : '未读'}${item.favorite ? ' · 收藏' : ''}</td>`,
            `        <td><a class="inline-link" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">查看</a></td>`,
            '      </tr>'
          ].join('');
        })
        .join(''),
      '    </tbody>',
      '  </table>',
      '</div>'
    ].join('');
  }

  function renderFollows(items) {
    if (!items.length) {
      return '<div class="empty-state">当前没有关注公众号，可以先从小程序里导入后再到这里统一管理。</div>';
    }

    return items
      .map(function (item) {
        return [
          '<article class="content-card content-card-simple">',
          '  <div class="content-card-head">',
          `    <div class="content-card-title">${escapeHtml(item.name)}</div>`,
          `    <div class="status-badge ${item.monitoringLabel.indexOf('未监控') >= 0 ? 'muted' : ''}">${escapeHtml(item.monitoringLabel)}</div>`,
          '  </div>',
          `  <div class="content-card-summary">${escapeHtml(item.description || '')}</div>`,
          `  <div class="content-card-tags">${(item.groupNames || [])
            .map(function (tag) {
              return `<span class="tag-chip">${escapeHtml(tag)}</span>`;
            })
            .join('')}</div>`,
          `  <div class="content-card-meta solo">添加时间：${escapeHtml(item.createdLabel || '')}</div>`,
          '</article>'
        ].join('');
      })
      .join('');
  }

  function renderGroups(items) {
    if (!items.length) {
      return '<div class="empty-state">当前没有分组，可以先在小程序里建立分组规则再回到这里查看。</div>';
    }

    return items
      .map(function (item) {
        return [
          '<article class="content-card content-card-simple">',
          '  <div class="content-card-head">',
          `    <div class="content-card-title">${escapeHtml(item.name)}</div>`,
          `    <div class="status-badge">${escapeHtml(item.articleCount)} 篇</div>`,
          '  </div>',
          `  <div class="content-card-summary">${escapeHtml(item.note || '')}</div>`,
          '  <div class="group-rules">',
          `    <div><strong>包含：</strong>${escapeHtml(item.includeKeywordsText || '无')}</div>`,
          `    <div><strong>排除：</strong>${escapeHtml(item.excludeKeywordsText || '无')}</div>`,
          '  </div>',
          '</article>'
        ].join('');
      })
      .join('');
  }

  function renderContentPanel() {
    if (state.isLoading) {
      return renderLoadingCard('正在整理页面内容，请稍候...');
    }

    const items = getSectionItems();
    const pageState = getPageState(items);
    let body = '';

    if (state.section === 'articles' || state.section === 'favorites') {
      body = state.viewMode === 'table' ? renderArticleTable(pageState.items) : renderArticleCards(pageState.items);
    } else if (state.section === 'follows') {
      body = renderFollows(pageState.items);
    } else {
      body = renderGroups(pageState.items);
    }

    return [
      '<section class="panel content-panel">',
      `  <div class="content-list ${state.viewMode === 'table' ? 'table-mode' : ''}">${body}</div>`,
      '  <div class="pagination-bar">',
      `    <button class="page-button" data-page-action="prev" type="button" ${pageState.page <= 1 ? 'disabled' : ''}>上一页</button>`,
      `    <button class="page-button" data-page-action="next" type="button" ${pageState.page >= pageState.totalPages ? 'disabled' : ''}>下一页</button>`,
      `    <span class="page-summary">共 ${pageState.total} 条记录，第 ${pageState.page} / ${pageState.totalPages} 页</span>`,
      '  </div>',
      '</section>'
    ].join('');
  }

  function renderStatusNotice() {
    const snapshotTime = state.snapshot && state.snapshot.generatedAt ? state.snapshot.generatedAt : '未同步';
    const noticeText = state.errorMessage || state.runtimeNotice || `数据源：${state.loadSource || '未连接'} · 最近更新 ${snapshotTime}`;
    const noticeClass = state.errorMessage
      ? 'status-notice error'
      : state.runtimeNoticeType === 'success'
        ? 'status-notice success'
        : 'status-notice';

    return `<div class="${noticeClass}">${escapeHtml(noticeText)}</div>`;
  }

  function renderSectionIntro() {
    if (state.section === 'follows') {
      return '集中查看当前已关注的公众号、所属分组和监控状态。';
    }

    if (state.section === 'favorites') {
      return '把值得反复回看的重点内容单独沉淀出来，方便二次查找。';
    }

    if (state.section === 'groups') {
      return '按分组检查命中规则、文章规模和阅读主题划分。';
    }

    return '按标题、日期、公众号和分组多维筛选，快速定位真正值得阅读的文章。';
  }

  function renderWorkspacePanel() {
    const profile = state.snapshot.profile || {};
    const membership = state.snapshot.membership || {};
    const preferences = state.snapshot.preferences || {};
    const webAdmin = state.snapshot.webAdmin || {};
    const overview = state.snapshot.overview || {};
    const manageUrl = webAdmin.manageUrl || buildManageUrl(state.token);

    return [
      '<section class="panel workspace-panel">',
      '  <div class="workspace-layout">',
      '    <div class="workspace-main">',
      '      <div class="workspace-eyebrow">当前工作台</div>',
      `      <div class="workspace-user">${escapeHtml(profile.nickname || '演示账号')} <span class="workspace-id">ID: ${escapeHtml(profile.userId || 'demo-user')}</span></div>`,
      `      <div class="workspace-membership">${escapeHtml(membership.membershipLabel || '基础会员')} · ${escapeHtml(membership.statusLabel || '演示模式')} · ${escapeHtml(membership.expireAtLabel || '未连接真实服务')}</div>`,
      `      <div class="workspace-detail">${escapeHtml(membership.detail || '已为你整理关注、分组、筛选与收藏数据。')}</div>`,
      '      <div class="workspace-pills">',
      `        <span class="info-pill">首页封面 ${preferences.showHomeCover ? '开启' : '关闭'}</span>`,
      `        <span class="info-pill">阅读字体 ${escapeHtml(preferences.readingFontLabel || '默认')}</span>`,
      `        <span class="info-pill">最新文章 ${escapeHtml(getLatestPublishedLabel())}</span>`,
      `        <span class="info-pill">监控中 ${escapeHtml(overview.monitoringCount || 0)} 个账号</span>`,
      '      </div>',
      '    </div>',
      '    <div class="workspace-side">',
      '      <div class="workspace-side-title">WEB 管理链接</div>',
      `      <div class="workspace-link">${escapeHtml(manageUrl)}</div>`,
      `      <div class="workspace-side-note">WebHook：${escapeHtml(webAdmin.webhookStatusLabel || '未开启')} · ${escapeHtml(webAdmin.webhookDescription || '')}</div>`,
      '      <div class="workspace-actions">',
      '        <button id="refreshSnapshotButton" class="secondary-button" type="button">刷新数据</button>',
      '        <button id="copyManageLinkButton" class="primary-button" type="button">复制链接</button>',
      `        <a class="ghost-button anchor-button" href="${escapeHtml(manageUrl)}" target="_blank" rel="noreferrer">打开页面</a>`,
      '      </div>',
      '    </div>',
      '  </div>',
      '</section>'
    ].join('');
  }

  function renderShell() {
    if (!state.snapshot) {
      return renderLoadingCard('正在初始化页面，请稍候。');
    }

    return [
      `<div class="dashboard ${state.sidebarCollapsed ? 'sidebar-collapsed' : ''}">`,
      '  <aside class="sidebar">',
      '    <div class="sidebar-brand">',
      '      <div class="brand-icon">阅</div>',
      '      <div>',
      '        <div class="brand-name">专属信息茧房</div>',
      '        <div class="brand-subtitle">WEB 管理端</div>',
      '      </div>',
      '    </div>',
      '    <nav class="sidebar-nav">',
      NAV_ITEMS
        .map(function (item) {
          return [
            `<button class="nav-item ${state.section === item.id ? 'active' : ''}" data-section="${item.id}" type="button">`,
            `  <span class="nav-icon">${escapeHtml(item.icon)}</span>`,
            `  <span class="nav-label">${escapeHtml(item.label)}</span>`,
            '</button>'
          ].join('');
        })
        .join(''),
      '    </nav>',
      '    <div class="sidebar-footer">',
      `      <div class="sidebar-footer-line">会员：${escapeHtml(state.snapshot.membership.membershipLabel)}</div>`,
      `      <div class="sidebar-footer-line">状态：${escapeHtml(state.snapshot.membership.expireAtLabel)}</div>`,
      `      <div class="sidebar-footer-line">用户：${escapeHtml(state.snapshot.profile.nickname)}</div>`,
      '    </div>',
      '  </aside>',
      '  <main class="main-area">',
      '    <header class="topbar">',
      '      <button id="toggleSidebarButton" class="toggle-button" type="button">◀</button>',
      '      <div>',
      `        <div class="topbar-caption">专属信息茧房 · Web Workspace</div>`,
      `        <h1 class="topbar-title">${escapeHtml(getCurrentTitle())}</h1>`,
      `        <div class="topbar-subtitle">${escapeHtml(renderSectionIntro())}</div>`,
      '      </div>',
      renderStatusNotice(),
      '    </header>',
      renderWorkspacePanel(),
      '    <section class="overview-row">',
      renderStatCards(),
      '    </section>',
      (state.section === 'articles' || state.section === 'favorites') ? renderFilters() : '',
      renderToolbar(),
      renderContentPanel(),
      '  </main>',
      '</div>'
    ].join('');
  }

  function render() {
    document.title = `${getCurrentTitle()} - 公众号分组阅读 Web 管理端`;
    document.getElementById('app').innerHTML = renderShell();
    bindEvents();
  }

  function updateFilterForm(field, value) {
    state.filters.form[field] = value;
  }

  function applySearch() {
    state.filters.applied = clone(state.filters.form);
    state.page = 1;
    state.isLoading = true;
    render();
    window.setTimeout(function () {
      state.isLoading = false;
      render();
    }, 220);
  }

  function resetFilters() {
    state.filters.form = {
      keyword: '',
      date: '',
      account: 'all',
      group: 'all'
    };
    state.filters.applied = clone(state.filters.form);
    state.page = 1;
    setRuntimeNotice('筛选条件已重置。', 'success');
    render();
  }

  function switchSection(section) {
    state.section = section;
    state.page = 1;
    state.isLoading = true;
    render();
    window.setTimeout(function () {
      state.isLoading = false;
      render();
    }, 160);
  }

  async function refreshSnapshot() {
    state.isLoading = true;
    state.errorMessage = '';
    render();

    const result = await loadSnapshot(state.token);
    state.snapshot = result.snapshot;
    state.loadSource = result.source;
    state.errorMessage = result.errorMessage || '';
    state.isLoading = false;

    if (!state.errorMessage) {
      setRuntimeNotice('数据快照已刷新。', 'success');
    }

    render();
  }

  async function copyManageLink() {
    const webAdmin = state.snapshot && state.snapshot.webAdmin ? state.snapshot.webAdmin : {};
    const manageUrl = webAdmin.manageUrl || buildManageUrl(state.token);

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(manageUrl);
        setRuntimeNotice('管理链接已复制，可直接发送给用户。', 'success');
        render();
        return;
      }
    } catch (error) {
      // Fallback below.
    }

    window.prompt('请复制下面的管理链接', manageUrl);
    setRuntimeNotice('当前浏览器不支持自动复制，已切换为手动复制。', 'info');
    render();
  }

  function bindEvents() {
    document.querySelectorAll('[data-section]').forEach(function (element) {
      element.addEventListener('click', function () {
        switchSection(element.getAttribute('data-section'));
      });
    });

    const keywordInput = document.getElementById('keywordInput');
    const dateInput = document.getElementById('dateInput');
    const accountSelect = document.getElementById('accountSelect');
    const groupSelect = document.getElementById('groupSelect');
    const searchButton = document.getElementById('searchButton');
    const resetFilterButton = document.getElementById('resetFilterButton');
    const toggleSidebarButton = document.getElementById('toggleSidebarButton');
    const refreshSnapshotButton = document.getElementById('refreshSnapshotButton');
    const copyManageLinkButton = document.getElementById('copyManageLinkButton');

    if (keywordInput) {
      keywordInput.addEventListener('input', function (event) {
        updateFilterForm('keyword', event.target.value);
      });
      keywordInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          applySearch();
        }
      });
    }

    if (dateInput) {
      dateInput.addEventListener('change', function (event) {
        updateFilterForm('date', event.target.value);
      });
    }

    if (accountSelect) {
      accountSelect.addEventListener('change', function (event) {
        updateFilterForm('account', event.target.value);
      });
    }

    if (groupSelect) {
      groupSelect.addEventListener('change', function (event) {
        updateFilterForm('group', event.target.value);
      });
    }

    if (searchButton) {
      searchButton.addEventListener('click', function () {
        applySearch();
      });
    }

    if (resetFilterButton) {
      resetFilterButton.addEventListener('click', function () {
        resetFilters();
      });
    }

    if (toggleSidebarButton) {
      toggleSidebarButton.addEventListener('click', function () {
        state.sidebarCollapsed = !state.sidebarCollapsed;
        render();
      });
    }

    if (refreshSnapshotButton) {
      refreshSnapshotButton.addEventListener('click', function () {
        refreshSnapshot();
      });
    }

    if (copyManageLinkButton) {
      copyManageLinkButton.addEventListener('click', function () {
        copyManageLink();
      });
    }

    document.querySelectorAll('[data-view]').forEach(function (element) {
      element.addEventListener('click', function () {
        state.viewMode = element.getAttribute('data-view');
        state.page = 1;
        render();
      });
    });

    document.querySelectorAll('[data-page-action]').forEach(function (element) {
      element.addEventListener('click', function () {
        const action = element.getAttribute('data-page-action');
        state.page = action === 'prev' ? Math.max(1, state.page - 1) : state.page + 1;
        render();
      });
    });
  }

  async function bootstrap() {
    state.token = resolveToken();
    render();

    const result = await loadSnapshot(state.token);
    state.snapshot = result.snapshot;
    state.loadSource = result.source;
    state.errorMessage = result.errorMessage || '';
    state.isLoading = false;
    render();
  }

  bootstrap();
})();
