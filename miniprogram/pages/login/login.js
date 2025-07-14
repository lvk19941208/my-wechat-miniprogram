const app = getApp();
Page({
  data: {
    needAuth: false,
    wechatBtnDisabled: false,
    adminBtnDisabled: false
  },

  onLoad() {
    this.checkAuthStatus();
  },

  onShow() {
    // 每次页面显示时重置按钮状态
    this.setData({
      wechatBtnDisabled: false,
      adminBtnDisabled: false
    });
  },

  checkAuthStatus() {
    wx.getSetting({
      success: res => {
        if (!res.authSetting['scope.userInfo']) {
          this.setData({ needAuth: true });
        } else {
          this.setData({ needAuth: false });
        }
      },
      fail: err => {
        console.error('检查授权状态失败:', err);
        this.setData({ needAuth: true });
      }
    });
  },

  onGetUserInfo(e) {
    if (this.data.wechatBtnDisabled) return;

    this.setData({ wechatBtnDisabled: true });
    wx.showLoading({ title: '登录中...', mask: true });

    if (!e.detail.userInfo) {
      wx.hideLoading();
      wx.showToast({
        title: '请授权以继续',
        icon: 'none'
      });
      this.setData({ wechatBtnDisabled: false });
      return;
    }

    const userInfo = e.detail.userInfo;
    wx.login({
      success: res => {
        if (res.code) {
          wx.cloud.callFunction({
            name: 'getOpenid',
            success: cloudRes => {
              console.log('云函数返回:', cloudRes);
              const openid = cloudRes.result.openid;
              wx.setStorageSync('openid', openid);
              wx.setStorageSync('userInfo', userInfo);
              this.checkUserInDatabase(openid, userInfo);
            },
            fail: err => {
              console.error('调用 getOpenid 失败', err);
              wx.showToast({
                title: '服务器错误',
                icon: 'none'
              });
              wx.hideLoading();
              this.setData({ wechatBtnDisabled: false });
            },
            complete: () => {
              // 移除 setTimeout，直接在 complete 中重置状态
              wx.hideLoading();
              this.setData({ wechatBtnDisabled: false });
            }
          });
        } else {
          console.error('登录失败', res.errMsg);
          wx.showToast({
            title: '登录失败',
            icon: 'none'
          });
          wx.hideLoading();
          this.setData({ wechatBtnDisabled: false });
        }
      },
      fail: err => {
        console.error('wx.login 失败', err);
        wx.showToast({
          title: '登录失败',
          icon: 'none'
        });
        wx.hideLoading();
        this.setData({ wechatBtnDisabled: false });
      }
    });
  },

  checkUserInDatabase(openid, userInfo) {
    const db = wx.cloud.database();
    db.collection('users').where({
      _openid: openid
    }).get({
      success: res => {
        console.log('数据库查询结果:', res.data);
        if (res.data.length > 0) {
          const dbUserInfo = res.data[0];
          wx.setStorageSync('dbUserInfo', dbUserInfo);
          wx.setStorageSync('userName', dbUserInfo.name || userInfo.nickName || '未知用户');
          console.log('用户已注册，跳转到 index');
          app.debounceNavigate('/pages/index/index');
        } else {
          console.log('用户未注册，跳转到 register');
          app.debounceNavigate(`/pages/register/register?openid=${openid}`);
        }
      },
      fail: err => {
        console.error('数据库查询失败', err);
        wx.showToast({
          title: '数据库错误',
          icon: 'none'
        });
        this.setData({ wechatBtnDisabled: false }); // 失败时也重置状态
      }
    });
  },

  onAdminLogin() {
    if (this.data.adminBtnDisabled) return;

    this.setData({ adminBtnDisabled: true });
    wx.showLoading({ title: '跳转中...', mask: true });

    app.debounceNavigate('/pages/adminLogin/adminLogin');

    setTimeout(() => {
      wx.hideLoading();
      this.setData({ adminBtnDisabled: false });
    }, 1000);
  }
});