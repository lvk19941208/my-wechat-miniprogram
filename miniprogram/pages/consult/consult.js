const db = wx.cloud.database();

Page({
  data: {},

  async onLegalConsult() {
    await this.checkIdentityAndNavigate('/pages/legalConsult/legalConsult');
  },

  async onPsychConsult() {
    await this.checkIdentityAndNavigate('/pages/psychConsult/psychConsult');
  },

  async checkIdentityAndNavigate(targetUrl) {
    wx.showLoading({ title: '身份验证中', mask: true });

    try {
      const openid = wx.getStorageSync('openid');
      if (!openid) {
        wx.hideLoading();
        wx.showModal({
          title: '未登录',
          content: '请先登录后使用服务',
          showCancel: false,
          success: () => {
            wx.redirectTo({ url: '/pages/login0/login0' });
          }
        });
        return;
      }

      const res = await db.collection('users').where({ _openid: openid }).get();

      if (res.data.length === 0) {
        wx.hideLoading();
        wx.showModal({
          title: '访问受限',
          content: '您尚未完成身份注册，无法进入该服务',
          showCancel: false,
          success: () => {
            wx.redirectTo({ url: '/pages/login0/login0' });
          }
        });
        return;
      }

      wx.hideLoading();
      wx.navigateTo({ url: targetUrl });

    } catch (err) {
      wx.hideLoading();
      console.error('身份验证失败:', err);
      wx.showToast({
        title: '身份验证出错',
        icon: 'none'
      });
    }
  }
});
