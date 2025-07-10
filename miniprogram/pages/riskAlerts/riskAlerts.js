Page({
  data: {
    alertList: [],
    region: '',
    role: '',
    isSuperAdmin: false
  },

  onLoad() {
    this.checkAdminInfo();
    this.fetchAlerts();
  },

  onShow() {
    this.fetchAlerts();
  },

  async checkAdminInfo() {
    const adminInfo = wx.getStorageSync('adminInfo');
    if (!adminInfo || !adminInfo.isAdmin) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      wx.redirectTo({ url: '/pages/adminLogin/adminLogin' });
      return;
    }

    const { region, role } = adminInfo;
    this.setData({
      region: region === 'all' ? '' : region,
      role: role,
      isSuperAdmin: role === 'super_admin'
    });
    console.log('adminInfo:', adminInfo);
    console.log('region:', region, 'role:', role, 'isSuperAdmin:', role === 'super_admin');
  },

  async fetchAlerts() {
    try {
      wx.showLoading({ title: '加载预警中...' });
      const { region, isSuperAdmin } = this.data;
      const db = wx.cloud.database();
      let query = { status: 'active' };
      console.log('Fetch alerts query:', JSON.stringify(query));

      if (!isSuperAdmin) {
        query.region = region;
      } else {
        query['region.region'] = db.command.or('all', db.command.exists(false));
      }

      const alertsRes = await db.collection('risk_alerts')
        .where(query)
        .orderBy('last_alert_timestamp', 'desc')
        .get();
      const alerts = alertsRes.data;
      console.log('Fetched active alerts:', JSON.stringify(alerts));

      const enrichedAlerts = alerts.map(alert => ({
        ...alert,
        displayReason: alert.alert_reason || '连续三天未签到',
        remark: alert.remark || ''
      }));

      this.setData({
        alertList: enrichedAlerts
      });
    } catch (err) {
      console.error('Fetch alerts error:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  async resolveAlert(e) {
    const { id } = e.currentTarget.dataset;
    wx.showModal({
      title: '标记为已解决',
      content: '',
      editable: true,
      placeholderText: '请输入解决原因',
      success: async (res) => {
        if (res.confirm && res.content) {
          const resolvedReason = res.content.trim();
          if (!resolvedReason) {
            wx.showToast({ title: '解决原因不能为空', icon: 'none' });
            return;
          }
          try {
            const now = new Date();
            const resolvedDate = this.formatDateToString(now.getTime());
            
            console.log(`Resolving alert ${id} with reason: ${resolvedReason}`);
            await wx.cloud.database().collection('risk_alerts').doc(id).update({
              data: {
                status: 'resolved',
                resolved_date: resolvedDate,
                resolved_reason: resolvedReason
              }
            });

            wx.showToast({ title: '已标记为解决', icon: 'success' });
            this.fetchAlerts();
          } catch (err) {
            console.error('Resolve alert error:', err);
            wx.showToast({ title: '操作失败', icon: 'none' });
          }
        }
      }
    });
  },

  formatDateToString(timestamp) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  },

  goBack() {
    console.log('goBack triggered');
    // 尝试返回上一页
    wx.navigateBack({
      delta: 1,
      fail: () => {
        // 如果返回失败（页面栈为空），跳转到 admin 页面
        console.log('navigateBack failed, redirecting to admin');
        wx.navigateTo({
          url: '/pages/admin/admin'
        });
      }
    });
  }
});