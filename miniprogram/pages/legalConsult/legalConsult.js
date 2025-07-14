Page({
  data: {
    authorized: false,
    userInfo: null
  },

  async onLoad() {
    try {
      await this.getUserOpenId()
    } catch (error) {
      console.error('登录失败', error)
      wx.showToast({
        title: '无法获取用户信息',
        icon: 'error'
      })
    }
  },

  async getUserOpenId() {
    wx.showLoading({ title: '正在验证身份...' })

    const loginRes = await wx.cloud.callFunction({
      name: 'login' // 云函数，返回 openid
    })

    const openid = loginRes.result.openid

    const dbRes = await wx.cloud.database().collection('users')
      .where({ openid })
      .get()

    wx.hideLoading()

    if (dbRes.data.length > 0) {
      this.setData({
        authorized: true,
        userInfo: dbRes.data[0]
      })
    } else {
      wx.showModal({
        title: '访问受限',
        content: '您尚未注册为服务对象，无法访问此页面。',
        showCancel: false,
        success: () => {
          wx.navigateBack()
        }
      })
    }
  },

  toConsultPage() {
    wx.navigateTo({
      url: '/pages/legalConsultChat/legalConsultChat'
    })
  },

  toCluePage() {
    wx.navigateTo({
      url: '/pages/clueSubmit/clueSubmit'
    })
  }
})
