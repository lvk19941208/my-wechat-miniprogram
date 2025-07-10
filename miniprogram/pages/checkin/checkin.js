const app = getApp();
const QQMapWX = require('../../utils/qqmap-wx-jssdk.min.js');

Page({
  data: {
    userName: '',
    selectedOpenid: '',
    latitude: null,
    longitude: null,
    hasLocation: false,
    fullAddress: '',
    photoPath: '',
    isCheckingIn: false,
    showDailyLogInput: false,
    dailyLogContent: '',
    hasDailyLog: false, // 是否已记录今日生活
    isDailyLogValid: false // 生活报告是否有效
  },

  async onLoad() {
    const openid = wx.getStorageSync('openid');
    const userName = wx.getStorageSync('userName') || '未知用户';
    this.setData({
      userName: userName,
      selectedOpenid: openid
    });

    if (!openid) {
      wx.showToast({
        title: '用户未登录',
        icon: 'none'
      });
      wx.navigateBack();
      return;
    }

    this.qqmapsdk = new QQMapWX({
      key: 'TXQBZ-72QCQ-KIE54-4VCAH-S6PSJ-V7FRJ'
    });
    console.log('腾讯地图 SDK 初始化成功:', this.qqmapsdk);

    // 检查今日是否已签到和今日生活记录
    await Promise.all([this.checkTodayCheckin(), this.checkTodayDailyLog()]);
    this.getLocation();
  },

  // 检查今日是否已签到
  async checkTodayCheckin() {
    const db = wx.cloud.database();
    const { selectedOpenid } = this.data;
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    try {
      const res = await db.collection('checkins')
        .where({
          _openid: selectedOpenid,
          timestamp: db.command.gte(startOfDay).and(db.command.lte(endOfDay))
        })
        .count();

      if (res.total > 0) {
        wx.showModal({
          title: '提示',
          content: '您今日已签到',
          showCancel: false,
          confirmText: '我知道了',
          confirmColor: '#32CD32'
        });
      }
    } catch (err) {
      console.error('检查今日签到失败:', err);
    }
  },

  // 检查今日是否已记录生活
  async checkTodayDailyLog() {
    const db = wx.cloud.database();
    const { selectedOpenid } = this.data;
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    try {
      const res = await db.collection('daily_logs')
        .where({
          _openid: selectedOpenid,
          timestamp: db.command.gte(startOfDay).and(db.command.lte(endOfDay))
        })
        .count();

      this.setData({
        hasDailyLog: res.total > 0
      });
      console.log('今日生活记录检查结果:', res.total > 0);
    } catch (err) {
      console.error('检查今日生活记录失败:', err);
      this.setData({
        hasDailyLog: false
      });
    }
  },

  getLocation() {
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      highAccuracyExpireTime: 5000,
      success: res => {
        const latitude = res.latitude;
        const longitude = res.longitude;
        this.setData({
          latitude: latitude,
          longitude: longitude,
          hasLocation: true
        });
        console.log('定位成功:', res);
        this.reverseGeocode(latitude, longitude);
      },
      fail: err => {
        console.error('获取定位失败:', err);
        this.setData({
          hasLocation: false,
          fullAddress: '定位失败'
        });
        wx.showModal({
          title: '定位失败',
          content: '请允许获取定位权限以完成签到',
          success: res => {
            if (res.confirm) {
              wx.openSetting({
                success: settingRes => {
                  if (settingRes.authSetting['scope.userLocation']) {
                    this.getLocation();
                  }
                }
              });
            }
          }
        });
      }
    });
  },

  reverseGeocode(latitude, longitude) {
    this.qqmapsdk.reverseGeocoder({
      location: { latitude, longitude },
      get_poi: 1,
      success: res => {
        console.log('逆地理编码 API 返回:', res);
        if (res.status === 0) {
          const addressComponent = res.result.address_component;
          const province = addressComponent.province || '';
          const city = addressComponent.city || '';
          const district = addressComponent.district || '';
          const town = addressComponent.town || '';
          const street = addressComponent.street || '';
          let fullAddress = `${province}${city}${district}${town}${street}`;
          if (!town && !street) {
            fullAddress = res.result.address || '未知地点';
          }
          this.setData({
            fullAddress: fullAddress
          });
          console.log('逆地理编码成功:', fullAddress);
        } else {
          console.error('逆地理编码失败:', res);
          this.setData({
            fullAddress: '未知地点'
          });
        }
      },
      fail: err => {
        console.error('逆地理编码请求失败:', err);
        this.setData({
          fullAddress: '未知地点'
        });
        wx.showToast({
          title: '获取地址失败: ' + (err.message || '网络错误'),
          icon: 'none'
        });
      }
    });
  },

  takePhoto() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['camera'],
      success: res => {
        this.setData({
          photoPath: res.tempFilePaths[0]
        });
      },
      fail: err => {
        console.error('拍照失败:', err);
        wx.showToast({
          title: '拍照失败',
          icon: 'none'
        });
      }
    });
  },

  async submitCheckin() {
    const { latitude, longitude, fullAddress, selectedOpenid, photoPath, isCheckingIn, hasDailyLog } = this.data;
    if (isCheckingIn) return;

    if (!latitude || !longitude) {
      wx.showToast({
        title: '请先获取定位',
        icon: 'none'
      });
      return;
    }

    if (!photoPath) {
      wx.showToast({
        title: '请先拍照',
        icon: 'none'
      });
      return;
    }

    if (!hasDailyLog) {
      wx.showToast({
        title: '请先记录今日生活',
        icon: 'none'
      });
      return;
    }

    this.setData({ isCheckingIn: true });

    const db = wx.cloud.database();
    try {
      const fileExtension = photoPath.split('.').pop();
      const cloudPath = `checkin-photos/${selectedOpenid}/${Date.now()}.${fileExtension}`;
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: photoPath
      });
      const photoUrl = uploadRes.fileID;

      await db.collection('checkins').add({
        data: {
          _openid: selectedOpenid,
          timestamp: new Date(),
          latitude: latitude,
          longitude: longitude,
          fullAddress: fullAddress,
          photo_url: photoUrl
        }
      });

      wx.showToast({
        title: '签到成功',
        icon: 'success'
      });
      this.setData({
        photoPath: '',
        isCheckingIn: false
      });
    } catch (err) {
      console.error('签到失败:', err);
      this.setData({ isCheckingIn: false });
      wx.showToast({
        title: '签到失败',
        icon: 'none'
      });
    }
  },

  showDailyLogInput() {
    this.setData({
      showDailyLogInput: true,
      dailyLogContent: '',
      isDailyLogValid: false
    });
  },

  onDailyLogInput(e) {
    const content = e.detail.value;
    const isValid = this.validateDailyLogContent(content);
    this.setData({
      dailyLogContent: content,
      isDailyLogValid: isValid
    });
    console.log('输入内容:', content, '验证结果:', isValid);
  },

  validateDailyLogContent(content) {
    const trimmedContent = content.trim();
    console.log('验证内容:', trimmedContent, '长度:', trimmedContent.length);
    if (trimmedContent.length < 15) {
      console.log('字数不足15');
      return false;
    }
    // 允许中文及常见标点符号
    const chineseRegex = /^[\u4e00-\u9fa5，。！？；：、]+$/;
    const isValid = chineseRegex.test(trimmedContent);
    console.log('正则验证结果:', isValid);
    if (!isValid) {
      console.log('内容包含非法字符，仅允许中文及，。！？；：、');
    }
    return isValid;
  },

  async submitDailyLog() {
    const { dailyLogContent, selectedOpenid } = this.data;
    if (!dailyLogContent.trim()) {
      wx.showToast({
        title: '请输入报告内容',
        icon: 'none'
      });
      console.log('提交失败: 内容为空');
      return;
    }

    if (!this.validateDailyLogContent(dailyLogContent)) {
      wx.showToast({
        title: '报告需至少15字，仅限中文及，。！？；：、',
        icon: 'none'
      });
      console.log('提交失败: 内容不符合要求');
      return;
    }

    const db = wx.cloud.database();
    try {
      await db.collection('daily_logs').add({
        data: {
          _openid: selectedOpenid,
          content: dailyLogContent,
          timestamp: new Date()
        }
      });

      wx.showToast({
        title: '提交成功',
        icon: 'success'
      });
      this.setData({
        showDailyLogInput: false,
        dailyLogContent: '',
        hasDailyLog: true,
        isDailyLogValid: false
      });
      console.log('生活报告提交成功');
    } catch (err) {
      console.error('提交日常生活报告失败:', err);
      wx.showToast({
        title: '提交失败，请重试',
        icon: 'none'
      });
    }
  },

  cancelDailyLogInput() {
    this.setData({
      showDailyLogInput: false,
      dailyLogContent: '',
      isDailyLogValid: false
    });
  },

  goBack() {
    wx.navigateBack();
  }
});