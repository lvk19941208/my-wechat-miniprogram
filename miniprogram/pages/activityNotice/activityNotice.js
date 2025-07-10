const app = getApp();

Page({
  data: {
    activity: {},
    isRegistered: false,
    isRegistering: false,
    userInfo: null,
    activityId: ''
  },

  onLoad(options) {
    console.log('页面加载，options:', options, '时间:', new Date().toLocaleString());
    const openid = wx.getStorageSync('openid');
    if (!openid) {
      console.log('未登录，跳转返回');
      wx.showToast({
        title: '用户未登录',
        icon: 'none'
      });
      wx.navigateBack();
      return;
    }

    if (options.id) {
      this.setData({ activityId: options.id });
      console.log('活动ID有效:', options.id);
      this.loadUserInfo(openid);
      this.loadActivity(options.id);
    } else {
      console.log('未找到活动ID，跳转返回');
      wx.showToast({
        title: '未找到活动ID',
        icon: 'none'
      });
      wx.navigateBack();
    }
  },

  onReady() {
    console.log('页面渲染完成，按钮应显示，数据:', this.data);
  },

  // 加载用户信息
  async loadUserInfo(openid) {
    const db = wx.cloud.database();
    try {
      const res = await db.collection('users').where({ _openid: openid }).get();
      if (res.data.length === 0) {
        throw new Error('未找到用户信息');
      }
      this.setData({
        userInfo: res.data[0]
      });
      console.log('用户信息:', res.data[0]);
    } catch (err) {
      console.error('加载用户信息失败:', err);
      wx.showToast({
        title: '加载用户信息失败',
        icon: 'none'
      });
    }
  },

  // 格式化日期
  formatDate(date) {
    if (!date) return '暂无时间';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 加载活动详情并检查报名状态
  async loadActivity(id) {
    console.log('加载活动，ID:', id);
    wx.showLoading({ title: '加载中...', mask: true });

    const db = wx.cloud.database();
    try {
      const res = await db.collection('activities').doc(id).get();
      console.log('活动详情:', res.data);
      const formattedActivity = {
        ...res.data,
        date: this.formatDate(res.data.date)
      };
      this.setData({
        activity: formattedActivity
      });
      wx.setNavigationBarTitle({
        title: '活动通知 - ' + formattedActivity.date
      });

      await this.checkRegistration(id);
    } catch (err) {
      console.error('加载活动失败:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } finally {
      wx.hideLoading();
    }
  },

  // 检查用户是否已报名
  async checkRegistration(activityId) {
    const { userInfo } = this.data;
    if (!userInfo) {
      console.log('用户信息未加载，跳过报名检查');
      return;
    }

    const db = wx.cloud.database();
    try {
      const res = await db.collection('activities').doc(activityId).get();
      const participants = res.data.participants || [];
      const isRegistered = participants.some(p => p.openid === userInfo._openid);
      this.setData({ isRegistered });
      console.log('报名状态检查:', { openid: userInfo._openid, isRegistered, participants });
    } catch (err) {
      console.error('检查报名状态失败:', err);
      wx.showToast({
        title: '检查报名状态失败',
        icon: 'none'
      });
    }
  },

  // 报名活动
  async registerActivity() {
    const { activityId, userInfo, isRegistered, isRegistering } = this.data;
    if (isRegistered || isRegistering || !userInfo) {
      console.log('阻止报名:', { isRegistered, isRegistering, userInfo });
      return;
    }

    this.setData({ isRegistering: true });
    console.log('开始报名，活动ID:', activityId);

    const db = wx.cloud.database();
    try {
      const participant = {
        openid: userInfo._openid,
        name: userInfo.name
      };

      const activityRes = await db.collection('activities').doc(activityId).get();
      const participants = activityRes.data.participants || [];
      if (participants.some(p => p.openid === userInfo._openid)) {
        this.setData({
          isRegistered: true,
          isRegistering: false
        });
        wx.showToast({
          title: '您已报名',
          icon: 'none'
        });
        console.log('重复报名检测:', participant);
        return;
      }

      await db.collection('activities').doc(activityId).update({
        data: {
          participants: db.command.push(participant)
        }
      });

      this.setData({
        isRegistered: true,
        isRegistering: false
      });
      wx.showToast({
        title: '报名成功',
        icon: 'success'
      });
      console.log('报名成功:', { participant, activityId });
    } catch (err) {
      console.error('报名失败:', err);
      wx.showToast({
        title: '报名失败，请重试',
        icon: 'none'
      });
      this.setData({ isRegistering: false });
    }
  },

  goBack() {
    wx.navigateBack();
  }
});