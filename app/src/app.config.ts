export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/team/index',
    'pages/me/index',
    'pages/login/index',
    'pages/create/index',
    'pages/invite/index',
    'pages/checkin/index',
    'pages/report/index',
    'pages/poster/index',
    'pages/weight/index',
    'pages/legal/index',
  ],
  subPackages: [
    {
      root: 'admin',
      pages: ['index', 'users', 'teams', 'team', 'actions', 'action'],
    },
  ],
  window: {
    navigationBarBackgroundColor: '#FAFAF8',
    navigationBarTitleText: '瘦身战队',
    navigationBarTextStyle: 'black',
    backgroundColor: '#FAFAF8',
    backgroundTextStyle: 'dark',
  },
  tabBar: {
    color: '#76736D',
    selectedColor: '#141414',
    backgroundColor: '#FFFFFF',
    borderStyle: 'white',
    list: [
      { pagePath: 'pages/home/index', text: '今日', iconPath: 'assets/tab/home.png', selectedIconPath: 'assets/tab/home-on.png' },
      { pagePath: 'pages/team/index', text: '战队', iconPath: 'assets/tab/team.png', selectedIconPath: 'assets/tab/team-on.png' },
      { pagePath: 'pages/me/index', text: '我的', iconPath: 'assets/tab/me.png', selectedIconPath: 'assets/tab/me-on.png' },
    ],
  },
  lazyCodeLoading: 'requiredComponents',
})
