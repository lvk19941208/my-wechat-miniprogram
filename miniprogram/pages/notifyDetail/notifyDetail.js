Page({
  data: {
    id: '',
    target_name: '',
    content: '',
    createdAt: '',
    viewed: false
  },

  onLoad(options) {
    if (options && options.id) {
      this.setData({ id: options.id });
      this.loadNotice(options.id);
    } else {
      wx.showToast({ title: '通知ID缺失', icon: 'none' });
      setTimeout(() => {
        wx.navigateBack();
      }, 2000);
    }
  },

  loadNotice(id) {
    wx.showLoading({ title: '加载中...', mask: true });

    const db = wx.cloud.database();
    db.collection('notices').doc(id).get({
      success: res => {
        wx.hideLoading();
        console.log('加载通知详情成功:', res.data);
        const { target_name, content, createdAt, viewed } = res.data;
        this.setData({
          target_name: target_name || '未知用户',
          content: content || '暂无内容',
          createdAt: this.formatDate(createdAt),
          viewed: viewed || false
        });
      },
      fail: err => {
        wx.hideLoading();
        console.error('加载通知详情失败:', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
        setTimeout(() => {
          wx.navigateBack();
        }, 2000);
      }
    });
  },

  markAsViewed() {
    const { id, viewed } = this.data;
    if (viewed) {
      wx.showToast({ title: '此通知已标记为已读', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '提交中...', mask: true });
    const db = wx.cloud.database();

    db.collection('notices').doc(id).update({
      data: {
        viewed: true,
        viewedAt: new Date()
      },
      success: res => {
        wx.hideLoading();
        console.log('标记已读成功:', res);
        wx.showToast({ title: '已标记为已读', icon: 'success' });
        this.setData({ viewed: true });

        // 获取前一页（index 页面）并强制刷新
        const pages = getCurrentPages();
        const prevPage = pages[pages.length - 2];
        if (prevPage && prevPage.route === 'pages/index/index') {
          // 直接调用 checkNotifications 并确保同步更新
          prevPage.checkNotifications();
          // 额外强制设置 showNotify 为 false，避免异步延迟
          prevPage.setData({ showNotify: false });
        } else {
          console.error('未找到 index 页面');
        }

        setTimeout(() => {
          wx.navigateBack();
        }, 1000);
      },
      fail: err => {
        wx.hideLoading();
        console.error('标记已读失败:', err);
        wx.showToast({ title: '操作失败: ' + (err.errMsg || '未知错误'), icon: 'none' });
      }
    });
  },

  goBack() {
    wx.navigateBack();
  },

  formatDate(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
});