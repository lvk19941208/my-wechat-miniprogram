const db = wx.cloud.database();

Page({
  data: {
    alertList: [], // 预警列表
    searchName: '', // 搜索框输入的用户名
    page: 1, // 当前页码
    pageSize: 10, // 每页显示条数
    hasMore: true, // 是否有更多数据
    total: 0, // 总记录数
  },

  onLoad() {
    this.fetchAlerts(); // 页面加载时获取第一页数据
  },

  onShow() {
    this.setData({ page: 1, alertList: [], hasMore: true }); // 重置分页
    this.fetchAlerts(); // 页面显示时刷新
  },

  // 监听搜索框输入
  onSearchInput(e) {
    this.setData({
      searchName: e.detail.value, // 更新搜索框的值
      page: 1, // 重置页码
      alertList: [], // 清空列表
      hasMore: true, // 重置加载更多状态
    });
  },

  // 执行搜索
  searchAlerts() {
    this.setData({ page: 1, alertList: [], hasMore: true }); // 重置分页
    this.fetchAlerts(); // 根据当前 searchName 查询
  },

  // 加载更多
  loadMore() {
    this.setData({ page: this.data.page + 1 });
    this.fetchAlerts(true); // 追加模式
  },

  // 切换展开/收起状态
  toggleExpand(e) {
    const { index } = e.currentTarget.dataset;
    const alertList = this.data.alertList;
    alertList[index].expanded = !alertList[index].expanded;
    this.setData({ alertList });
  },

  // 获取已解决的预警，支持分页和用户名筛选
  async fetchAlerts(append = false) {
    try {
      const { searchName, page, pageSize, alertList } = this.data;
      let query = { status: 'resolved' }; // 默认查询条件：已解决的预警
      console.log('Querying resolved alerts with:', JSON.stringify(query));

      // 如果有搜索用户名，先查询匹配的用户
      if (searchName) {
        const usersRes = await db.collection('users')
          .where({
            name: searchName // 精确匹配用户名
          })
          .get();
        const users = usersRes.data;
        console.log('Found users for search:', users);

        if (!users.length) {
          this.setData({ alertList: [], hasMore: false });
          wx.showToast({ title: '未找到该用户', icon: 'none' });
          return;
        }

        const openids = users.map(user => user._openid);
        query._openid = db.command.in(openids);
        console.log('Updated query with openids:', JSON.stringify(query));
      }

      // 查询总记录数
      const totalRes = await db.collection('risk_alerts')
        .where(query)
        .count();
      const total = totalRes.total;
      console.log('Total resolved alerts:', total);

      // 分页查询
      const alertsRes = await db.collection('risk_alerts')
        .where(query)
        .orderBy('last_alert_date', 'desc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get();
      let alerts = alertsRes.data;
      console.log('Resolved alerts fetched:', JSON.stringify(alerts));

      if (!alerts.length && page === 1) {
        this.setData({ alertList: [], hasMore: false, total: 0 });
        wx.showToast({ title: '暂无已解决的预警', icon: 'none' });
        return;
      }

      // 获取所有相关用户的 _openid
      const openids = alerts.map(alert => alert._openid);
      const usersResAll = await db.collection('users')
        .where({
          _openid: db.command.in(openids)
        })
        .get();
      const users = usersResAll.data;
      console.log('Users for alerts:', users);

      // 创建用户 _openid 到 name 的映射
      const userMap = {};
      users.forEach(user => {
        userMap[user._openid] = user.name;
      });

      // 增强预警数据，添加用户名和展开状态
      const enrichedAlerts = alerts.map(alert => ({
        ...alert,
        name: userMap[alert._openid] || '未知用户',
        expanded: false, // 默认收起
      }));
      console.log('Enriched alerts:', JSON.stringify(enrichedAlerts));

      // 更新页面数据
      this.setData({
        alertList: append ? [...alertList, ...enrichedAlerts] : enrichedAlerts,
        hasMore: page * pageSize < total,
        total,
      });
    } catch (err) {
      console.error('Fetch resolved alerts error:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  // 返回上一页
  goBack() {
    wx.navigateBack();
  },
});