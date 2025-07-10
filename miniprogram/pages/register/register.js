Page({
  data: {
    newName: '',
    openid: '',
    region: '',
    regionList: ['咸安', '赤壁', '崇阳'],
    regionIndex: -1,
    isSubmitting: false // 新增：控制按钮禁用状态
  },

  onLoad(options) {
    if (options.openid) {
      this.setData({
        openid: options.openid
      });
      console.log('接收到的 openid:', options.openid);
      wx.setNavigationBarTitle({
        title: '用户注册'
      });
    } else {
      wx.showToast({
        title: '登录信息缺失',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  onNameInput(e) {
    this.setData({
      newName: e.detail.value
    });
  },

  onRegionChange(e) {
    const index = e.detail.value;
    this.setData({
      regionIndex: index,
      region: this.data.regionList[index]
    });
  },

  async registerUser() {
    const { newName, openid, region, isSubmitting } = this.data;
    if (isSubmitting) return; // 防止重复点击

    if (!newName.trim()) {
      wx.showToast({
        title: '请填写名字',
        icon: 'none'
      });
      return;
    }

    if (!region) {
      wx.showToast({
        title: '请选择地区',
        icon: 'none'
      });
      return;
    }

    if (!openid) {
      wx.showToast({
        title: '登录信息错误',
        icon: 'none'
      });
      return;
    }

    this.setData({ isSubmitting: true }); // 禁用按钮
    wx.showLoading({ title: '注册中...', mask: true });

    const db = wx.cloud.database();
    try {
      // 检查是否已注册
      const checkRes = await db.collection('users')
        .where({ _openid: openid })
        .count();
      if (checkRes.total > 0) {
        wx.hideLoading();
        this.setData({ isSubmitting: false });
        wx.showToast({
          title: '您已注册，请勿重复操作',
          icon: 'none'
        });
        return;
      }

      // 添加新用户
      await db.collection('users').add({
        data: {
          _openid: openid,
          name: newName,
          phone: '',
          guardianPhone: '',
          endDate: '',
          region: region
        }
      });

      wx.hideLoading();
      this.setData({ isSubmitting: false });
      wx.setStorageSync('userName', newName);
      wx.showToast({
        title: '注册成功',
        icon: 'success'
      });

      // 防抖跳转
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/index/index' });
      }, 1000);
    } catch (err) {
      wx.hideLoading();
      this.setData({ isSubmitting: false });
      console.error('注册失败:', err);
      wx.showToast({
        title: `注册失败: ${err.errMsg || '未知错误'}`,
        icon: 'none',
        duration: 2000
      });
    }
  },

  goBack() {
    wx.navigateBack();
  }
});