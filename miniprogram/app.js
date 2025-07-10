App({
  onLaunch() {
    wx.cloud.init({
      env: 'cloud1-0gl2fjfc4ecb00c7'
    });
  },

  debounceNavigate(url, delay = 500) {
    if (this.globalData.isNavigating) return;
    this.globalData.isNavigating = true;
    wx.showLoading({ title: '跳转中...' });
    wx.navigateTo({
      url: url,
      success: () => {
        wx.hideLoading();
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('导航失败:', err);
        wx.showToast({ title: '跳转失败', icon: 'none' });
      },
      complete: () => {
        setTimeout(() => {
          this.globalData.isNavigating = false;
        }, delay);
      }
    });
  },

  globalData: {
    isNavigating: false
  }
});