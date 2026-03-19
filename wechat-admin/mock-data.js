window.WEB_ADMIN_PRESETS = [
  {
    token: 'Prp5DUuwzbvl5yMhDUw9y0QtUJUq70ap',
    generatedAt: '2026-03-19 21:30',
    profile: {
      nickname: 'tianfeiyu',
      userId: 'local-demo-user'
    },
    membership: {
      membershipLabel: '试用会员',
      statusLabel: '试用中',
      expireAtLabel: '剩余 7 天',
      detail: '到期后监控、导出、解析和 Web 管理能力会暂停。'
    },
    preferences: {
      showHomeCover: true,
      readingFontSize: 'default',
      readingFontLabel: '默认'
    },
    webAdmin: {
      manageUrl: 'https://blog.tianfeiyu.com/wechat-admin/index.html?token=Prp5DUuwzbvl5yMhDUw9y0QtUJUq70ap',
      webhookStatusLabel: '未开启',
      webhookDescription:
        'WebHooks功能暂未开放，此功能用来满足会员的特殊需求，可以设置数据推送接口地址，当用户的文章数据更新时会主动推送数据到设定的接口。'
    },
    overview: {
      unreadCount: 4,
      followCount: 4,
      groupCount: 3,
      monitoringCount: 3,
      favoriteCount: 2
    },
    groups: [
      {
        id: 'group-ai',
        name: 'AI 技术',
        includeKeywordsText: 'deepseek, agent, 模型',
        excludeKeywordsText: '招聘',
        articleCount: 3,
        note: '聚焦模型、Agent、推理与工程实践。'
      },
      {
        id: 'group-product',
        name: '产品观察',
        includeKeywordsText: '无',
        excludeKeywordsText: '无',
        articleCount: 3,
        note: '关注产品策略、增长、组织经验。'
      },
      {
        id: 'group-invest',
        name: '投资快讯',
        includeKeywordsText: '融资, 上市, AI',
        excludeKeywordsText: '广告',
        articleCount: 2,
        note: '只看值得追踪的行业资本动态。'
      }
    ],
    follows: [
      {
        id: 'follow-geekpark',
        name: '极客公园',
        description: '科技创新与产品观察',
        groupNames: ['AI 技术', '产品观察'],
        monitoringLabel: '已监控 · 24 次/天',
        createdLabel: '2026-03-15 10:30'
      },
      {
        id: 'follow-quantum',
        name: '量子位',
        description: 'AI 前沿新闻与论文速递',
        groupNames: ['AI 技术', '投资快讯'],
        monitoringLabel: '已监控 · 48 次/天',
        createdLabel: '2026-03-15 11:00'
      },
      {
        id: 'follow-growth',
        name: '增长黑盒',
        description: '增长案例与产品拆解',
        groupNames: ['产品观察'],
        monitoringLabel: '未监控',
        createdLabel: '2026-03-16 09:20'
      },
      {
        id: 'follow-capital',
        name: '创投情报局',
        description: '融资、IPO 与赛道动态',
        groupNames: ['投资快讯'],
        monitoringLabel: '已监控 · 12 次/天',
        createdLabel: '2026-03-16 10:10'
      }
    ],
    articles: [
      {
        id: 'article-001',
        title: 'DeepSeek R2 落地实战：从模型能力到业务上线',
        accountName: '极客公园',
        publishedLabel: '2026-03-18 08:15',
        read: false,
        favorite: true,
        groupNames: ['AI 技术', '产品观察'],
        summary: '围绕真实业务改造流程、评估体系和部署成本，拆解模型上线时最容易踩的三个坑。',
        url: 'https://mp.weixin.qq.com/s/demo-001'
      },
      {
        id: 'article-003',
        title: 'Open Source 模型再进化：推理成本为何突然降了',
        accountName: '量子位',
        publishedLabel: '2026-03-18 07:40',
        read: false,
        favorite: false,
        groupNames: ['AI 技术', '投资快讯'],
        summary: '关注推理框架、量化方案和硬件利用率三条主线，理解成本下降背后的真正原因。',
        url: 'https://mp.weixin.qq.com/s/demo-003'
      },
      {
        id: 'article-006',
        title: '本周融资速递：AI Infra、机器人和垂类 SaaS',
        accountName: '创投情报局',
        publishedLabel: '2026-03-18 10:05',
        read: false,
        favorite: false,
        groupNames: ['投资快讯'],
        summary: '梳理本周值得持续关注的融资案例，并补充赛道变化与资本偏好。',
        url: 'https://mp.weixin.qq.com/s/demo-006'
      },
      {
        id: 'article-002',
        title: 'Agent 产品真正难的是闭环，不是对话框',
        accountName: '极客公园',
        publishedLabel: '2026-03-17 21:00',
        read: true,
        favorite: false,
        groupNames: ['AI 技术', '产品观察'],
        summary: '从用户任务链路出发，讨论 Agent 产品为什么总在“能演示”与“能交付”之间掉链子。',
        url: 'https://mp.weixin.qq.com/s/demo-002'
      },
      {
        id: 'article-005',
        title: '产品团队如何把日报从汇报工具改成决策工具',
        accountName: '增长黑盒',
        publishedLabel: '2026-03-17 09:10',
        read: true,
        favorite: false,
        groupNames: ['产品观察'],
        summary: '拆解日报设计里的指标层级、异常归因和行动项机制，让日报真正为团队决策服务。',
        url: 'https://mp.weixin.qq.com/s/demo-005'
      },
      {
        id: 'article-004',
        title: 'AI 应用公司再获融资，投资逻辑已经变了',
        accountName: '量子位',
        publishedLabel: '2026-03-16 19:20',
        read: false,
        favorite: true,
        groupNames: ['AI 技术', '投资快讯'],
        summary: '从新一轮融资案例切入，看资本市场对 AI 应用公司的筛选标准发生了哪些变化。',
        url: 'https://mp.weixin.qq.com/s/demo-004'
      }
    ],
    exportRecords: [
      {
        id: 'export-001',
        name: 'AI 技术_今日更新',
        createdLabel: '2026-03-18 10:20',
        articleCount: 2
      }
    ],
    parseRecords: [
      {
        id: 'parse-001',
        title: 'Agent 产品真正难的是闭环，不是对话框',
        accountName: '极客公园',
        parsedLabel: '2026-03-17 21:03'
      }
    ]
  }
];
