const app = getApp();

Page({
  data: {
    userName: '',
    openid: '',
    reflections: [],
    showFeedbackModal: false,
    currentReflectionId: '',
    feedbackInput: ''
  },

  onLoad(options) {
    if (options.openid) {
      this.setData({
        openid: options.openid
      });
      this.loadReflections(options.openid);
      this.loadUserName(options.openid);
    } else {
      wx.showToast({ title: '未获取用户信息', icon: 'none' });
      wx.navigateBack();
    }
  },

  async loadUserName(openid) {
    const db = wx.cloud.database();
    try {
      const res = await db.collection('users')
        .where({ _openid: openid })
        .get();
      if (res.data.length > 0) {
        this.setData({
          userName: res.data[0].name || '未知用户'
        });
      }
    } catch (err) {
      console.error('加载用户名失败:', err);
    }
  },

  async loadReflections(openid) {
    const db = wx.cloud.database();
    try {
      const res = await db.collection('activity_reflections')
        .where({ _openid: openid })
        .orderBy('timestamp', 'desc')
        .get();

      const reflections = await Promise.all(res.data.map(async item => {
        // 格式化时间
        let timeFormatted = '未知时间';
        if (item.timestamp) {
          const date = new Date(item.timestamp);
          if (!isNaN(date)) {
            timeFormatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          } else {
            console.log('无效时间:', item.timestamp);
          }
        }
        item.timeFormatted = timeFormatted;

        // 获取图片的临时 URL
        if (item.imagePaths && item.imagePaths.length > 0) {
          const fileList = item.imagePaths;
          console.log('获取临时URL，fileList:', fileList);
          const urlRes = await wx.cloud.getTempFileURL({ fileList });
          console.log('临时URL结果:', urlRes);
          item.imageUrls = urlRes.fileList.map(file => {
            if (file.status !== 0) {
              console.error('获取临时URL失败:', file);
              return '';
            }
            return file.tempFileURL;
          }).filter(url => url);
        } else {
          item.imageUrls = [];
        }

        return item;
      }));

      console.log('加载的心得数据:', reflections);
      this.setData({ reflections });
    } catch (err) {
      console.error('加载心得体会失败:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  // 点击图片预览
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

  goToReflectionDetail(e) {
    const id = e.currentTarget.dataset.id;
    const reflection = this.data.reflections.find(item => item._id === id);
    this.setData({
      showFeedbackModal: true,
      currentReflectionId: id,
      feedbackInput: reflection.feedback || ''
    });
  },

  onFeedbackInput(e) {
    this.setData({
      feedbackInput: e.detail.value
    });
  },

  async saveFeedback() {
    const { currentReflectionId, feedbackInput, openid } = this.data;
    if (!feedbackInput.trim()) {
      wx.showToast({ title: '评价不能为空', icon: 'none' });
      return;
    }

    const db = wx.cloud.database();
    try {
      await db.collection('activity_reflections')
        .doc(currentReflectionId)
        .update({
          data: { feedback: feedbackInput }
        });
      wx.showToast({ title: '评价已保存', icon: 'success' });
      this.setData({ showFeedbackModal: false, feedbackInput: '' });
      this.loadReflections(openid);
    } catch (err) {
      console.error('保存评价失败:', err);
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  cancelFeedback() {
    this.setData({
      showFeedbackModal: false,
      feedbackInput: ''
    });
  },

  goBack() {
    wx.navigateBack();
  }
});