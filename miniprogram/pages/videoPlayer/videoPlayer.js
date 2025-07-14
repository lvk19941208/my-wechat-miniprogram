Page({
  data: {
    videoUrl: '',
    title: '',
    isLoading: false,
    errorMessage: ''
  },

  onLoad(options) {
    const { url, title } = options;

    if (url) {
      this.setData({
        isLoading: true,
        title: decodeURIComponent(title)
      });

      const decodedUrl = decodeURIComponent(url);
      console.log('接收到的 Cloud File ID:', decodedUrl); // 应该是 cloud:// 开头

      wx.cloud.getTempFileURL({
        fileList: [decodedUrl],
        success: res => {
          console.log('getTempFileURL 返回结果:', res);
          const fileInfo = res.fileList[0];
          if (fileInfo.status === 0 && fileInfo.tempFileURL) {
            this.setData({
              videoUrl: fileInfo.tempFileURL,
              isLoading: false
            });
            console.log('视频播放 URL 设置成功:', fileInfo.tempFileURL);
          } else {
            this.setData({
              isLoading: false,
              errorMessage: '视频加载失败：' + (fileInfo.errMsg || '无效的文件路径')
            });
            wx.showToast({
              title: '视频加载失败',
              icon: 'none'
            });
          }
        },
        fail: err => {
          console.error('获取视频临时 URL 失败:', err);
          this.setData({
            isLoading: false,
            errorMessage: '视频加载失败：' + err.errMsg
          });
          wx.showToast({
            title: '视频加载失败',
            icon: 'none'
          });
        }
      });
    } else {
      this.setData({
        isLoading: false,
        errorMessage: '视频地址无效'
      });
      wx.showToast({
        title: '视频地址无效',
        icon: 'none'
      });
    }
  },

  onVideoError(e) {
    console.error('视频播放出错:', e.detail);
    this.setData({
      errorMessage: '视频播放失败：' + e.detail.errMsg
    });
    wx.showToast({
      title: '视频播放失败',
      icon: 'none'
    });
  },

  onBack() {
    wx.navigateBack({
      delta: 1,
      success: () => {
        console.log('成功返回上一页');
      },
      fail: err => {
        console.error('返回失败:', err);
        wx.showToast({
          title: '返回失败，请重试',
          icon: 'none'
        });
      }
    });
  }
});
