const app = getApp();

Page({
  data: {
    userName: '',
    userPhone: '',
    userGuardianPhone: '',
    yearList: [],
    monthList: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'],
    yearIndex: -1,
    monthIndex: -1,
    selectedYear: '',
    selectedMonth: '',
    checkins: [],
    dailyLogs: [],
    selectedOpenid: '',
    totalDays: 0,
    checkinDays: 0,
    imageUrls: [],
    learningRecords: [],
    showLearningRecords: false
  },

  onLoad(options) {
    const openid = options.openid;
    if (openid) {
      this.setData({ selectedOpenid: openid });
      this.loadUserInfo(openid);

      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
      const yearList = [];
      for (let year = 2020; year <= currentYear; year++) {
        yearList.push(year.toString());
      }

      const yearIndex = yearList.indexOf(currentYear.toString());
      const monthIndex = this.data.monthList.indexOf(currentMonth);

      this.setData({
        yearList,
        yearIndex,
        selectedYear: currentYear.toString(),
        monthIndex,
        selectedMonth: currentMonth
      });

      const totalDays = this.getDaysInMonth(currentYear, currentMonth);
      this.setData({ totalDays });

      this.loadData(openid, `${currentYear}-${currentMonth}`);
    } else {
      wx.showToast({
        title: '用户ID缺失',
        icon: 'none'
      });
      wx.navigateBack();
    }
  },

  loadUserInfo(openid) {
    const db = wx.cloud.database();
    db.collection('users').where({
      _openid: openid
    }).get({
      success: res => {
        if (res.data.length > 0) {
          this.setData({
            userName: res.data[0].name || '未知用户',
            userPhone: res.data[0].phone || '',
            userGuardianPhone: res.data[0].guardianPhone || ''
          });
          wx.setNavigationBarTitle({
            title: res.data[0].name || '未知用户'
          });
        } else {
          this.setData({
            userName: '未知用户',
            userPhone: '',
            userGuardianPhone: ''
          });
          wx.setNavigationBarTitle({
            title: '未知用户'
          });
        }
      },
      fail: err => {
        console.error('获取用户信息失败:', err);
        this.setData({
          userName: '未知用户',
          userPhone: '',
          userGuardianPhone: ''
        });
        wx.setNavigationBarTitle({
          title: '未知用户'
        });
      }
    });
  },

  onYearChange(e) {
    const index = e.detail.value;
    this.setData({
      yearIndex: index,
      selectedYear: this.data.yearList[index],
      monthIndex: -1,
      selectedMonth: '',
      checkins: [],
      dailyLogs: [],
      totalDays: 0,
      checkinDays: 0,
      imageUrls: []
    });
  },

  onMonthChange(e) {
    const index = e.detail.value;
    const selectedMonth = this.data.monthList[index];
    this.setData({
      monthIndex: index,
      selectedMonth
    });
    const totalDays = this.getDaysInMonth(this.data.selectedYear, selectedMonth);
    this.setData({ totalDays });
    if (this.data.selectedOpenid) {
      this.loadData(this.data.selectedOpenid, `${this.data.selectedYear}-${selectedMonth}`);
    }
  },

  loadData(openid, month) {
    this.loadCheckins(openid, month);
    this.loadDailyLogs(openid, month);
  },

  async loadCheckins(openid, month) {
    const db = wx.cloud.database();
    const _ = db.command;
    const [year, monthNum] = month.split('-');
    const startDate = new Date(`${year}-${monthNum}-01T00:00:00.000Z`);
    const endDate = new Date(year, parseInt(monthNum), 0);
    endDate.setHours(23, 59, 59, 999);

    console.log('查询时间范围:', startDate, endDate);

    const MAX_LIMIT = 20;
    let checkins = [];
    let skip = 0;

    try {
      while (true) {
        const res = await db.collection('checkins')
          .where({
            _openid: openid,
            timestamp: _.gte(startDate).and(_.lte(endDate))
          })
          .skip(skip)
          .limit(MAX_LIMIT)
          .get();

        console.log('查询返回的原始数据:', res.data);

        const batchData = res.data.map(item => {
          item.timestamp = this.formatDate(item.timestamp);
          item.originalPhotoUrl = item.photo_url || '';
          item.photo_url = '';
          if (!item.fullAddress && item.city && item.street) {
            item.fullAddress = `${item.city} ${item.street}`;
          }
          item.fullAddress = item.fullAddress || '未知地点';
          return item;
        });

        checkins = checkins.concat(batchData);
        skip += MAX_LIMIT;

        if (batchData.length < MAX_LIMIT) {
          break;
        }
      }

      const checkinDates = new Set();
      checkins.forEach(item => {
        const date = item.timestamp.split(' ')[0];
        checkinDates.add(date);
      });
      const checkinDays = checkinDates.size;

      const fileList = checkins
        .filter(item => item.originalPhotoUrl && typeof item.originalPhotoUrl === 'string')
        .map(item => item.originalPhotoUrl);

      let imageUrls = [];
      if (fileList.length > 0) {
        try {
          const tempRes = await wx.cloud.getTempFileURL({ fileList });
          if (tempRes.errMsg !== 'cloud.getTempFileURL:ok') {
            checkins.forEach(item => {
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
                const checkinItem = checkins.find(item => item.originalPhotoUrl === originalFileID);
                if (checkinItem) {
                  checkinItem.photo_url = tempFileURL;
                }
              } else {
                const checkinItem = checkins.find(item => item.originalPhotoUrl === originalFileID);
                if (checkinItem) {
                  checkinItem.photo_url = '';
                }
              }
            });
            imageUrls = checkins.map(item => item.photo_url).filter(url => url);
          }
        } catch (err) {
          console.error('获取临时图片URL失败:', err);
          checkins.forEach(item => {
            if (item.originalPhotoUrl) {
              item.photo_url = '';
            }
          });
        }
      }

      this.setData({ 
        checkins, 
        checkinDays, 
        imageUrls
      });
    } catch (err) {
      console.error('签到查询失败:', err);
      this.setData({ 
        checkins: [], 
        checkinDays: 0, 
        imageUrls: []
      });
      wx.showToast({
        title: '加载签到记录失败，请稍后重试',
        icon: 'none'
      });
    }
  },

  loadDailyLogs(openid, month) {
    const db = wx.cloud.database();
    const _ = db.command;
    const [year, monthNum] = month.split('-');
    const startDate = new Date(`${year}-${monthNum}-01T00:00:00.000Z`);
    const endDate = new Date(year, parseInt(monthNum), 0);
    endDate.setHours(23, 59, 59, 999);

    db.collection('daily_logs').where({
      _openid: openid,
      timestamp: _.gte(startDate).and(_.lte(endDate))
    }).get({
      success: res => {
        const dailyLogs = res.data.map(item => {
          item.timestamp = this.formatDate(item.timestamp);
          return item;
        });
        this.setData({ dailyLogs });
      },
      fail: err => {
        console.error('分享查询失败:', err);
      }
    });
  },

  async loadLearningRecords(openid) {
    const db = wx.cloud.database();
    try {
      const res = await db.collection('user_learning_records')
        .where({
          userOpenid: openid
        })
        .orderBy('createdAt', 'desc')
        .get();
  
      const learningRecords = res.data.map(item => {
        console.log('学习记录原始数据:', item);
        item.createdAt = this.formatDate(item.createdAt);
        if (item.clickTimestamp) {
          item.clickTimestamp = this.formatDate(item.clickTimestamp);
        }
        if (item.quizTimestamp) {
          item.quizTimestamp = this.formatDate(item.quizTimestamp);
        }
        item.watched = item.watched !== undefined ? item.watched : false;
        return item;
      });
  
      this.setData({
        learningRecords,
        showLearningRecords: true
      });
      console.log('加载法律学习记录:', learningRecords);
    } catch (err) {
      console.error('加载法律学习记录失败:', err);
      this.setData({
        learningRecords: [],
        showLearningRecords: true
      });
      wx.showToast({
        title: '加载学习记录失败',
        icon: 'none'
      });
    }
  },
  
  showLearningRecords() {
    const openid = this.data.selectedOpenid;
    if (openid) {
      this.loadLearningRecords(openid);
    } else {
      wx.showToast({
        title: '用户ID缺失',
        icon: 'none'
      });
    }
  },

  getDaysInMonth(year, month) {
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    const date = new Date(yearNum, monthNum, 0);
    return date.getDate();
  },

  formatDate(date) {
    const d = new Date(date.$date || date);
    if (isNaN(d.getTime())) {
      console.error('无效的日期:', date);
      return '无效日期';
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  },

  onImageError(e) {
    console.error('图片加载失败:', e.detail);
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

  goToReflectionList() {
    const { selectedOpenid, userName } = this.data;
    app.debounceNavigate(`/pages/reflectionList/reflectionList?openid=${selectedOpenid}&userName=${userName}`);
  },

  goBack() {
    wx.navigateBack();
  }
});