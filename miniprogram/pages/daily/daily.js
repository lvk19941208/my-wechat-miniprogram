const app = getApp(); // 获取全局 app 实例

Page({
  data: {
    content: ''
  },

  onLoad() {
    const userName = wx.getStorageSync('userName') || '未知用户';
    wx.setNavigationBarTitle({
      title: `${userName} 的日常分享`
    });
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value });
  },

  onSubmit() {
    const content = this.data.content.trim();
    if (!content) {
      wx.showToast({
        title: '请输入分享内容',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '提交中...', mask: true });

    const db = wx.cloud.database();
    db.collection('daily_logs').add({
      data: {
        _openid: wx.getStorageSync('openid'),
        timestamp: new Date(),
        content: content
      },
      success: () => {
        wx.hideLoading();
        wx.showToast({
          title: '分享成功',
          icon: 'success'
        });
        this.setData({ content: '' });
      },
      fail: err => {
        wx.hideLoading();
        console.error('分享失败:', err);
        wx.showToast({
          title: '分享失败',
          icon: 'none'
        });
      }
    });
  },

  goBack() {
    wx.navigateBack();
  }
});