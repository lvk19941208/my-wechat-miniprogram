Page({
  data: {
    userName: '',
    yearList: [],
    selectedYear: '',
    monthList: [],
    selectedMonth: '',
    checkins: [],
    dailyLogs: [],
    reflections: [],
    selectedOpenid: '',
    pageSize: 10,
    checkinPage: 0,
    dailyLogPage: 0,
    reflectionPage: 0,
    hasMoreCheckins: true,
    hasMoreDailyLogs: true,
    hasMoreReflections: true
  },

  onLoad() {
    const openid = wx.getStorageSync('openid');
    const userName = wx.getStorageSync('userName') || '未知用户';
    this.setData({
      userName: userName,
      selectedOpenid: openid
    });

    if (openid) {
      this.loadYearList();
    } else {
      wx.showToast({
        title: '用户未登录',
        icon: 'none'
      });
      wx.navigateBack();
    }
  },

  async loadCheckins(openid, date) {
    const db = wx.cloud.database();
    const _ = db.command;
    const { pageSize, checkinPage } = this.data;
    const [year, monthNum] = date.split('-');
    const startDate = new Date(`${year}-${monthNum}-01T00:00:00.000Z`);
    const endDate = new Date(year, parseInt(monthNum), 0, 23, 59, 59, 999);

    try {
      const res = await db.collection('checkins')
        .where({
          _openid: openid,
          timestamp: _.gte(startDate).and(_.lte(endDate))
        })
        .skip(checkinPage * pageSize)
        .limit(pageSize)
        .get();

      const newCheckins = res.data.map(item => {
        item.timestamp = this.formatDate(item.timestamp);
        item.originalPhotoUrl = item.photo_url || '';
        item.photo_url = '';
        return item;
      });

      const fileList = newCheckins
        .filter(item => item.originalPhotoUrl && typeof item.originalPhotoUrl === 'string')
        .map(item => item.originalPhotoUrl);

      if (fileList.length > 0) {
        try {
          const tempRes = await wx.cloud.getTempFileURL({ fileList });
          if (tempRes.errMsg !== 'cloud.getTempFileURL:ok') {
            newCheckins.forEach(item => {
              if (item.originalPhotoUrl) {
                item.photo_url = '';
              }
            });
          } else {
            tempRes.fileList.forEach((file, index) => {
              const originalFileID = file.fileID;
              const tempFileURL = file.tempFileURL;
              const statusCode = file.status;

              if (statusCode === 0 && tempFileURL) {
                const checkinItem = newCheckins.find(item => item.originalPhotoUrl === originalFileID);
                if (checkinItem) {
                  checkinItem.photo_url = tempFileURL;
                }
              } else {
                const checkinItem = newCheckins.find(item => item.originalPhotoUrl === originalFileID);
                if (checkinItem) {
                  checkinItem.photo_url = '';
                }
              }
            });
          }
        } catch (err) {
          newCheckins.forEach(item => {
            if (item.originalPhotoUrl) {
              item.photo_url = '';
            }
          });
        }
      }

      this.setData({
        checkins: this.data.checkins.concat(newCheckins),
        hasMoreCheckins: newCheckins.length === pageSize
      });
    } catch (err) {
      console.error('签到查询失败:', err);
      this.setData({ hasMoreCheckins: false });
    }
  },

  async loadDailyLogs(openid, date) {
    const db = wx.cloud.database();
    const _ = db.command;
    const { pageSize, dailyLogPage } = this.data;
    const [year, monthNum] = date.split('-');
    const startDate = new Date(`${year}-${monthNum}-01T00:00:00.000Z`);
    const endDate = new Date(year, parseInt(monthNum), 0, 23, 59, 59, 999);

    try {
      const res = await db.collection('daily_logs')
        .where({
          _openid: openid,
          timestamp: _.gte(startDate).and(_.lte(endDate))
        })
        .skip(dailyLogPage * pageSize)
        .limit(pageSize)
        .get();

      const newDailyLogs = res.data.map(item => {
        item.timestamp = this.formatDate(item.timestamp);
        return item;
      });

      this.setData({
        dailyLogs: this.data.dailyLogs.concat(newDailyLogs),
        hasMoreDailyLogs: newDailyLogs.length === pageSize
      });
    } catch (err) {
      console.error('分享查询失败:', err);
      this.setData({ hasMoreDailyLogs: false });
    }
  },

  async loadReflections(openid, date) {
    const db = wx.cloud.database();
    const _ = db.command;
    const { pageSize, reflectionPage } = this.data;
    const [year, monthNum] = date.split('-');
    const startDate = new Date(`${year}-${monthNum}-01T00:00:00.000Z`);
    const endDate = new Date(year, parseInt(monthNum), 0, 23, 59, 59, 999);

    try {
      const res = await db.collection('activity_reflections')
        .where({
          _openid: openid,
          timestamp: _.gte(startDate).and(_.lte(endDate))
        })
        .skip(reflectionPage * pageSize)
        .limit(pageSize)
        .get();

      const newReflections = await Promise.all(res.data.map(async item => {
        item.timestamp = this.formatDate(item.timestamp);
        if (item.feedback_timestamp) {
          item.feedback_timestamp = this.formatDate(item.feedback_timestamp);
        }

        // 处理图片：从 imagePaths 获取临时 URL
        if (item.imagePaths && item.imagePaths.length > 0) {
          const fileList = item.imagePaths;
          console.log('获取心得图片临时URL，fileList:', fileList);
          try {
            const urlRes = await wx.cloud.getTempFileURL({ fileList });
            console.log('临时URL结果:', urlRes);
            item.imageUrls = urlRes.fileList.map(file => {
              if (file.status !== 0) {
                console.error('获取临时URL失败:', file);
                return '';
              }
              return file.tempFileURL;
            }).filter(url => url);
          } catch (err) {
            console.error('获取心得图片临时URL失败:', err);
            item.imageUrls = [];
          }
        } else {
          item.imageUrls = [];
        }

        return item;
      }));

      this.setData({
        reflections: this.data.reflections.concat(newReflections),
        hasMoreReflections: newReflections.length === pageSize
      });
    } catch (err) {
      console.error('加载心得失败:', err);
      this.setData({ hasMoreReflections: false });
    }
  },

  loadYearList() {
    const currentYear = new Date().getFullYear();
    const startYear = 2024;
    const yearList = [];
    for (let year = startYear; year <= currentYear; year++) {
      yearList.push(year.toString());
    }
    this.setData({
      yearList,
      selectedYear: currentYear.toString()
    });
    this.loadMonthList();
  },

  loadMonthList() {
    const monthList = [
      '01', '02', '03', '04', '05', '06',
      '07', '08', '09', '10', '11', '12'
    ];
    this.setData({
      monthList,
      selectedMonth: ''
    });
  },

  onYearChange(e) {
    const selectedYear = this.data.yearList[e.detail.value];
    this.setData({
      selectedYear,
      selectedMonth: '',
      checkins: [],
      dailyLogs: [],
      reflections: [],
      checkinPage: 0,
      dailyLogPage: 0,
      reflectionPage: 0,
      hasMoreCheckins: true,
      hasMoreDailyLogs: true,
      hasMoreReflections: true
    });
  },

  onMonthChange(e) {
    const selectedMonth = this.data.monthList[e.detail.value];
    this.setData({
      selectedMonth,
      checkins: [],
      dailyLogs: [],
      reflections: [],
      checkinPage: 0,
      dailyLogPage: 0,
      reflectionPage: 0,
      hasMoreCheckins: true,
      hasMoreDailyLogs: true,
      hasMoreReflections: true
    });
    if (this.data.selectedOpenid) {
      this.loadData(this.data.selectedOpenid, `${this.data.selectedYear}-${selectedMonth}`);
    }
  },

  loadData(openid, date) {
    this.loadCheckins(openid, date);
    this.loadDailyLogs(openid, date);
    this.loadReflections(openid, date);
  },

  loadMoreCheckins() {
    this.setData({ checkinPage: this.data.checkinPage + 1 });
    this.loadCheckins(this.data.selectedOpenid, `${this.data.selectedYear}-${this.data.selectedMonth}`);
  },

  loadMoreDailyLogs() {
    this.setData({ dailyLogPage: this.data.dailyLogPage + 1 });
    this.loadDailyLogs(this.data.selectedOpenid, `${this.data.selectedYear}-${this.data.selectedMonth}`);
  },

  loadMoreReflections() {
    this.setData({ reflectionPage: this.data.reflectionPage + 1 });
    this.loadReflections(this.data.selectedOpenid, `${this.data.selectedYear}-${this.data.selectedMonth}`);
  },

  formatDate(date) {
    const d = new Date(date.$date || date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  },

  previewImage(e) {
    const { urls, current } = e.currentTarget.dataset;
    console.log('点击图片预览，urls:', urls, 'current:', current);

    if (!urls || !Array.isArray(urls) || urls.length === 0 || !current) {
      console.error('图片预览参数无效:', { urls, current });
      wx.showToast({ title: '图片预览失败', icon: 'none' });
      return;
    }

    wx.previewImage({
      current: current,
      urls: urls,
      success: res => {
        console.log('图片预览成功:', res);
      },
      fail: err => {
        console.error('图片预览失败:', err);
        wx.showToast({ title: '图片预览失败', icon: 'none' });
      }
    });
  },

  onImageError(e) {
    console.error('图片加载失败:', e.detail);
  },

  goBack() {
    wx.navigateBack();
  }
});