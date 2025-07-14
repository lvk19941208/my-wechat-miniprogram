Page({
  data: {
    isLoading: false,
    cloudFilePath: 'cloud://cloud1-0gl2fjfc4ecb00c7.636c-cloud1-0gl2fjfc4ecb00c7-xxx/images/' // 替换为你的云存储路径
  },

  onOnlineGuardian() {
    if (this.data.isLoading) return;
    this.setData({ isLoading: true });

    wx.login({
      success: res => {
        const code = res.code;
        wx.cloud.callFunction({
          name: 'getOpenid',
          data: { code },
          success: res => {
            const openid = res.result.openid;
            wx.showModal({
              title: '请输入手机号',
              content: '请输入您的手机号以验证监护人身份',
              showCancel: true,
              confirmText: '验证',
              success: modalRes => {
                if (modalRes.confirm) {
                  wx.showModal({
                    title: '输入手机号',
                    editable: true,
                    placeholderText: '请输入11位手机号',
                    success: inputRes => {
                      if (inputRes.confirm && inputRes.content) {
                        const phone = inputRes.content.trim();
                        if (!/^1[3-9]\d{9}$/.test(phone)) {
                          wx.showToast({
                            title: '请输入有效的手机号',
                            icon: 'none'
                          });
                          this.setData({ isLoading: false });
                          return;
                        }
                        this.verifyGuardian(openid, phone);
                      } else {
                        this.setData({ isLoading: false });
                      }
                    },
                    fail: () => {
                      this.setData({ isLoading: false });
                    }
                  });
                } else {
                  this.setData({ isLoading: false });
                }
              },
              fail: () => {
                this.setData({ isLoading: false });
              }
            });
          },
          fail: err => {
            console.error('获取 openid 失败:', err);
            wx.showToast({
              title: '获取用户信息失败',
              icon: 'none'
            });
            this.setData({ isLoading: false });
          }
        });
      },
      fail: err => {
        console.error('wx.login 失败:', err);
        wx.showToast({
          title: '登录失败，请重试',
          icon: 'none'
        });
        this.setData({ isLoading: false });
      }
    });
  },

  verifyGuardian(openid, phone) {
    const db = wx.cloud.database();
    db.collection('users').where({
      guardianPhone: phone
    }).get({
      success: res => {
        if (res.data.length > 0) {
          if (res.data.length === 1) {
            const childOpenid = res.data[0]._openid;
            wx.navigateTo({
              url: `/pages/userDetails/userDetails?openid=${childOpenid}`,
              success: () => {
                this.setData({ isLoading: false });
              }
            });
          } else {
            // 多个孩子，使用弹窗选择
            const items = res.data.map(item => `${item.name} (${item.region})`);
            const openids = res.data.map(item => item._openid);
            wx.showActionSheet({
              itemList: items,
              success: actionRes => {
                const index = actionRes.tapIndex;
                const selectedOpenid = openids[index];
                wx.navigateTo({
                  url: `/pages/userDetails/userDetails?openid=${selectedOpenid}`,
                  success: () => {
                    this.setData({ isLoading: false });
                  }
                });
              },
              fail: () => {
                this.setData({ isLoading: false });
              }
            });
          }
        } else {
          wx.showToast({
            title: '手机号验证失败',
            icon: 'none'
          });
          this.setData({ isLoading: false });
        }
      },
      fail: err => {
        console.error('验证失败:', err);
        wx.showToast({
          title: '验证失败，请重试',
          icon: 'none'
        });
        this.setData({ isLoading: false });
      }
    });
  },

  onOnlineClassroom() {
    wx.navigateTo({
      url: '/pages/onlineClassroom/onlineClassroom'
    });
  },

  onImageError(e) {
    console.error('图片加载失败:', e.detail);
    wx.showToast({
      title: '图片加载失败',
      icon: 'none'
    });
  }
});