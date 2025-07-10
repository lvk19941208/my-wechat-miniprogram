Page({
  data: {
    users: []
  },
  onLoad() {
    const db = wx.cloud.database()
    db.collection('users').get({
      success: res => {
        console.log('获取用户列表成功', res)
        this.setData({ users: res.data })
      },
      fail: err => {
        console.log('获取用户列表失败', err)
        wx.showToast({ title: '加载失败', icon: 'none' })
      }
    })
  },
  viewUserDetails(e) {
    const openid = e.currentTarget.dataset.openid
    wx.showModal({
      title: '跳转时的 openid',
      content: openid || '未获取到 openid',
      showCancel: false
    })
    wx.navigateTo({
      url: `/pages/userDetails/userDetails?openid=${openid}`
    })
  },
  exportCheckins() {
    const db = wx.cloud.database()
    db.collection('checkins').get({
      success: res => {
        const checkins = res.data
        let csvContent = '\ufeff'
        csvContent += '用户openid,签到时间,地址,照片URL\n'
        checkins.forEach(item => {
          const row = `${item._openid},${item.timestamp},${item.address},${item.photo_url}`
          csvContent += row + '\n'
        })
        const fileName = `checkins_${new Date().getTime()}.csv`
        wx.getFileSystemManager().writeFile({
          filePath: `${wx.env.USER_DATA_PATH}/${fileName}`,
          data: csvContent,
          encoding: 'utf8',
          success: () => {
            wx.showToast({ title: '导出成功', icon: 'success' })
            wx.saveFile({
              tempFilePath: `${wx.env.USER_DATA_PATH}/${fileName}`,
              success: res => {
                wx.showModal({
                  title: '导出完成',
                  content: `文件已保存到手机：${res.savedFilePath}`,
                  showCancel: false
                })
              }
            })
          },
          fail: err => {
            wx.showToast({ title: '导出失败', icon: 'none' })
            console.log('导出失败', err)
          }
        })
      },
      fail: err => {
        wx.showToast({ title: '获取签到数据失败', icon: 'none' })
        console.log('获取签到数据失败', err)
      }
    })
  },
  logout() {
    wx.navigateBack()
  }
})