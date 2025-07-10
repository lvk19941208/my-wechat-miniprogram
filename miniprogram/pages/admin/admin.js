Page({
  data: {
    region: '',
    regionList: ['咸安', '赤壁', '崇阳'],
    regionIndex: -1,
    isSuperAdmin: false,
    riskAlerts: [],
    lastCheckTime: 0
  },

  onLoad() {
    const adminInfo = wx.getStorageSync('adminInfo');
    if (!adminInfo || !adminInfo.isAdmin) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      wx.redirectTo({ url: '/pages/adminLogin/adminLogin' });
      return;
    }

    const { region, role } = adminInfo;
    if (role === 'super_admin') {
      this.setData({
        isSuperAdmin: true,
        region: region === 'all' ? '' : region,
        regionIndex: -1
      });
    } else {
      this.setData({
        isSuperAdmin: false,
        region: region,
        regionList: [region],
        regionIndex: 0
      });
    }

    this.checkRiskOnLoad();
  },

  onRegionChange(e) {
    const index = e.detail.value;
    this.setData({
      regionIndex: index,
      region: this.data.regionList[index]
    });
    this.checkRiskOnLoad();
  },

  async checkRiskOnLoad() {
    const { region, isSuperAdmin, lastCheckTime } = this.data;
    const now = Date.now();

    if (now - lastCheckTime < 5 * 60 * 1000) {
      console.log('Risk check skipped: too frequent');
      this.fetchActiveAlerts();
      return;
    }

    wx.showLoading({
      title: '检查风险中...',
      mask: true
    });

    try {
      const checkRiskRes = await wx.cloud.callFunction({
        name: 'checkRisk',
        data: {
          region: isSuperAdmin && region === '' ? 'all' : region
        }
      });
      console.log('checkRisk result:', checkRiskRes);

      if (!checkRiskRes.result.success) {
        wx.hideLoading();
        wx.showToast({ title: '风险检查失败', icon: 'none', duration: 3000 });
        return;
      }

      await this.fetchActiveAlerts();
      this.setData({ lastCheckTime: now });
    } catch (err) {
      wx.hideLoading();
      console.error('Check risk error:', err);
      wx.showToast({ title: '加载失败', icon: 'none', duration: 3000 });
    }
  },

  async fetchActiveAlerts() {
    const { region, isSuperAdmin } = this.data;
    const db = wx.cloud.database();
    const query = isSuperAdmin && region === '' 
      ? { status: 'active' } 
      : { status: 'active', region: region };

    wx.showLoading({ title: '加载预警中...', mask: true });

    try {
      const res = await db.collection('risk_alerts')
        .where(query)
        .get();
      const activeAlerts = res.data;
      console.log('Active alerts from DB:', JSON.stringify(activeAlerts));
      this.setData({ riskAlerts: activeAlerts });

      if (activeAlerts.length > 0) {
        this.showRiskAlertPopup();
      } else {
        wx.showToast({
          title: '暂无活跃风险预警',
          icon: 'none',
          duration: 3000
        });
      }
    } catch (err) {
      console.error('Query risk alerts error:', err);
      wx.showToast({ title: '加载失败', icon: 'none', duration: 3000 });
    } finally {
      wx.hideLoading(); // 确保无论成功或失败都隐藏加载提示
    }
  },

  showRiskAlertPopup() {
    const { riskAlerts, region, isSuperAdmin } = this.data;
    const alertCount = riskAlerts.length;
    const regionText = isSuperAdmin && !region ? '所有地区' : region;

    // 只显示未签到用户的姓名列表
    const userNames = riskAlerts.map(alert => alert.name).join('、');
    const content = `当前地区（${regionText}）有 ${alertCount} 个未签到风险，请及时处理！\n未签到用户：${userNames}`;

    wx.showModal({
      title: '风险预警',
      content: content,
      confirmText: '查看详情',
      cancelText: '稍后处理',
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({
            url: '/pages/riskAlerts/riskAlerts'
          });
        }
      }
    });
  },

  goToActiveUsers() {
    const { region } = this.data;
    if (!region && this.data.isSuperAdmin) {
      wx.showToast({ title: '请选择地区', icon: 'none' });
      return;
    }
    this.logOperation(`跳转到正在帮教的孩子页面（地区：${region}）`);
    wx.navigateTo({ url: `/pages/activeUsers/activeUsers?region=${region}` });
  },

  goToEndedUsers() {
    const { region } = this.data;
    if (!region && this.data.isSuperAdmin) {
      wx.showToast({ title: '请选择地区', icon: 'none' });
      return;
    }
    this.logOperation(`跳转到已结束帮教的孩子页面（地区：${region}）`);
    wx.navigateTo({ url: `/pages/endedUsers/endedUsers?region=${region}` });
  },

  goToActivities() {
    this.logOperation('跳转到活动管理页面');
    wx.navigateTo({ url: '/pages/activities/activities' });
  },

  goToNotifyUsers() {
    const { region } = this.data;
    if (!region && this.data.isSuperAdmin) {
      wx.showToast({ title: '请选择地区', icon: 'none' });
      return;
    }
    this.logOperation(`跳转到发送通知页面（地区：${region}）`);
    wx.navigateTo({ url: `/pages/notifyUsers/notifyUsers?region=${region}` });
  },

  goToRiskAlerts() {
    this.logOperation('跳转到风险预警页面');
    wx.navigateTo({ url: '/pages/riskAlerts/riskAlerts' });
  },

  goToResolvedAlerts() {
    this.logOperation('跳转到已解决风险预警页面');
    wx.navigateTo({ url: '/pages/resolvedAlerts/resolvedAlerts' });
  },

  goToLawVideos() {
    this.logOperation('跳转到法律视频管理页面');
    wx.navigateTo({ url: '/pages/lawVideos/lawVideos' });
  },

  goBack() {
    this.logOperation('返回上一页');
    wx.navigateBack();
  },

  exportUserData() {
    const adminInfo = wx.getStorageSync('adminInfo');
    if (!adminInfo.region && !adminInfo.isSuperAdmin) {
      wx.showToast({ title: '请先选择地区', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '请输入用户名',
      content: '',
      editable: true,
      placeholderText: '请输入要导出的用户名',
      success: (res) => {
        if (res.confirm && res.content) {
          const name = res.content.trim();
          if (!name) {
            wx.showToast({ title: '用户名不能为空', icon: 'none' });
            return;
          }
          this.searchAndExportUserData(name);
        }
      }
    });
  },

  async searchAndExportUserData(name) {
    const adminInfo = wx.getStorageSync('adminInfo');
    const { region, role } = adminInfo;

    wx.showLoading({
      title: '搜索中...',
      mask: true
    });

    try {
      const db = wx.cloud.database();
      const query = role === 'super_admin' ? { name: db.RegExp({ regexp: name, options: 'i' }) } : {
        name: db.RegExp({ regexp: name, options: 'i' }),
        region: region
      };
      const usersRes = await db.collection('users').where(query).get();
      wx.hideLoading();

      const users = usersRes.data;
      console.log('Found users:', users);

      if (!users.length) {
        wx.showToast({ title: '未找到该用户', icon: 'none' });
        return;
      }

      if (users.length === 1) {
        this.exportDataForUser(users[0]);
      } else {
        const userOptions = users.map(user => ({
          label: `${user.name} (结案日期: ${user.endDate || '未设置'})`,
          openid: user._openid
        }));
        wx.showActionSheet({
          itemList: userOptions.map(opt => opt.label),
          success: (res) => {
            const selectedUser = users.find(user => user._openid === userOptions[res.tapIndex].openid);
            this.exportDataForUser(selectedUser);
          },
          fail: () => {
            wx.showToast({ title: '取消选择', icon: 'none' });
          }
        });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('Search user error:', err);
      wx.showToast({
        title: '搜索失败',
        icon: 'none'
      });
    }
  },

  exportDataForUser(user) {
    wx.showLoading({
      title: '导出中...',
      mask: true
    });

    wx.cloud.callFunction({
      name: 'exportUserData',
      data: {
        openid: user._openid,
        name: user.name
      }
    }).then(res => {
      wx.hideLoading();
      console.log('Export result:', res);
      if (res.result.success) {
        const fileID = res.result.fileID;
        wx.cloud.downloadFile({
          fileID: fileID,
          success: downloadRes => {
            const tempFilePath = downloadRes.tempFilePath;
            console.log('File downloaded to:', tempFilePath);

            wx.showModal({
              title: '文件已下载',
              content: 'Excel 文件已下载到临时路径，无法直接打开。请点击“分享”将文件发送到微信聊天或电脑上查看。',
              confirmText: '分享',
              cancelText: '取消',
              success: modalRes => {
                if (modalRes.confirm) {
                  wx.shareFileMessage({
                    filePath: tempFilePath,
                    fileName: `用户数据_${user.name}.xlsx`,
                    success: () => {
                      wx.showToast({
                        title: '已分享',
                        icon: 'success'
                      });
                      this.logOperation(`导出了用户 ${user.name} 的数据`);
                    },
                    fail: err => {
                      console.error('Share file error:', err);
                      wx.showToast({
                        title: '分享失败',
                        icon: 'none'
                      });
                    }
                  });
                }
              }
            });
          },
          fail: err => {
            console.error('Download file error:', err);
            wx.showToast({
              title: '下载失败',
              icon: 'none'
            });
          }
        });
      } else {
        wx.showToast({
          title: '导出失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('Export error:', err);
      wx.showToast({
        title: '导出失败',
        icon: 'none'
      });
    });
  },

  logOperation(operation) {
    const adminInfo = wx.getStorageSync('adminInfo');
    const db = wx.cloud.database();
    db.collection('operation_logs')
      .add({
        data: {
          username: adminInfo.username,
          operation: operation,
          timestamp: new Date()
        }
      })
      .catch(err => {
        console.error('Log operation error:', err);
      });
  }
});