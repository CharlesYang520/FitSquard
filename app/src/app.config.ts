export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/team/index',
    'pages/me/index',
    'pages/login/index',
    'pages/create/index',
    'pages/invite/index',
    'pages/checkin/index',
  ],
  window: {
    navigationBarBackgroundColor: '#FAFAF8',
    navigationBarTitleText: '瘦身战队',
    navigationBarTextStyle: 'black',
    backgroundColor: '#FAFAF8',
    backgroundTextStyle: 'dark',
  },
  tabBar: {
    color: '#8A877F',
    selectedColor: '#141414',
    backgroundColor: '#FFFFFF',
    borderStyle: 'white',
    list: [
      { pagePath: 'pages/home/index', text: '今日' },
      { pagePath: 'pages/team/index', text: '战队' },
      { pagePath: 'pages/me/index', text: '我的' },
    ],
  },
  lazyCodeLoading: 'requiredComponents',
})
