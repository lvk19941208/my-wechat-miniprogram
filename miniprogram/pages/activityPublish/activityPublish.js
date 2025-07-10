Page({
  data: {
    activityDate: '',
    activityLocation: '',
    activityContent: '',
    activityId: '',
    regionList: ['咸安', '赤壁', '崇阳'],
    invitedRegions: ['', '', ''], // 三个下拉框对应的地区
    regionIndexes: [0, 0, 0], // 三个下拉框的选中索引
    regionOptions2: [], // 第二个下拉框的选项
    regionOptions3: [], // 第三个下拉框的选项
    selectedRegions: '', // 预计算的当前邀请地区字符串
    adminRegion: '',
    isSuperAdmin: false
  },

  onLoad(options) {
    const adminInfo = wx.getStorageSync('adminInfo');
    if (!adminInfo || !adminInfo.isAdmin) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      wx.redirectTo({ url: '/pages/adminLogin/adminLogin' });
      return;
    }

    const { region, role } = adminInfo;
    console.log('adminInfo:', adminInfo);

    const isSuperAdmin = role === 'super_admin';
    const adminRegion = region ? region.trim() : '';
    const regionList = ['咸安', '赤壁', '崇阳'].map(item => item.trim());

    // 初始化 invitedRegions 和 regionIndexes
    let invitedRegions = ['', '', ''];
    let regionIndexes = [0, 0, 0];
    if (!isSuperAdmin && adminRegion) {
      invitedRegions[0] = adminRegion;
      regionIndexes[0] = regionList.indexOf(adminRegion);
    }

    // 动态生成第二个和第三个下拉框的选项
    const otherRegions = regionList.filter(r => r !== adminRegion);
    const regionOptions2 = ['未选', otherRegions[0] || ''];
    const regionOptions3 = ['未选', otherRegions[1] || ''];

    // 计算初始的 selectedRegions
    const selectedRegions = invitedRegions
      .filter(region => region && region !== '未选')
      .join('、');

    this.setData({
      adminRegion,
      isSuperAdmin,
      regionList,
      invitedRegions,
      regionIndexes,
      regionOptions2,
      regionOptions3,
      selectedRegions
    }, () => {
      console.log('Initial invitedRegions:', this.data.invitedRegions);
      console.log('Initial regionIndexes:', this.data.regionIndexes);
      console.log('regionOptions2:', this.data.regionOptions2);
      console.log('regionOptions3:', this.data.regionOptions3);
      console.log('Initial selectedRegions:', this.data.selectedRegions);
    });

    if (options.id) {
      this.setData({ activityId: options.id });
      this.loadActivity(options.id);
    }
  },

  onDateChange(e) {
    this.setData({ activityDate: e.detail.value });
  },

  onLocationInput(e) {
    this.setData({ activityLocation: e.detail.value });
  },

  onContentInput(e) {
    this.setData({ activityContent: e.detail.value });
  },

  onRegionChange(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    const selectedIndex = e.detail.value;
    console.log('onRegionChange triggered, index:', index, 'selectedIndex:', selectedIndex);

    let invitedRegions = [...this.data.invitedRegions];
    let regionIndexes = [...this.data.regionIndexes];

    // 根据下拉框位置更新地区
    if (index === 0) {
      invitedRegions[0] = this.data.regionList[selectedIndex];
    } else if (index === 1) {
      invitedRegions[1] = this.data.regionOptions2[selectedIndex];
    } else if (index === 2) {
      invitedRegions[2] = this.data.regionOptions3[selectedIndex];
    }

    regionIndexes[index] = selectedIndex;

    // 计算 selectedRegions
    const selectedRegions = invitedRegions
      .filter(region => region && region !== '未选')
      .join('、');

    this.setData({
      invitedRegions,
      regionIndexes,
      selectedRegions
    }, () => {
      console.log('setData completed, invitedRegions:', this.data.invitedRegions);
      console.log('setData completed, regionIndexes:', this.data.regionIndexes);
      console.log('setData completed, selectedRegions:', this.data.selectedRegions);
    });
  },

  loadActivity(id) {
    const db = wx.cloud.database();
    db.collection('activities').doc(id).get({
      success: res => {
        const loadedRegions = res.data.invitedRegions ? res.data.invitedRegions.map(item => item.trim()) : [];
        let invitedRegions = ['', '', ''];
        let regionIndexes = [0, 0, 0];

        // 第一个下拉框：管理员地区或第一个地区
        if (this.data.isSuperAdmin) {
          invitedRegions[0] = loadedRegions[0] || '';
          regionIndexes[0] = this.data.regionList.indexOf(loadedRegions[0]) || 0;
        } else {
          invitedRegions[0] = this.data.adminRegion;
          regionIndexes[0] = this.data.regionList.indexOf(this.data.adminRegion);
        }

        // 第二个和第三个下拉框：匹配其他地区
        const otherRegions = loadedRegions.filter(r => r !== this.data.adminRegion);
        invitedRegions[1] = otherRegions[0] || '未选';
        invitedRegions[2] = otherRegions[1] || '未选';
        regionIndexes[1] = this.data.regionOptions2.indexOf(invitedRegions[1]);
        regionIndexes[2] = this.data.regionOptions3.indexOf(invitedRegions[2]);

        // 计算 selectedRegions
        const selectedRegions = invitedRegions
          .filter(region => region && region !== '未选')
          .join('、');

        this.setData({
          activityDate: res.data.date.split('T')[0],
          activityLocation: res.data.location,
          activityContent: res.data.content,
          invitedRegions,
          regionIndexes,
          selectedRegions
        });
      },
      fail: err => {
        console.error('加载活动失败', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
    });
  },

  publishActivity() {
    const { activityDate, activityLocation, activityContent, invitedRegions } = this.data;
    if (!activityDate || !activityLocation.trim() || !activityContent.trim()) {
      wx.showToast({ title: '请填写所有字段', icon: 'none' });
      return;
    }

    const selectedRegions = invitedRegions.filter(region => region && region !== '未选');
    if (selectedRegions.length === 0) {
      wx.showToast({ title: '请选择至少一个地区', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '发布中...' });

    const db = wx.cloud.database();
    db.collection('activities').add({
      data: {
        date: new Date(activityDate).toISOString(),
        location: activityLocation.trim(),
        content: activityContent.trim(),
        createdAt: new Date(),
        isPublic: true,
        invitedRegions: selectedRegions
      },
      success: res => {
        wx.hideLoading();
        wx.showToast({ title: '发布成功', icon: 'success' });
        this.logOperation(`发布了新活动，邀请地区：${selectedRegions.join('、')}`);
        wx.navigateBack();
      },
      fail: err => {
        wx.hideLoading();
        console.error('发布失败', err);
        wx.showToast({ title: '发布失败', icon: 'none' });
      }
    });
  },

  updateActivity() {
    const { activityId, activityDate, activityLocation, activityContent, invitedRegions } = this.data;
    if (!activityDate || !activityLocation.trim() || !activityContent.trim()) {
      wx.showToast({ title: '请填写所有字段', icon: 'none' });
      return;
    }

    const selectedRegions = invitedRegions.filter(region => region && region !== '未选');
    if (selectedRegions.length === 0) {
      wx.showToast({ title: '请选择至少一个地区', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '更新中...' });

    const db = wx.cloud.database();
    db.collection('activities').doc(activityId).update({
      data: {
        date: new Date(activityDate).toISOString(),
        location: activityLocation.trim(),
        content: activityContent.trim(),
        updatedAt: new Date(),
        isPublic: true,
        invitedRegions: selectedRegions
      },
      success: res => {
        wx.hideLoading();
        wx.showToast({ title: '更新成功', icon: 'success' });
        this.logOperation(`更新了活动（ID: ${activityId}），邀请地区：${selectedRegions.join('、')}`);
        wx.navigateBack();
      },
      fail: err => {
        wx.hideLoading();
        console.error('更新失败', err);
        wx.showToast({ title: '更新失败', icon: 'none' });
      }
    });
  },

  deleteActivity() {
    const { activityId } = this.data;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除此活动吗？',
      success: res => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          const db = wx.cloud.database();
          db.collection('activities').doc(activityId).remove({
            success: () => {
              wx.hideLoading();
              wx.showToast({ title: '删除成功', icon: 'success' });
              this.logOperation(`删除了活动（ID: ${activityId}）`);
              wx.navigateBack();
            },
            fail: err => {
              wx.hideLoading();
              console.error('删除失败', err);
              wx.showToast({ title: '删除失败', icon: 'none' });
            }
          });
        }
      }
    });
  },

  goBack() {
    this.logOperation('返回上一页');
    wx.navigateBack();
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