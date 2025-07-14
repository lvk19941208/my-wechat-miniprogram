// articleViewer.js
Page({
  data: {
    imageUrl: ''
  },
  onLoad(options) {
    const fileId = decodeURIComponent(options.url || '');

    if (!fileId.startsWith('cloud://')) {
      console.error('无效的文件 ID');
      wx.showToast({ title: '文件地址无效', icon: 'none' });
      return;
    }

    wx.cloud.getTempFileURL({
      fileList: [fileId],
      success: res => {
        const tempURL = res.fileList?.[0]?.tempFileURL;
        if (tempURL) {
          this.setData({ imageUrl: tempURL });
        } else {
          wx.showToast({ title: '图片预览失败', icon: 'none' });
        }
      },
      fail: err => {
        console.error('获取图片临时链接失败:', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
    });
  }
});
