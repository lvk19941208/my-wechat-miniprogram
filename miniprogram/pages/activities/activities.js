const app = getApp();

Page({
  data: {
    activities: [],
    searchContent: '',
    searchResults: [],
    pageSize: 5,
    page: 0,
    hasMoreActivities: true,
    years: [],
    selectedYear: null,
    selectedYearIndex: 0
  },

  onLoad() {
    console.log('活动管理页面加载，时间:', new Date().toLocaleString());
    const adminInfo = wx.getStorageSync('adminInfo');
    if (!adminInfo || !adminInfo.isAdmin) {
      console.log('未登录管理员，跳转到登录');
      wx.showToast({ title: '请先登录', icon: 'none' });
      wx.redirectTo({ url: '/pages/adminLogin/adminLogin' });
      return;
    }

    this.initYears();
    this.loadActivities();
    this.logOperation('访问了活动管理页面');
  },

  initYears() {
    const currentYear = new Date().getFullYear();
    const years = ['全部年份'];
    for (let year = currentYear; year >= 2020; year--) {
      years.push(year.toString());
    }
    this.setData({
      years: years,
      selectedYearIndex: 0
    });
    console.log('初始化年份:', years);
  },

  onYearChange(e) {
    const index = e.detail.value;
    const selectedYear = this.data.years[index] === '全部年份' ? null : this.data.years[index];
    this.setData({
      selectedYear: selectedYear,
      selectedYearIndex: index,
      activities: [],
      page: 0,
      hasMoreActivities: true
    });
    this.loadActivities();
    this.logOperation(`按年份筛选活动：${selectedYear || '全部年份'}`);
  },

  formatDate(date) {
    if (!date) return '暂无时间';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  formatActivity(item) {
    const invitedRegions = Array.isArray(item.invitedRegions) ? item.invitedRegions : [];
    const participants = Array.isArray(item.participants) ? item.participants : [];
    return {
      ...item,
      date: this.formatDate(item.date),
      invitedRegionsText: invitedRegions.length > 0 ? invitedRegions.join('、') : '暂无',
      participantCount: participants.length,
      participantNames: participants.map(p => p.name).join('、') || '暂无'
    };
  },

  async loadActivities() {
    const db = wx.cloud.database();
    const { pageSize, page, selectedYear } = this.data;

    try {
      let query = db.collection('activities')
        .orderBy('createdAt', 'desc')
        .skip(page * pageSize)
        .limit(pageSize);

      if (selectedYear) {
        const startOfYear = new Date(`${selectedYear}-01-01T00:00:00Z`);
        const endOfYear = new Date(`${selectedYear}-12-31T23:59:59Z`);
        query = query.where({
          createdAt: db.command.gte(startOfYear).and(db.command.lte(endOfYear))
        });
      }

      const res = await query.get();
      const formattedActivities = res.data.map(item => this.formatActivity(item));
      this.setData({
        activities: this.data.activities.concat(formattedActivities),
        hasMoreActivities: res.data.length === pageSize
      });
      console.log('加载活动:', formattedActivities);
    } catch (err) {
      console.error('加载活动失败:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  async loadMoreActivities() {
    this.setData({ page: this.data.page + 1 });
    await this.loadActivities();
    this.logOperation('加载了更多活动');
  },

  onSearchInput(e) {
    this.setData({ searchContent: e.detail.value });
  },

  async searchActivities() {
    const { searchContent, selectedYear } = this.data;
    if (!searchContent.trim()) {
      this.setData({ searchResults: [] });
      return;
    }
    const db = wx.cloud.database();
    try {
      let query = db.collection('activities').where({
        content: db.RegExp({
          regexp: searchContent,
          options: 'i'
        })
      });

      if (selectedYear) {
        const startOfYear = new Date(`${selectedYear}-01-01T00:00:00Z`);
        const endOfYear = new Date(`${selectedYear}-12-31T23:59:59Z`);
        query = query.where({
          createdAt: db.command.gte(startOfYear).and(db.command.lte(endOfYear))
        });
      }

      const res = await query.get();
      const formattedResults = res.data.map(item => this.formatActivity(item));
      this.setData({ searchResults: formattedResults });
      console.log('搜索结果:', formattedResults);
      this.logOperation(`搜索了活动：${searchContent}`);
    } catch (err) {
      console.error('搜索活动失败:', err);
      wx.showToast({ title: '搜索失败', icon: 'none' });
    }
  },

  editActivity(e) {
    const id = e.currentTarget.dataset.id;
    this.logOperation(`编辑活动（ID: ${id}）`);
    wx.navigateTo({ url: `/pages/activityPublish/activityPublish?id=${id}` });
  },

  goToActivityPublish() {
    this.logOperation('跳转到发布新活动页面');
    wx.navigateTo({ url: '/pages/activityPublish/activityPublish' });
  },

  goBack() {
    this.logOperation('返回上一页');
    wx.navigateBack();
  },

  logOperation(operation) {
    const adminInfo = wx.getStorageSync('adminInfo');
    const db = wx.cloud.database();
    db.collection('operation_logs')
      .add({
        data: {
          username: adminInfo.username,
          operation: operation,
          timestamp: new Date()
        }
      })
      .catch(err => {
        console.error('Log operation error:', err);
      });
  }
});