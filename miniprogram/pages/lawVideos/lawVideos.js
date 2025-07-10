const db = wx.cloud.database();

Page({
  data: {
    videoList: [],
    videoPath: '',
    videoName: '',
    title: '',
    duration: '',
    canSubmit: false,
    quizList: [],          // 题库列表
    selectedQuizId: '',    // 选中的题库ID
    selectedQuiz: ''       // 选中的题库名称
  },

  onLoad() {
    this.loadVideos();
    this.loadQuizzes();
  },

  // 加载已有视频
  async loadVideos() {
    try {
      const res = await db.collection('law_videos').get();
      this.setData({ videoList: res.data });
    } catch (err) {
      console.error('加载视频失败:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  // 加载题库列表
  async loadQuizzes() {
    try {
      const res = await db.collection('law_quizzes').get();
      this.setData({ quizList: res.data });
    } catch (err) {
      console.error('加载题库失败:', err);
      wx.showToast({ title: '加载题库失败', icon: 'none' });
    }
  },

  inputTitle(e) {
    this.setData({ title: e.detail.value }, this.checkSubmit);
  },

  inputDuration(e) {
    this.setData({ duration: e.detail.value }, this.checkSubmit);
  },

  // 选择题库
  selectQuiz(e) {
    const index = e.detail.value;
    const quiz = this.data.quizList[index];
    this.setData({
      selectedQuizId: quiz._id,
      selectedQuiz: quiz.name
    }, this.checkSubmit);
  },

  checkSubmit() {
    const { title, duration, videoPath, selectedQuizId } = this.data;
    this.setData({ canSubmit: title && duration && videoPath && selectedQuizId });
  },

  chooseVideo() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['video'],
      sourceType: ['album', 'camera'],
      maxDuration: 600,
      success: (res) => {
        const file = res.tempFiles[0];
        this.setData({
          videoPath: file.tempFilePath,
          videoName: file.tempFilePath.split('/').pop()
        }, this.checkSubmit);
      },
      fail: (err) => {
        console.error('选择视频失败:', err);
        wx.showToast({ title: '选择失败', icon: 'none' });
      }
    });
  },

  async uploadVideo() {
    wx.showLoading({ title: '上传中...' });
    try {
      const cloudPath = `videos/${Date.now()}_${this.data.videoName}`;
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath: this.data.videoPath
      });

      const videoData = {
        title: this.data.title,
        duration: this.data.duration,
        url: uploadRes.fileID,
        watchedBy: [],
        quizId: this.data.selectedQuizId  // 关联题库
      };
      const addRes = await db.collection('law_videos').add({ data: videoData });

      this.setData({
        videoList: [...this.data.videoList, { _id: addRes._id, ...videoData }],
        videoPath: '',
        videoName: '',
        title: '',
        duration: '',
        selectedQuizId: '',
        selectedQuiz: '',
        canSubmit: false
      });
      wx.hideLoading();
      wx.showToast({ title: '上传成功', icon: 'success' });
    } catch (err) {
      wx.hideLoading();
      console.error('上传视频失败:', err);
      wx.showToast({ title: '上传失败', icon: 'none' });
    }
  },

  async deleteVideo(e) {
    const videoId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除此视频吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const video = this.data.videoList.find(v => v._id === videoId);
            await wx.cloud.deleteFile({ fileList: [video.url] });
            await db.collection('law_videos').doc(videoId).remove();
            this.setData({
              videoList: this.data.videoList.filter(v => v._id !== videoId)
            });
            wx.showToast({ title: '删除成功', icon: 'success' });
          } catch (err) {
            console.error('删除视频失败:', err);
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  }
});