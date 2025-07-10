const app = getApp(); // 获取全局 app 实例

Page({
  data: {
    username: '',
    password: ''
  },

  onUsernameInput(e) {
    this.setData({ username: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  onAdminLogin() {
    const { username, password } = this.data;
    if (!username || !password) {
      wx.showToast({
        title: '请输入账号和密码',
        icon: 'none'
      });
      return;
    }

    const db = wx.cloud.database();
    db.collection('admins')
      .where({
        username: username,
        password: password
      })
      .get({
        success: res => {
          if (res.data.length > 0) {
            const admin = res.data[0];
            // 存储管理员信息到本地
            wx.setStorageSync('adminInfo', {
              isAdmin: true,
              username: admin.username,
              region: admin.region,
              role: admin.role
            });
            wx.showToast({
              title: '登录成功',
              icon: 'success'
            });
            // 记录登录操作日志
            this.logOperation(`${username} 登录了系统`);
            app.debounceNavigate('/pages/admin/admin'); // 使用全局防抖
          } else {
            wx.showToast({
              title: '账号或密码错误',
              icon: 'none'
            });
          }
        },
        fail: err => {
          console.error('管理员登录失败:', err);
          wx.showToast({
            title: '登录失败',
            icon: 'none'
          });
        }
      });
  },

  goBack() {
    wx.navigateBack(); // 不需要防抖
  },

  logOperation(operation) {
    const db = wx.cloud.database();
    db.collection('operation_logs')
      .add({
        data: {
          username: this.data.username,
          operation: operation,
          timestamp: new Date()
        }
      })
      .catch(err => {
        console.error('Log operation error:', err);
      });
  }
});