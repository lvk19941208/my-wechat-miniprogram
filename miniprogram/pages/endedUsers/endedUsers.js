const app = getApp(); // 获取全局 app 实例

Page({
  data: {
    endedUsers: [],
    searchName: '',
    searchResults: [],
    showUpdateNameModal: false,
    showUpdatePhoneModal: false,
    showUpdateGuardianPhoneModal: false,
    showUpdateEndDateModal: false,
    selectedOpenid: '',
    newName: '',
    newPhone: '',
    newGuardianPhone: '',
    newStartDate: '',
    newEndDate: '',
    pageSize: 5,
    page: 0,
    hasMoreUsers: true,
    region: '' // 存储传入的地区
  },

  onLoad(options) {
    const adminInfo = wx.getStorageSync('adminInfo');
    if (!adminInfo || !adminInfo.isAdmin) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      wx.redirectTo({ url: '/pages/adminLogin/adminLogin' });
      return;
    }

    const { region, role } = adminInfo;
    if (!options.region) {
      wx.showToast({ title: '未选择地区', icon: 'none' });
      wx.navigateBack();
      return;
    }

    // 权限校验：普通管理员只能查看自己地区的孩子
    if (role !== 'super_admin' && options.region !== region) {
      wx.showToast({ title: '无权限查看其他地区', icon: 'none' });
      wx.navigateBack();
      return;
    }

    this.setData({
      region: options.region
    });
    this.loadUsers();
    this.logOperation(`查看了${options.region}地区的已结束帮教的孩子列表`);
  },

  async loadUsers() {
    const db = wx.cloud.database();
    const { pageSize, page, region } = this.data;
    const adminInfo = wx.getStorageSync('adminInfo');
    const { role } = adminInfo;

    try {
      const query = role === 'super_admin' ? { region: region } : { region: region };
      const res = await db.collection('users')
        .where(query)
        .skip(page * pageSize)
        .limit(pageSize)
        .get();
      const users = res.data.map(user => {
        if (user.startDate) {
          const sd = new Date(user.startDate);
          user.startDate = !isNaN(sd.getTime()) ? `${sd.getFullYear()}-${String(sd.getMonth() + 1).padStart(2, '0')}-${String(sd.getDate()).padStart(2, '0')}` : '';
        }
        if (user.endDate) {
          const ed = new Date(user.endDate);
          user.endDate = !isNaN(ed.getTime()) ? `${ed.getFullYear()}-${String(ed.getMonth() + 1).padStart(2, '0')}-${String(ed.getDate()).padStart(2, '0')}` : '';
        }
        return user;
      });
      const currentDate = new Date();
      const endedUsers = users.filter(user => user.endDate && new Date(user.endDate) < currentDate);
      this.setData({
        endedUsers: this.data.endedUsers.concat(endedUsers),
        hasMoreUsers: endedUsers.length === pageSize
      });
    } catch (err) {
      console.error('加载用户失败:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  async loadMoreUsers() {
    this.setData({ page: this.data.page + 1 });
    await this.loadUsers();
    this.logOperation(`加载了更多${this.data.region}地区的已结束帮教的孩子`);
  },

  onSearchInput(e) {
    this.setData({ searchName: e.detail.value });
  },

  async searchUsers() {
    const { searchName, region } = this.data;
    const adminInfo = wx.getStorageSync('adminInfo');
    const { role } = adminInfo;

    if (!searchName.trim()) {
      this.setData({ searchResults: [] });
      return;
    }

    const db = wx.cloud.database();
    try {
      const query = role === 'super_admin' ? {
        name: db.command.eq(searchName),
        region: region
      } : {
        name: db.command.eq(searchName),
        region: region
      };
      const res = await db.collection('users').where(query).get();
      const searchResults = res.data.map(user => {
        if (user.startDate) {
          const sd = new Date(user.startDate);
          user.startDate = !isNaN(sd.getTime()) ? `${sd.getFullYear()}-${String(sd.getMonth() + 1).padStart(2, '0')}-${String(sd.getDate()).padStart(2, '0')}` : '';
        }
        if (user.endDate) {
          const ed = new Date(user.endDate);
          user.endDate = !isNaN(ed.getTime()) ? `${ed.getFullYear()}-${String(ed.getMonth() + 1).padStart(2, '0')}-${String(ed.getDate()).padStart(2, '0')}` : '';
        }
        return user;
      });
      const currentDate = new Date();
      const endedResults = searchResults.filter(user => user.endDate && new Date(user.endDate) < currentDate);
      this.setData({ searchResults: endedResults });
      this.logOperation(`搜索了${region}地区的用户：${searchName}`);
    } catch (err) {
      console.error('搜索用户失败:', err);
      wx.showToast({ title: '搜索失败', icon: 'none' });
    }
  },

  goToUserDetails(e) {
    const openid = e.currentTarget.dataset.openid;
    this.logOperation(`查看了用户（openid: ${openid}）的详细记录`);
    app.debounceNavigate(`/pages/userDetails/userDetails?openid=${openid}`);
  },

  showUpdateNameModal(e) {
    const openid = e.currentTarget.dataset.openid;
    const name = e.currentTarget.dataset.name;
    this.setData({ showUpdateNameModal: true, selectedOpenid: openid, newName: name });
  },

  onNameInput(e) {
    this.setData({ newName: e.detail.value });
  },

  async updateName() {
    const { selectedOpenid, newName } = this.data;
    if (!newName.trim()) {
      wx.showToast({ title: '用户名不能为空', icon: 'none' });
      return;
    }
    const db = wx.cloud.database();
    try {
      await db.collection('users').where({ _openid: selectedOpenid }).update({ data: { name: newName } });
      wx.showToast({ title: '更新成功', icon: 'success' });
      this.setData({ showUpdateNameModal: false, selectedOpenid: '', newName: '', endedUsers: [], page: 0 });
      this.loadUsers();
      this.searchUsers();
      this.logOperation(`更新了用户 (openid: ${selectedOpenid}) 的用户名：${newName}`);
    } catch (err) {
      console.error('更新失败:', err);
      wx.showToast({ title: '更新失败', icon: 'none' });
    }
  },

  cancelUpdateName() {
    this.setData({ showUpdateNameModal: false, selectedOpenid: '', newName: '' });
  },

  showUpdatePhoneModal(e) {
    const openid = e.currentTarget.dataset.openid;
    const phone = e.currentTarget.dataset.phone;
    this.setData({ showUpdatePhoneModal: true, selectedOpenid: openid, newPhone: phone });
  },

  onPhoneInput(e) {
    this.setData({ newPhone: e.detail.value });
  },

  async updatePhone() {
    const { selectedOpenid, newPhone } = this.data;
    if (!newPhone.trim() || !/^1[3-9]\d{9}$/.test(newPhone)) {
      wx.showToast({ title: '请输入有效电话号码', icon: 'none' });
      return;
    }
    const db = wx.cloud.database();
    try {
      await db.collection('users').where({ _openid: selectedOpenid }).update({ data: { phone: newPhone } });
      wx.showToast({ title: '更新成功', icon: 'success' });
      this.setData({ showUpdatePhoneModal: false, selectedOpenid: '', newPhone: '', endedUsers: [], page: 0 });
      this.loadUsers();
      this.searchUsers();
      this.logOperation(`更新了用户 (openid: ${selectedOpenid}) 的电话号码：${newPhone}`);
    } catch (err) {
      console.error('更新失败:', err);
      wx.showToast({ title: '更新失败', icon: 'none' });
    }
  },

  cancelUpdatePhone() {
    this.setData({ showUpdatePhoneModal: false, selectedOpenid: '', newPhone: '' });
  },

  showUpdateGuardianPhoneModal(e) {
    const openid = e.currentTarget.dataset.openid;
    const guardianPhone = e.currentTarget.dataset.guardianPhone;
    this.setData({ showUpdateGuardianPhoneModal: true, selectedOpenid: openid, newGuardianPhone: guardianPhone });
  },

  onGuardianPhoneInput(e) {
    this.setData({ newGuardianPhone: e.detail.value });
  },

  async updateGuardianPhone() {
    const { selectedOpenid, newGuardianPhone } = this.data;
    if (!newGuardianPhone.trim() || !/^1[3-9]\d{9}$/.test(newGuardianPhone)) {
      wx.showToast({ title: '请输入有效监护人电话', icon: 'none' });
      return;
    }
    const db = wx.cloud.database();
    try {
      await db.collection('users').where({ _openid: selectedOpenid }).update({ data: { guardianPhone: newGuardianPhone } });
      wx.showToast({ title: '更新成功', icon: 'success' });
      this.setData({ showUpdateGuardianPhoneModal: false, selectedOpenid: '', newGuardianPhone: '', endedUsers: [], page: 0 });
      this.loadUsers();
      this.searchUsers();
      this.logOperation(`更新了用户 (openid: ${selectedOpenid}) 的监护人电话：${newGuardianPhone}`);
    } catch (err) {
      console.error('更新失败:', err);
      wx.showToast({ title: '更新失败', icon: 'none' });
    }
  },

  cancelUpdateGuardianPhone() {
    this.setData({ showUpdateGuardianPhoneModal: false, selectedOpenid: '', newGuardianPhone: '' });
  },

  showUpdateEndDateModal(e) {
    const openid = e.currentTarget.dataset.openid;
    const startDate = e.currentTarget.dataset.startDate;
    const endDate = e.currentTarget.dataset.endDate;
    this.setData({ showUpdateEndDateModal: true, selectedOpenid: openid, newStartDate: startDate, newEndDate: endDate });
  },

  onStartDateChange(e) {
    this.setData({ newStartDate: e.detail.value });
  },

  onEndDateChange(e) {
    this.setData({ newEndDate: e.detail.value });
  },

  async updateEndDate() {
    const { selectedOpenid, newStartDate, newEndDate } = this.data;
    if (!newStartDate || !newEndDate) {
      wx.showToast({ title: '请选择开始和结束日期', icon: 'none' });
      return;
    }
    if (new Date(newStartDate) > new Date(newEndDate)) {
      wx.showToast({ title: '开始日期不能晚于结束日期', icon: 'none' });
      return;
    }
    const db = wx.cloud.database();
    try {
      await db.collection('users').where({ _openid: selectedOpenid }).update({ data: { startDate: newStartDate, endDate: newEndDate } });
      wx.showToast({ title: '更新成功', icon: 'success' });
      this.setData({ showUpdateEndDateModal: false, selectedOpenid: '', newStartDate: '', newEndDate: '', endedUsers: [], page: 0 });
      this.loadUsers();
      this.searchUsers();
      this.logOperation(`更新了用户 (openid: ${selectedOpenid}) 的帮教日期：${newStartDate} 至 ${newEndDate}`);
    } catch (err) {
      console.error('更新失败:', err);
      wx.showToast({ title: '更新失败', icon: 'none' });
    }
  },

  cancelUpdateEndDate() {
    this.setData({ showUpdateEndDateModal: false, selectedOpenid: '', newStartDate: '', newEndDate: '' });
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