const app = getApp();

Page({
  data: {
    userName: '',
    showActivityNotice: false,
    showNotify: false,
    userRegion: '',
    openid: ''
  },

  onLoad() {
    const dbUserInfo = wx.getStorageSync('dbUserInfo') || {};
    const userName = dbUserInfo.name || wx.getStorageSync('userName') || '未知用户';
    const userRegion = dbUserInfo.region || '';
    const openid = wx.getStorageSync('openid') || '';

    this.setData({
      userName,
      userRegion,
      openid
    });

    if (!userName || !userRegion || !openid) {
      this.loadUserRegion(userName);
    } else {
      this.checkNotifications();
    }
  },

  onShow() {
    this.checkNotifications();
  },

  async loadUserRegion(userName) {
    const db = wx.cloud.database();
    const openid = wx.getStorageSync('openid');

    if (!openid) {
      console.error('未找到 openid');
      wx.showToast({ title: '请重新登录', icon: 'none' });
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }

    try {
      const res = await db.collection('users')
        .where({ _openid: openid })
        .get();
      if (res.data.length > 0) {
        const dbUserInfo = res.data[0];
        this.setData({
          userName: dbUserInfo.name || '未知用户',
          userRegion: dbUserInfo.region || '',
          openid
        });
        wx.setStorageSync('dbUserInfo', dbUserInfo);
        this.checkNotifications();
      } else {
        console.error('未找到用户信息');
        wx.showToast({ title: '用户信息缺失，请注册', icon: 'none' });
        wx.redirectTo({ url: '/pages/register/register?openid=' + openid });
      }
    } catch (err) {
      console.error('加载用户地区失败:', err);
      wx.showToast({ title: '加载用户信息失败', icon: 'none' });
    }
  },

  checkNotifications() {
    const db = wx.cloud.database();
    const { userName, userRegion, openid } = this.data;

    if (!userName || userName === '未知用户') {
      console.error('未找到有效的 userName');
      this.setData({ showNotify: false });
      return;
    }

    if (!userRegion) {
      console.error('未找到 userRegion');
      this.setData({ showNotify: false });
      return;
    }

    if (!openid) {
      console.error('未找到 openid');
      this.setData({ showNotify: false });
      return;
    }

    console.log('checkNotifications 执行，userName:', userName, 'openid:', openid);

    // 检查未读通知
    db.collection('notices')
      .where({
        target_name: userName,
        viewed: false
      })
      .limit(1)
      .get({
        success: res => {
          console.log('检查通知结果:', res.data);
          const hasUnread = res.data.length > 0;
          this.setData({
            showNotify: hasUnread
          });
          console.log('showNotify 更新为:', hasUnread);
        },
        fail: err => {
          console.error('检查通知失败:', err);
          this.setData({ showNotify: false });
          wx.showToast({ title: '检查通知失败', icon: 'none' });
        }
      });

    // 检查本月公共活动
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    db.collection('activities')
      .where({
        date: db.command.gte(startOfMonth.toISOString()).and(db.command.lte(endOfMonth.toISOString())),
        isPublic: true,
        invitedRegions: db.command.in([userRegion])
      })
      .limit(1)
      .get({
        success: res => {
          console.log('检查活动通知结果:', res.data);
          if (res.data.length > 0) {
            const activityDate = new Date(res.data[0].date);
            const nextDay = new Date(activityDate);
            nextDay.setDate(activityDate.getDate() + 1);
            const shouldShow = now <= nextDay;
            this.setData({
              showActivityNotice: shouldShow
            });
          } else {
            this.setData({
              showActivityNotice: false
            });
          }
        },
        fail: err => {
          console.error('检查活动通知失败:', err);
          this.setData({ showActivityNotice: false });
        }
      });
  },

  goToActivityNotice() {
    const db = wx.cloud.database();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    wx.showLoading({ title: '查询中...' });

    db.collection('activities')
      .where({
        date: db.command.gte(startOfMonth.toISOString()).and(db.command.lte(endOfMonth.toISOString())),
        isPublic: true,
        invitedRegions: db.command.in([this.data.userRegion])
      })
      .orderBy('date', 'desc')
      .limit(1)
      .get({
        success: res => {
          wx.hideLoading();
          if (res.data.length > 0) {
            const activityDate = new Date(res.data[0].date);
            const nextDay = new Date(activityDate);
            nextDay.setDate(activityDate.getDate() + 1);
            if (now <= nextDay) {
              const activityId = res.data[0]._id;
              wx.navigateTo({ url: `/pages/activityNotice/activityNotice?id=${activityId}` });
            } else {
              wx.showToast({ title: '本月活动已结束', icon: 'none' });
            }
          } else {
            wx.showToast({ title: '暂无本月活动', icon: 'none' });
          }
        },
        fail: err => {
          wx.hideLoading();
          console.error('查询活动失败:', err);
          wx.showToast({ title: '查询失败', icon: 'none' });
        }
      });
  },

  goToNotifyDetail() {
    const db = wx.cloud.database();
    const { userName, openid } = this.data;

    if (!userName || userName === '未知用户') {
      wx.showToast({ title: '用户信息缺失', icon: 'none' });
      console.error('goToNotifyDetail: 未找到 userName');
      return;
    }

    if (!openid) {
      wx.showToast({ title: '用户身份缺失，请重新登录', icon: 'none' });
      console.error('goToNotifyDetail: 未找到 openid');
      return;
    }

    console.log('goToNotifyDetail 点击，userName:', userName, 'openid:', openid);

    wx.showLoading({ title: '查询中...' });

    db.collection('notices')
      .where({
        target_name: userName,
        viewed: false
      })
      .orderBy('createdAt', 'desc')
      .get({
        success: res => {
          wx.hideLoading();
          console.log('获取通知结果:', res.data);
          if (res.data.length > 0) {
            let notice = res.data.find(item => item.target_openid === openid) || res.data[0];
            const noticeId = notice._id;
            wx.navigateTo({ url: `/pages/notifyDetail/notifyDetail?id=${noticeId}` });
          } else {
            wx.showToast({ title: '暂无新通知', icon: 'none' });
            this.setData({ showNotify: false });
          }
        },
        fail: err => {
          wx.hideLoading();
          console.error('获取通知失败:', err);
          wx.showToast({ title: '加载通知失败: ' + (err.errMsg || '未知错误'), icon: 'none' });
        }
      });
  },

  goToCheckin() {
    wx.navigateTo({ url: '/pages/checkin/checkin' });
  },

  goToCheckinRecords() {
    wx.navigateTo({ url: '/pages/myRecords/myRecords' });
  },

  goToDaily() {
    wx.navigateTo({ url: '/pages/daily/daily' });
  },

  goToActivityReflection() {
    wx.navigateTo({ url: '/pages/activityReflection/activityReflection' });
  },

  goToLawClassroom() {
    const openid = this.data.openid;
    wx.navigateTo({ url: `/pages/lawClassroom/lawClassroom?openid=${openid}` });
  }
});