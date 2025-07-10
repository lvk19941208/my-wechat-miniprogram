const app = getApp(); // 获取全局 app 实例

Page({
  data: {
    checkins: [],
    dailyRecords: [],
    reflections: [],
    yearList: [], // 年份列表
    monthList: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'], // 月份列表
    yearIndex: -1,
    monthIndex: -1,
    selectedYear: '',
    selectedMonth: '',
    pageSize: 10, // 每页显示的记录数
    checkinPage: 0, // 签到记录分页
    dailyPage: 0, // 日常记录分页
    reflectionPage: 0, // 活动心得分页
    hasMoreCheckins: true,
    hasMoreDailyRecords: true,
    hasMoreReflections: true
  },

  onLoad() {
    // 初始化年份列表（例如从 2020 年到当前年份）
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = String(currentDate.getMonth() + 1).padStart(2, '0'); // 当前月份，补齐两位
    const yearList = [];
    for (let year = 2020; year <= currentYear; year++) {
      yearList.push(year.toString());
    }

    // 自动定位到当前年份和月份
    const yearIndex = yearList.indexOf(currentYear.toString());
    const monthIndex = this.data.monthList.indexOf(currentMonth);

    this.setData({
      yearList: yearList,
      yearIndex: yearIndex,
      selectedYear: currentYear.toString(),
      monthIndex: monthIndex,
      selectedMonth: currentMonth
    });

    // 加载当前年月的记录
    this.loadRecords();
  },

  onYearChange(e) {
    const index = e.detail.value;
    this.setData({
      yearIndex: index,
      selectedYear: this.data.yearList[index],
      monthIndex: -1, // 重置月份选择
      selectedMonth: '',
      checkins: [], // 清空记录
      dailyRecords: [],
      reflections: [],
      checkinPage: 0,
      dailyPage: 0,
      reflectionPage: 0,
      hasMoreCheckins: true,
      hasMoreDailyRecords: true,
      hasMoreReflections: true
    });
  },

  onMonthChange(e) {
    const index = e.detail.value;
    this.setData({
      monthIndex: index,
      selectedMonth: this.data.monthList[index],
      checkins: [], // 清空记录
      dailyRecords: [],
      reflections: [],
      checkinPage: 0,
      dailyPage: 0,
      reflectionPage: 0,
      hasMoreCheckins: true,
      hasMoreDailyRecords: true,
      hasMoreReflections: true
    });
    this.loadRecords(); // 选择月份后加载记录
  },

  async loadRecords() {
    const { selectedYear, selectedMonth, pageSize, checkinPage, dailyPage, reflectionPage } = this.data;
    if (!selectedYear || !selectedMonth) {
      return; // 未选择年份或月份时不加载
    }

    const db = wx.cloud.database();
    const _ = db.command;
    const openid = wx.getStorageSync('openid');

    if (!openid) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      wx.navigateBack(); // 不需要防抖
      return;
    }

    // 计算时间范围，参考 userDetails 的方式
    const startDate = new Date(`${selectedYear}-${selectedMonth}-01T00:00:00.000Z`);
    const endDate = new Date(selectedYear, parseInt(selectedMonth) - 1, 1);
    endDate.setMonth(endDate.getMonth() + 1);
    endDate.setDate(endDate.getDate() - 1);
    endDate.setHours(23, 59, 59, 999);

    try {
      // 加载签到记录 (集合: checkins)
      let checkinRes;
      try {
        checkinRes = await db.collection('checkins')
          .where({
            _openid: openid,
            timestamp: _.gte(startDate).and(_.lte(endDate))
          })
          .orderBy('timestamp', 'desc')
          .skip(checkinPage * pageSize)
          .limit(pageSize)
          .get();
      } catch (e) {
        console.warn('加载签到记录失败:', e);
        checkinRes = { data: [] };
      }
      const checkins = checkinRes.data.map(item => {
        let timeFormatted = '未知时间';
        if (item.timestamp) {
          const date = new Date(item.timestamp);
          if (!isNaN(date)) {
            timeFormatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          }
        }
        item.timeFormatted = timeFormatted;

        item.locationFormatted = (item.latitude && item.longitude)
          ? `经纬度: ${item.latitude}, ${item.longitude}`
          : '未知地点';

        return item;
      });

      // 加载日常记录 (集合: daily_logs)
      let dailyRes;
      try {
        dailyRes = await db.collection('daily_logs')
          .where({
            _openid: openid,
            timestamp: _.gte(startDate).and(_.lte(endDate))
          })
          .orderBy('timestamp', 'desc')
          .skip(dailyPage * pageSize)
          .limit(pageSize)
          .get();
      } catch (e) {
        console.warn('加载日常记录失败:', e);
        dailyRes = { data: [] };
      }
      const dailyRecords = dailyRes.data.map(item => {
        let timeFormatted = '未知时间';
        if (item.timestamp) {
          const date = new Date(item.timestamp);
          if (!isNaN(date)) {
            timeFormatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          }
        }
        item.timeFormatted = timeFormatted;

        return item;
      });

      // 加载活动心得体会 (集合: activity_reflections)
      let reflectionRes;
      try {
        reflectionRes = await db.collection('activity_reflections')
          .where({
            _openid: openid,
            timestamp: _.gte(startDate).and(_.lte(endDate))
          })
          .orderBy('timestamp', 'desc')
          .skip(reflectionPage * pageSize)
          .limit(pageSize)
          .get();
      } catch (e) {
        console.warn('加载活动心得失败:', e);
        reflectionRes = { data: [] };
      }
      const reflections = reflectionRes.data.map(item => {
        let timeFormatted = '未知时间';
        if (item.timestamp) {
          const date = new Date(item.timestamp);
          if (!isNaN(date)) {
            timeFormatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          }
        }
        item.timeFormatted = timeFormatted;
        item.feedback = item.feedback || '暂无评价';

        return item;
      });

      this.setData({
        checkins: this.data.checkins.concat(checkins),
        dailyRecords: this.data.dailyRecords.concat(dailyRecords),
        reflections: this.data.reflections.concat(reflections),
        hasMoreCheckins: checkins.length === pageSize,
        hasMoreDailyRecords: dailyRecords.length === pageSize,
        hasMoreReflections: reflections.length === pageSize
      });

      if (checkins.length === 0 && dailyRecords.length === 0 && reflections.length === 0) {
        wx.showToast({ title: '该月暂无记录', icon: 'none' });
      }
    } catch (err) {
      console.error('加载记录失败:', err);
      wx.showToast({ title: '加载失败，请检查数据库', icon: 'none' });
    }
  },

  loadMoreCheckins() {
    this.setData({
      checkinPage: this.data.checkinPage + 1
    });
    this.loadRecords();
  },

  loadMoreDailyRecords() {
    this.setData({
      dailyPage: this.data.dailyPage + 1
    });
    this.loadRecords();
  },

  loadMoreReflections() {
    this.setData({
      reflectionPage: this.data.reflectionPage + 1
    });
    this.loadRecords();
  },

  goBack() {
    wx.navigateBack(); // 不需要防抖
  }
});