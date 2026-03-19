(function () {
  const presets = window.WEB_ADMIN_PRESETS || [];
  const config = Object.assign(
    {
      apiBaseUrl: '',
      actionBaseUrl: '',
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

  function buildActionUrl() {
    const explicit = String(config.actionBaseUrl || '').trim();

    if (explicit) {
      return explicit;
    }

    const apiBase = String(config.apiBaseUrl || '').trim();

    if (!apiBase) {
      return '';
    }

    const parts = apiBase.split('?');
    const path = parts[0] || '';
    const query = parts[1] ? `?${parts[1]}` : '';

    if (path.endsWith('/snapshot')) {
      return `${path.replace(/\/snapshot$/, '/action')}${query}`;
    }

    return apiBase;
  }

  function buildManageUrl(token) {
    const origin = window.location.origin || '';
    const pathname = window.location.pathname || '/';
    const basePath = pathname.replace(/\/[^/]*$/, '/index.html');
    return `${origin}${basePath}?token=${encodeURIComponent(token)}`;
  }

  function extractMonitoringTimes(label) {
    const match = String(label || '').match(/(\d+)\s*次\/天/);
    return match ? Number(match[1] || 0) : 0;
  }

  function formatReadingFontLabel(value) {
    if (value === 'large') {
      return '大字体';
    }

    if (value === 'xlarge') {
      return '特大字体';
    }

    return '默认';
  }

  function formatNowLabel() {
    const now = new Date();
    const pad = function (value) {
      return value < 10 ? `0${value}` : `${value}`;
    };

    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }

  function isFollowMonitoringEnabled(item) {
    if (!item) {
      return false;
    }

    if (typeof item.monitoringEnabled === 'boolean') {
      return item.monitoringEnabled;
    }

    return String(item.monitoringLabel || '').indexOf('已监控') === 0;
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
    next.follows = Array.isArray(next.follows)
      ? next.follows.map(function (item) {
          const follow = Object.assign({}, item || {});
          follow.groupNames = Array.isArray(follow.groupNames) ? follow.groupNames : [];
          follow.monitoringEnabled = isFollowMonitoringEnabled(follow);
          follow.monitoringTimesPerDay = Number(follow.monitoringTimesPerDay || extractMonitoringTimes(follow.monitoringLabel)) || 0;
          follow.monitoringLabel = follow.monitoringEnabled
            ? `已监控 · ${follow.monitoringTimesPerDay || 24} 次/天`
            : '未监控';
          return follow;
        })
      : [];
    next.articles = Array.isArray(next.articles)
      ? next.articles.map(function (item) {
          return Object.assign(
            {
              read: false,
              favorite: false,
              groupNames: []
            },
            item || {}
          );
        })
      : [];
    next.exportRecords = Array.isArray(next.exportRecords) ? next.exportRecords : [];
    next.parseRecords = Array.isArray(next.parseRecords) ? next.parseRecords : [];
    next.preferences.readingFontSize = next.preferences.readingFontSize || 'default';
    next.preferences.readingFontLabel = formatReadingFontLabel(next.preferences.readingFontSize);

    if (!next.webAdmin.manageUrl) {
      next.webAdmin.manageUrl = buildManageUrl(next.token);
    }

    return rebuildOverview(next);
  }

  function rebuildOverview(snapshot) {
    const next = snapshot || {};
    const articles = Array.isArray(next.articles) ? next.articles : [];
    const follows = Array.isArray(next.follows) ? next.follows : [];
    const groups = Array.isArray(next.groups) ? next.groups : [];

    next.overview = Object.assign({}, next.overview || {}, {
      unreadCount: articles.filter(function (item) {
        return !item.read;
      }).length,
      followCount: follows.length,
      groupCount: groups.length,
      monitoringCount: follows.filter(function (item) {
        return isFollowMonitoringEnabled(item);
      }).length,
      favoriteCount: articles.filter(function (item) {
        return !!item.favorite;
      }).length
    });

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

  async function postJson(url, data) {
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
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data || {}),
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

  function getArticleById(articleId) {
    return (state.snapshot && state.snapshot.articles || []).find(function (item) {
      return item.id === articleId;
    }) || null;
  }

  function getFollowById(followId) {
    return (state.snapshot && state.snapshot.follows || []).find(function (item) {
      return item.id === followId;
    }) || null;
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
      }, 2600);
    }
  }

  function mutateLocalSnapshot(mutation, payload) {
    if (!state.snapshot) {
      return;
    }

    const next = ensureSnapshot(clone(state.snapshot), state.token);

    if (mutation === 'updatePreferences') {
      if (Object.prototype.hasOwnProperty.call(payload, 'showHomeCover')) {
        next.preferences.showHomeCover = payload.showHomeCover !== false;
      }

      if (Object.prototype.hasOwnProperty.call(payload, 'readingFontSize')) {
        next.preferences.readingFontSize = payload.readingFontSize || 'default';
        next.preferences.readingFontLabel = formatReadingFontLabel(next.preferences.readingFontSize);
      }
    }

    if (mutation === 'toggleArticleRead' || mutation === 'toggleArticleFavorite') {
      next.articles = next.articles.map(function (item) {
        if (item.id !== payload.articleId) {
          return item;
        }

        const article = Object.assign({}, item);

        if (mutation === 'toggleArticleRead') {
          article.read = Object.prototype.hasOwnProperty.call(payload, 'read') ? !!payload.read : !article.read;
        } else {
          article.favorite = Object.prototype.hasOwnProperty.call(payload, 'favorite') ? !!payload.favorite : !article.favorite;
        }

        return article;
      });
    }

    if (mutation === 'toggleFollowMonitoring') {
      next.follows = next.follows.map(function (item) {
        if (item.id !== payload.followId) {
          return item;
        }

        const follow = Object.assign({}, item);
        const nextEnabled = Object.prototype.hasOwnProperty.call(payload, 'enabled')
          ? !!payload.enabled
          : !isFollowMonitoringEnabled(follow);
        const timesPerDay = Number(payload.timesPerDay || follow.monitoringTimesPerDay || 24) || 24;

        follow.monitoringEnabled = nextEnabled;
        follow.monitoringTimesPerDay = nextEnabled ? timesPerDay : 0;
        follow.monitoringLabel = nextEnabled ? `已监控 · ${timesPerDay} 次/天` : '未监控';
        return follow;
      });
    }

    next.generatedAt = formatNowLabel();
    state.snapshot = rebuildOverview(next);
  }

  async function runMutation(mutation, data, successMessage) {
    const actionUrl = buildActionUrl();

    try {
      if (actionUrl) {
        const response = await postJson(actionUrl, {
          token: state.token,
          mutation,
          data: data || {}
        });

        if (!response || response.ok === false) {
          throw new Error(response && response.message ? response.message : '更新失败');
        }

        const snapshot = response.snapshot || response.data || null;

        if (snapshot && snapshot.profile) {
          state.snapshot = ensureSnapshot(snapshot, state.token);
        } else {
          mutateLocalSnapshot(mutation, data || {});
        }

        state.errorMessage = '';
        setRuntimeNotice(successMessage, 'success');
      } else {
        mutateLocalSnapshot(mutation, data || {});
        setRuntimeNotice(`${successMessage} 当前为演示模式，已在页面内本地生效。`, 'success');
      }
    } catch (error) {
      setRuntimeNotice(`操作失败：${error && error.message ? error.message : '请稍后重试'}`, 'error');
    }

    render();
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

  function renderArticleActions(item) {
    return [
      '<div class="content-card-actions">',
      `  <button class="mini-action ${item.read ? 'active' : ''}" data-article-read="${escapeHtml(item.id)}" type="button">${item.read ? '标记未读' : '标记已读'}</button>`,
      `  <button class="mini-action ${item.favorite ? 'active' : ''}" data-article-favorite="${escapeHtml(item.id)}" type="button">${item.favorite ? '取消收藏' : '加入收藏'}</button>`,
      '</div>'
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
          renderArticleActions(item),
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
            `        <td><div class="table-actions"><button class="table-action ${item.read ? 'active' : ''}" data-article-read="${escapeHtml(item.id)}" type="button">${item.read ? '未读' : '已读'}</button><button class="table-action ${item.favorite ? 'active' : ''}" data-article-favorite="${escapeHtml(item.id)}" type="button">${item.favorite ? '取消收藏' : '收藏'}</button><a class="inline-link" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">查看</a></div></td>`,
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
        const monitoringEnabled = isFollowMonitoringEnabled(item);
        return [
          '<article class="content-card content-card-simple">',
          '  <div class="content-card-head">',
          `    <div class="content-card-title">${escapeHtml(item.name)}</div>`,
          `    <div class="status-badge ${monitoringEnabled ? '' : 'muted'}">${escapeHtml(item.monitoringLabel)}</div>`,
          '  </div>',
          `  <div class="content-card-summary">${escapeHtml(item.description || '')}</div>`,
          `  <div class="content-card-tags">${(item.groupNames || [])
            .map(function (tag) {
              return `<span class="tag-chip">${escapeHtml(tag)}</span>`;
            })
            .join('')}</div>`,
          `  <div class="content-card-meta solo">添加时间：${escapeHtml(item.createdLabel || '')}</div>`,
          '  <div class="content-card-foot">',
          `    <span class="meta-flag">${item.groupNames && item.groupNames.length ? `已归类 ${item.groupNames.length} 个分组` : '暂未分组'}</span>`,
          `    <button class="mini-action ${monitoringEnabled ? 'active' : ''}" data-follow-monitor="${escapeHtml(item.id)}" type="button">${monitoringEnabled ? '暂停监控' : '开启监控'}</button>`,
          '  </div>',
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
    const noticeClass = state.errorMessage || state.runtimeNoticeType === 'error'
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

  function renderSettingsPanel() {
    const preferences = state.snapshot.preferences || {};
    const fontSize = preferences.readingFontSize || 'default';

    return [
      '<div class="settings-card">',
      '  <div class="workspace-side-title">内容设置</div>',
      '  <div class="setting-row">',
      '    <div>',
      '      <div class="setting-label">首页封面显示</div>',
      '      <div class="setting-desc">控制小程序首页顶部信息卡是否展示</div>',
      '    </div>',
      `    <button class="switch-chip ${preferences.showHomeCover ? 'active' : ''}" data-toggle-cover="1" type="button">${preferences.showHomeCover ? '已开启' : '已关闭'}</button>`,
      '  </div>',
      '  <div class="setting-row setting-row-stack">',
      '    <div>',
      '      <div class="setting-label">阅读字体</div>',
      '      <div class="setting-desc">同步到小程序的阅读字号偏好</div>',
      '    </div>',
      '    <div class="setting-chip-row">',
      `      <button class="setting-chip ${fontSize === 'default' ? 'active' : ''}" data-font-size="default" type="button">默认</button>`,
      `      <button class="setting-chip ${fontSize === 'large' ? 'active' : ''}" data-font-size="large" type="button">大字体</button>`,
      `      <button class="setting-chip ${fontSize === 'xlarge' ? 'active' : ''}" data-font-size="xlarge" type="button">特大字体</button>`,
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');
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
      renderSettingsPanel(),
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
      '        <div class="topbar-caption">专属信息茧房 · Web Workspace</div>',
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

    document.querySelectorAll('[data-toggle-cover]').forEach(function (element) {
      element.addEventListener('click', function () {
        const preferences = state.snapshot && state.snapshot.preferences ? state.snapshot.preferences : {};
        runMutation('updatePreferences', {
          showHomeCover: !(preferences.showHomeCover !== false)
        }, '内容设置已更新。');
      });
    });

    document.querySelectorAll('[data-font-size]').forEach(function (element) {
      element.addEventListener('click', function () {
        const nextSize = element.getAttribute('data-font-size') || 'default';
        runMutation('updatePreferences', {
          readingFontSize: nextSize
        }, '阅读字体已更新。');
      });
    });

    document.querySelectorAll('[data-article-read]').forEach(function (element) {
      element.addEventListener('click', function () {
        const articleId = element.getAttribute('data-article-read') || '';
        const article = getArticleById(articleId);

        if (!article) {
          return;
        }

        runMutation('toggleArticleRead', {
          articleId,
          read: !article.read
        }, article.read ? '已改回未读状态。' : '已标记为已读。');
      });
    });

    document.querySelectorAll('[data-article-favorite]').forEach(function (element) {
      element.addEventListener('click', function () {
        const articleId = element.getAttribute('data-article-favorite') || '';
        const article = getArticleById(articleId);

        if (!article) {
          return;
        }

        runMutation('toggleArticleFavorite', {
          articleId,
          favorite: !article.favorite
        }, article.favorite ? '已取消收藏。' : '已加入收藏。');
      });
    });

    document.querySelectorAll('[data-follow-monitor]').forEach(function (element) {
      element.addEventListener('click', function () {
        const followId = element.getAttribute('data-follow-monitor') || '';
        const follow = getFollowById(followId);

        if (!follow) {
          return;
        }

        const enabled = isFollowMonitoringEnabled(follow);
        runMutation('toggleFollowMonitoring', {
          followId,
          enabled: !enabled,
          timesPerDay: follow.monitoringTimesPerDay || 24
        }, enabled ? '公众号监控已暂停。' : '公众号监控已开启。');
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
