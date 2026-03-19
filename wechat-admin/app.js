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

  const state = {
    token: '',
    snapshot: null,
    keyword: '',
    group: 'all',
    account: 'all',
    readStatus: 'all',
    loadSource: '',
    errorMessage: ''
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

  function renderPills(items) {
    return items
      .map(function (item) {
        return `<span class="pill ${item.muted ? 'muted' : ''}">${escapeHtml(item.label)}</span>`;
      })
      .join('');
  }

  function uniqueOptions(list, key) {
    const values = [];

    list.forEach(function (item) {
      const value = item[key];
      if (value && values.indexOf(value) === -1) {
        values.push(value);
      }
    });

    return values;
  }

  function applyFilters(articles) {
    return articles.filter(function (item) {
      const keyword = state.keyword.trim().toLowerCase();
      const keywordPassed =
        !keyword ||
        item.title.toLowerCase().includes(keyword) ||
        item.accountName.toLowerCase().includes(keyword) ||
        (item.summary || '').toLowerCase().includes(keyword);
      const groupPassed = state.group === 'all' || (item.groupNames || []).indexOf(state.group) >= 0;
      const accountPassed = state.account === 'all' || item.accountName === state.account;
      const readPassed = state.readStatus === 'all' || (state.readStatus === 'read' ? item.read : !item.read);
      return keywordPassed && groupPassed && accountPassed && readPassed;
    });
  }

  function renderArticleCard(article) {
    return [
      '<article class="article-card">',
      '  <div class="article-top">',
      '    <div>',
      `      <div class="article-title">${escapeHtml(article.title)}</div>`,
      '      <div class="article-meta">',
      `        <span>${escapeHtml(article.accountName)}</span>`,
      `        <span>${escapeHtml(article.publishedLabel)}</span>`,
      `        <span>${article.read ? '已读' : '未读'}</span>`,
      `        <span>${article.favorite ? '已收藏' : '未收藏'}</span>`,
      '      </div>',
      '    </div>',
      `    <span class="pill ${article.read ? 'muted' : ''}">${article.read ? '已读' : '未读'}</span>`,
      '  </div>',
      `  <div class="article-summary">${escapeHtml(article.summary)}</div>`,
      `  <div class="tag-row">${(article.groupNames || [])
        .map(function (name) {
          return `<span class="tag">${escapeHtml(name)}</span>`;
        })
        .join('')}</div>`,
      `  <a class="link" href="${escapeHtml(article.url)}" target="_blank" rel="noreferrer">查看原文</a>`,
      '</article>'
    ].join('');
  }

  function renderListCard(title, meta, copy, tags) {
    return [
      '<article class="list-card">',
      '  <div class="item-top">',
      '    <div>',
      `      <div class="article-title">${escapeHtml(title)}</div>`,
      `      <div class="item-meta">${meta
        .map(function (item) {
          return `<span>${escapeHtml(item)}</span>`;
        })
        .join('')}</div>`,
      '    </div>',
      '  </div>',
      `  <div class="item-copy">${escapeHtml(copy)}</div>`,
      `  <div class="tag-row">${(tags || [])
        .map(function (item) {
          return `<span class="tag">${escapeHtml(item)}</span>`;
        })
        .join('')}</div>`,
      '</article>'
    ].join('');
  }

  function renderLoading() {
    document.getElementById('app').innerHTML = [
      '<div class="dashboard-shell">',
      '  <aside class="sidebar">',
      '    <div class="brand-mark">茧</div>',
      '    <div class="brand-title">WEB 管理端</div>',
      '    <div class="brand-copy">正在为你加载公众号管理数据...</div>',
      '  </aside>',
      '  <main class="main-panel">',
      '    <div class="empty">正在初始化页面，请稍候。</div>',
      '  </main>',
      '</div>'
    ].join('');
  }

  function render() {
    const snapshot = state.snapshot;
    const filteredArticles = applyFilters(snapshot.articles || []);
    const groupOptions = uniqueOptions(snapshot.groups || [], 'name');
    const accountOptions = uniqueOptions(snapshot.articles || [], 'accountName');

    document.getElementById('app').innerHTML = [
      '<div class="dashboard-shell">',
      '  <aside class="sidebar">',
      '    <div class="brand-mark">茧</div>',
      '    <div class="brand-title">WEB 管理端</div>',
      '    <div class="brand-copy">围绕公众号分组阅读、导出和会员状态整理出的桌面工作台。部署后可以作为用户专属的管理入口。</div>',
      `    <div class="sidebar-pills">${renderPills([
        { label: snapshot.membership.membershipLabel },
        { label: snapshot.membership.statusLabel },
        { label: `数据源 ${state.loadSource}` },
        { label: `Token ${state.token.slice(0, 8)}...`, muted: true }
      ])}</div>`,
      '    <div class="sidebar-note">',
      `      <div>用户 ID：${escapeHtml(snapshot.profile.userId)}</div>`,
      `      <div>管理地址：${escapeHtml(snapshot.webAdmin.manageUrl)}</div>`,
      `      <div>生成时间：${escapeHtml(snapshot.generatedAt)}</div>`,
      `      <div style="margin-top:12px;">${escapeHtml(snapshot.webAdmin.webhookDescription)}</div>`,
      state.errorMessage
        ? `      <div style="margin-top:12px; color:#c25b3f;">${escapeHtml(state.errorMessage)}</div>`
        : '',
      '    </div>',
      '  </aside>',
      '  <main class="main-panel">',
      '    <section class="hero">',
      '      <div class="hero-card">',
      '        <div class="hero-eyebrow">Official Account Organizer</div>',
      `        <div class="hero-title">${escapeHtml(snapshot.profile.nickname)} 的公众号管理台</div>`,
      '        <div class="hero-copy">把关注、分组、筛选、导出和会员状态统一收口到桌面端，让公众号阅读从翻列表变成按主题工作。</div>',
      `        <div class="hero-meta">${renderPills([
        { label: snapshot.membership.expireAtLabel },
        { label: snapshot.preferences.showHomeCover ? '首页封面开启' : '首页封面关闭' },
        { label: `字体 ${snapshot.preferences.readingFontLabel}` }
      ])}</div>`,
      '      </div>',
      '      <div class="hero-panel card">',
      '        <div class="hero-panel-title">当前会员状态</div>',
      `        <div class="hero-panel-value">${escapeHtml(snapshot.membership.statusLabel)}</div>`,
      `        <div class="hero-panel-copy">${escapeHtml(snapshot.membership.detail)}</div>`,
      `        <div class="hero-panel-copy">Webhook：${escapeHtml(snapshot.webAdmin.webhookStatusLabel)}</div>`,
      '      </div>',
      '    </section>',
      '    <section class="stats-grid">',
      [
        ['未读文章', snapshot.overview.unreadCount, '帮助用户优先处理真正还没看的更新。'],
        ['已关注公众号', snapshot.overview.followCount, '和小程序中的关注池保持同一套口径。'],
        ['分组数量', snapshot.overview.groupCount, '按主题、行业或关注目标做内容切片。'],
        ['监控中的公众号', snapshot.overview.monitoringCount, '支持把重要账号单独放到高频追踪列表。'],
        ['收藏文章', snapshot.overview.favoriteCount, '沉淀值得回看的重点内容。']
      ]
        .map(function (item) {
          return [
            '<article class="card">',
            `  <div class="stat-label">${escapeHtml(item[0])}</div>`,
            `  <div class="stat-value">${escapeHtml(item[1])}</div>`,
            `  <div class="stat-copy">${escapeHtml(item[2])}</div>`,
            '</article>'
          ].join('');
        })
        .join(''),
      '    </section>',
      '    <section class="content-grid">',
      '      <div class="card">',
      '        <div class="section-head">',
      '          <div>',
      '            <div class="section-title">文章管理</div>',
      '            <div class="section-copy">按标题、分组、公众号和已读状态快速筛选。</div>',
      '          </div>',
      '        </div>',
      '        <div class="filters">',
      `          <input id="keywordInput" class="input" placeholder="搜索标题、公众号或摘要" value="${escapeHtml(state.keyword)}" />`,
      '          <select id="groupSelect" class="select">',
      '            <option value="all">全部分组</option>',
      groupOptions
        .map(function (item) {
          return `<option value="${escapeHtml(item)}" ${state.group === item ? 'selected' : ''}>${escapeHtml(item)}</option>`;
        })
        .join(''),
      '          </select>',
      '          <select id="accountSelect" class="select">',
      '            <option value="all">全部公众号</option>',
      accountOptions
        .map(function (item) {
          return `<option value="${escapeHtml(item)}" ${state.account === item ? 'selected' : ''}>${escapeHtml(item)}</option>`;
        })
        .join(''),
      '          </select>',
      '          <select id="readSelect" class="select">',
      `            <option value="all" ${state.readStatus === 'all' ? 'selected' : ''}>全部状态</option>`,
      `            <option value="unread" ${state.readStatus === 'unread' ? 'selected' : ''}>只看未读</option>`,
      `            <option value="read" ${state.readStatus === 'read' ? 'selected' : ''}>只看已读</option>`,
      '          </select>',
      '        </div>',
      `        <div class="article-list">${
        filteredArticles.length ? filteredArticles.map(renderArticleCard).join('') : '<div class="empty">当前筛选条件下没有文章。</div>'
      }</div>`,
      '      </div>',
      '      <div class="side-grid">',
      '        <section class="card">',
      '          <div class="section-head">',
      '            <div>',
      '              <div class="section-title">内容设置</div>',
      '              <div class="section-copy">和小程序个人中心保持一致。</div>',
      '            </div>',
      '          </div>',
      '          <div class="info-list">',
      `            <div class="info-row"><span>首页封面显示</span><strong>${snapshot.preferences.showHomeCover ? '开启' : '关闭'}</strong></div>`,
      `            <div class="info-row"><span>阅读字体</span><strong>${escapeHtml(snapshot.preferences.readingFontLabel)}</strong></div>`,
      `            <div class="info-row"><span>Webhook 状态</span><strong>${escapeHtml(snapshot.webAdmin.webhookStatusLabel)}</strong></div>`,
      '          </div>',
      '        </section>',
      '        <section class="card">',
      '          <div class="section-head">',
      '            <div>',
      '              <div class="section-title">分组列表</div>',
      '              <div class="section-copy">直接查看过滤规则和文章规模。</div>',
      '            </div>',
      '          </div>',
      `          <div class="stack-list">${
        (snapshot.groups || []).length
          ? snapshot.groups
              .map(function (group) {
                return renderListCard(
                  group.name,
                  [`文章 ${group.articleCount} 篇`, `包含 ${group.includeKeywordsText}`, `排除 ${group.excludeKeywordsText}`],
                  group.note,
                  []
                );
              })
              .join('')
          : '<div class="empty">暂无分组。</div>'
      }</div>`,
      '        </section>',
      '        <section class="card">',
      '          <div class="section-head">',
      '            <div>',
      '              <div class="section-title">导出与解析</div>',
      '              <div class="section-copy">最近输出与补录历史。</div>',
      '            </div>',
      '          </div>',
      `          <div class="stack-list">${
        (snapshot.exportRecords || [])
          .map(function (item) {
            return renderListCard(item.name, [item.createdLabel, `文章 ${item.articleCount} 篇`], '导出记录可用于复制、归档或再加工。', []);
          })
          .concat(
            (snapshot.parseRecords || []).map(function (item) {
              return renderListCard(item.title, [item.accountName, item.parsedLabel], '来自链接解析记录，可回看补录来源。', []);
            })
          )
          .join('') || '<div class="empty">暂无记录。</div>'
      }</div>`,
      '        </section>',
      '      </div>',
      '    </section>',
      '    <section class="card" style="margin-top:20px;">',
      '      <div class="section-head">',
      '        <div>',
      '          <div class="section-title">公众号关注池</div>',
      '          <div class="section-copy">管理每个账号属于哪个分组，以及当前监控频次。</div>',
      '        </div>',
      '      </div>',
      `      <div class="stack-list">${
        (snapshot.follows || []).length
          ? snapshot.follows
              .map(function (follow) {
                return renderListCard(
                  follow.name,
                  [follow.createdLabel, follow.monitoringLabel],
                  follow.description,
                  follow.groupNames || []
                );
              })
              .join('')
          : '<div class="empty">暂无关注账号。</div>'
      }</div>`,
      '      <div class="footer-note">部署方式：优先把 web-admin 目录连同 data 目录一起发布成静态站点。如果你已经有后端接口，再把 config.js 里的 apiBaseUrl 指到返回 snapshot 的地址即可。</div>',
      '    </section>',
      '  </main>',
      '</div>'
    ].join('');

    bindEvents();
  }

  function bindEvents() {
    const keywordInput = document.getElementById('keywordInput');
    const groupSelect = document.getElementById('groupSelect');
    const accountSelect = document.getElementById('accountSelect');
    const readSelect = document.getElementById('readSelect');

    if (keywordInput) {
      keywordInput.addEventListener('input', function (event) {
        state.keyword = event.target.value;
        render();
      });
    }

    if (groupSelect) {
      groupSelect.addEventListener('change', function (event) {
        state.group = event.target.value;
        render();
      });
    }

    if (accountSelect) {
      accountSelect.addEventListener('change', function (event) {
        state.account = event.target.value;
        render();
      });
    }

    if (readSelect) {
      readSelect.addEventListener('change', function (event) {
        state.readStatus = event.target.value;
        render();
      });
    }
  }

  async function bootstrap() {
    state.token = resolveToken();
    renderLoading();

    const result = await loadSnapshot(state.token);
    state.snapshot = result.snapshot;
    state.loadSource = result.source;
    state.errorMessage = result.errorMessage || '';
    render();
  }

  bootstrap();
})();
