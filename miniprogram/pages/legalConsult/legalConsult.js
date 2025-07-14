Page({
  data: {
    headerImg: '',
    msgIcon: '',
    clueIcon: ''
  },

  onLoad() {
    wx.cloud.init(); // 若已在 app.js 中初始化可省略

    wx.cloud.getTempFileURL({
      fileList: [
        'cloud://cloud1-0gl2fjfc4ecb00c7.636c-cloud1-0gl2fjfc4ecb00c7-1350622662/images/Header.png',
        'cloud://cloud1-0gl2fjfc4ecb00c7.636c-cloud1-0gl2fjfc4ecb00c7-1350622662/images/msg_icon.png',
        'cloud://cloud1-0gl2fjfc4ecb00c7.636c-cloud1-0gl2fjfc4ecb00c7-1350622662/images/clue_icon.png'
      ],
      success: res => {
        const [headerImg, msgIcon, clueIcon] = res.fileList.map(f => f.tempFileURL)
        this.setData({ headerImg, msgIcon, clueIcon })
      },
      fail: err => {
        wx.showToast({ title: '图片加载失败', icon: 'none' })
        console.error('图片资源获取失败:', err)
      }
    })
  },

  toLegalMessage() {
    wx.navigateTo({
      url: '/pages/legalMessage/legalMessage'
    })
  },

  toClueUpload() {
    wx.navigateTo({
      url: '/pages/clueUpload/clueUpload'
    })
  }
})
