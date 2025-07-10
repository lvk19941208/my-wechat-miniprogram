Page({
  data: {
    notices: [],
    searchContent: '',
    searchResults: [],
    pageSize: 5,
    page: 0,
    hasMoreNotices: true,
    region: '', // 管理员地区
    isSuperAdmin: false // 是否为超级管理员
  },

  onLoad() {
    // 权限验证
    const adminInfo = wx.getStorageSync('adminInfo');
    if (!adminInfo || !adminInfo.isAdmin) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      wx.redirectTo({ url: '/pages/adminLogin/adminLogin' });
      return;
    }

    this.setData({
      region: adminInfo.region ? adminInfo.region.trim() : '',
      isSuperAdmin: adminInfo.role === 'super_admin'
    }, () => {
      console.log('Admin region:', this.data.region, 'isSuperAdmin:', this.data.isSuperAdmin);
      this.loadNotices();
    });
  },

  async loadNotices() {
    const db = wx.cloud.database();
    const { pageSize, page, region, isSuperAdmin } = this.data;
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 计算一周前的时间

    try {
      // 构建查询条件
      let query = {
        createdAt: db.command.gte(oneWeekAgo) // 只查询一周内的通知
      };

      // 如果是普通管理员，需筛选自己地区的小孩
      if (!isSuperAdmin && region) {
        // 先查询自己地区的小孩的 _openid
        const userRes = await db.collection('users')
          .where({
            region: region
          })
          .field({ _openid: true })
          .get();
        const openids = userRes.data.map(user => user._openid);
        console.log('Region users openids:', openids);

        // 如果没有找到用户，直接返回空列表
        if (openids.length === 0) {
          this.setData({
            notices: [],
            hasMoreNotices: false
          });
          return;
        }

        // 添加 target_openid 筛选条件
        query.target_openid = db.command.in(openids);
      }

      const res = await db.collection('notices')
        .where(query)
        .orderBy('createdAt', 'desc')
        .skip(page * pageSize)
        .limit(pageSize)
        .get();

      console.log('loadNotices res.data:', res.data);

      const notices = await Promise.all(res.data.map(async item => {
        item.createdAt = this.formatDate(item.createdAt);
        const userRes = await db.collection('users')
          .where({ _openid: item.target_openid })
          .field({ name: true })
          .get();
        item.target_name = userRes.data.length > 0 ? userRes.data[0].name : '未知用户';
        return item;
      }));

      this.setData({
        notices: this.data.notices.concat(notices),
        hasMoreNotices: res.data.length === pageSize
      });
    } catch (err) {
      console.error('加载通知失败:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  async loadMoreNotices() {
    this.setData({ page: this.data.page + 1 });
    await this.loadNotices();
  },

  onSearchInput(e) {
    this.setData({ searchContent: e.detail.value });
  },

  async searchNotices() {
    const { searchContent, region, isSuperAdmin } = this.data;
    if (!searchContent.trim()) {
      this.setData({ searchResults: [] });
      return;
    }

    const db = wx.cloud.database();
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    try {
      // 构建查询条件
      let query = {
        content: db.RegExp({
          regexp: searchContent,
          options: 'i'
        }),
        createdAt: db.command.gte(oneWeekAgo)
      };

      // 如果是普通管理员，需筛选自己地区的小孩
      if (!isSuperAdmin && region) {
        const userRes = await db.collection('users')
          .where({
            region: region
          })
          .field({ _openid: true })
          .get();
        const openids = userRes.data.map(user => user._openid);
        console.log('Region users openids for search:', openids);

        if (openids.length === 0) {
          this.setData({ searchResults: [] });
          return;
        }

        query.target_openid = db.command.in(openids);
      }

      const res = await db.collection('notices')
        .where(query)
        .get();

      console.log('searchNotices res.data:', res.data);

      const searchResults = await Promise.all(res.data.map(async item => {
        item.createdAt = this.formatDate(item.createdAt);
        const userRes = await db.collection('users')
          .where({ _openid: item.target_openid })
          .field({ name: true })
          .get();
        item.target_name = userRes.data.length > 0 ? userRes.data[0].name : '未知用户';
        return item;
      }));

      this.setData({ searchResults });
    } catch (err) {
      console.error('搜索通知失败:', err);
      wx.showToast({ title: '搜索失败', icon: 'none' });
    }
  },

  editNotice(e) {
    const id = e.currentTarget.dataset.id;
    console.log('notifyUsers editNotice, id:', id);
    if (id) {
      wx.navigateTo({
        url: `/pages/notifyPublish/notifyPublish?id=${id}`
      });
    } else {
      wx.showToast({ title: '通知ID缺失', icon: 'none' });
    }
  },

  goToNotifyPublish() {
    wx.navigateTo({ url: '/pages/notifyPublish/notifyPublish' });
  },

  goBack() {
    wx.navigateBack();
  },

  formatDate(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
});