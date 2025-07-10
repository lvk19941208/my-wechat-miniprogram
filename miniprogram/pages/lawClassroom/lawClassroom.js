const db = wx.cloud.database();
const _ = db.command;

Page({
  data: {
    videoList: [],
    currentVideoUrl: '',
    currentVideoId: '',
    watchTime: 0,
    actualWatchTime: 0,
    showQuizButton: false,
    quizEnabled: false,
    userOpenid: '',
    videoContext: null,
    lastSavedTime: 0,
    lastTime: 0,
    totalDuration: 0,
    isPlaying: false,
    isFullscreen: false,
    allowSeek: false,
    watchThreshold: 0.9,
  },

  onLoad(options) {
    const openid = options.openid || wx.getStorageSync('openid');
    if (!openid) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    this.setData({ userOpenid: openid });
    console.log('lawClassroom 接收到的 _openid:', openid);
    this.loadVideoList();
  },

  async loadVideoList() {
    try {
      const videoRes = await db.collection('law_videos')
        .limit(20)
        .get();
      const videos = videoRes.data;

      const userRecordsRes = await db.collection('user_learning_records')
        .where({
          userOpenid: this.data.userOpenid,
          videoId: _.in(videos.map(v => v._id))
        })
        .get();
      const userRecords = userRecordsRes.data.reduce((acc, record) => {
        acc[record.videoId] = record;
        return acc;
      }, {});

      const videoList = videos.map(video => ({
        id: video._id,
        title: video.title,
        duration: video.duration,
        url: video.url,
        watched: userRecords[video._id]?.watched || false,
        progress: userRecords[video._id]?.progress || 0
      }));
      this.setData({ videoList });
      console.log('加载视频列表:', videoList);
    } catch (err) {
      console.error('加载视频列表失败:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  selectVideo(e) {
    const videoId = e.currentTarget.dataset.id;
    const video = this.data.videoList.find(v => v.id === videoId);
    const allowSeek = video.watched; // 已观看的视频允许快进
    this.setData({
      currentVideoUrl: video.url,
      currentVideoId: videoId,
      watchTime: video.progress || 0,
      actualWatchTime: video.progress || 0,
      showQuizButton: video.watched,
      quizEnabled: video.watched,
      lastSavedTime: 0,
      lastTime: video.progress || 0,
      totalDuration: this.parseDurationToSeconds(video.duration),
      isPlaying: false,
      isFullscreen: false,
      allowSeek: allowSeek,
    });
    const videoContext = wx.createVideoContext('lawVideo', this);
    videoContext.seek(video.progress || 0);
    this.setData({ videoContext });
  },

  togglePlay() {
    if (this.data.isPlaying) {
      this.data.videoContext.pause();
    } else {
      this.data.videoContext.play();
    }
  },

  toggleFullScreen() {
    if (this.data.isFullscreen) {
      this.data.videoContext.exitFullScreen();
    } else {
      this.data.videoContext.requestFullScreen();
    }
  },

  onVideoPlay() {
    this.setData({ isPlaying: true });
  },

  onVideoPause() {
    this.setData({ isPlaying: false });
  },

  onFullscreenChange(e) {
    this.setData({ isFullscreen: e.detail.fullScreen });
  },

  onTimeUpdate(e) {
    const currentTime = Math.floor(e.detail.currentTime);
    const diff = currentTime - this.data.lastTime;

    // 如果不允许快进，检测异常跳跃
    if (!this.data.allowSeek && diff > 2) {
      console.warn('检测到快进，强制回退到:', this.data.lastTime);
      this.data.videoContext.seek(this.data.lastTime);
      return;
    }

    // 允许快进或正常播放时更新时间
    if (diff >= 0 && diff <= 2) {
      const newActualWatchTime = this.data.actualWatchTime + diff;
      this.setData({
        watchTime: currentTime,
        actualWatchTime: newActualWatchTime,
        lastTime: currentTime,
      });

      // 检查是否达到观看阈值
      if (!this.data.allowSeek && newActualWatchTime >= this.data.totalDuration * this.data.watchThreshold) {
        this.setData({
          showQuizButton: true,
          quizEnabled: true,
          allowSeek: true,
        });
        wx.showToast({ title: '视频观看完成！可自由回看', icon: 'success' });
      }

      // 每10秒保存一次进度
      if (currentTime % 10 === 0 && currentTime > 0 && currentTime !== this.data.lastSavedTime) {
        this.saveProgress(newActualWatchTime);
        this.setData({ lastSavedTime: currentTime });
      }
    } else if (this.data.allowSeek) {
      // 允许快进时直接更新当前时间
      this.setData({
        watchTime: currentTime,
        lastTime: currentTime,
      });
    }
  },

  onVideoEnd() {
    if (this.data.actualWatchTime >= this.data.totalDuration * this.data.watchThreshold) {
      this.markVideoAsWatched();
      this.setData({
        showQuizButton: true,
        quizEnabled: true,
        allowSeek: true,
        isPlaying: false,
      });
      wx.showToast({ title: '视频观看完成！可自由回看', icon: 'success' });
    } else {
      wx.showToast({ title: '请完整观看视频', icon: 'none' });
      this.data.videoContext.seek(this.data.lastTime);
    }
  },

  async saveProgress(time) {
    const videoId = this.data.currentVideoId;
    const userOpenid = this.data.userOpenid;
    if (!videoId) return;
    try {
      const videoRes = await db.collection('law_videos').doc(videoId).get();
      const videoTitle = videoRes.data.title;

      const recordRes = await db.collection('user_learning_records')
        .where({
          userOpenid: userOpenid,
          videoId: videoId,
        })
        .get();

      if (recordRes.data.length > 0) {
        await db.collection('user_learning_records')
          .where({
            userOpenid: userOpenid,
            videoId: videoId,
          })
          .update({
            data: {
              progress: time,
              updatedAt: new Date().toISOString(),
              videoTitle: videoTitle,
              watched: time >= this.data.totalDuration * this.data.watchThreshold,
            },
          });
      } else {
        await db.collection('user_learning_records').add({
          data: {
            userOpenid: userOpenid,
            videoId: videoId,
            videoTitle: videoTitle,
            watched: false,
            progress: time,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        });
      }

      const videoList = this.data.videoList.map(v => {
        if (v.id === videoId) {
          v.progress = time;
          v.watched = time >= this.data.totalDuration * this.data.watchThreshold;
        }
        return v;
      });
      this.setData({ videoList });
      console.log('保存进度成功:', { userOpenid, videoId, progress: time });
    } catch (err) {
      console.error('保存进度失败:', err);
    }
  },

  async markVideoAsWatched() {
    const videoId = this.data.currentVideoId;
    const userOpenid = this.data.userOpenid;
    try {
      const videoRes = await db.collection('law_videos').doc(videoId).get();
      const videoTitle = videoRes.data.title;

      const recordRes = await db.collection('user_learning_records')
        .where({
          userOpenid: userOpenid,
          videoId: videoId
        })
        .get();
      
      if (recordRes.data.length > 0) {
        await db.collection('user_learning_records')
          .where({
            userOpenid: userOpenid,
            videoId: videoId
          })
          .update({
            data: {
              watched: true,
              updatedAt: new Date().toISOString(),
              videoTitle: videoTitle
            }
          });
      } else {
        await db.collection('user_learning_records').add({
          data: {
            userOpenid: userOpenid,
            videoId: videoId,
            videoTitle: videoTitle,
            watched: true,
            progress: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        });
      }

      const videoList = this.data.videoList.map(v => {
        if (v.id === videoId) v.watched = true;
        return v;
      });
      this.setData({ videoList });
      console.log('记录用户观看视频:', { videoId, userOpenid });
    } catch (err) {
      console.error('标记视频失败:', err);
    }
  },

  parseDurationToSeconds(duration) {
    if (!duration || typeof duration !== 'string') return 0;
    const [minutes, seconds] = duration.split(':').map(Number);
    if (isNaN(minutes) || isNaN(seconds)) return 0;
    return minutes * 60 + seconds;
  },

  goToQuiz() {
    if (this.data.quizEnabled) {
      const openid = this.data.userOpenid;
      wx.navigateTo({ 
        url: `/pages/lawQuiz/lawQuiz?videoId=${this.data.currentVideoId}&openid=${openid}`
      });
    }
  },

  goBack() {
    wx.navigateBack();
  },

  onUnload() {
    if (this.data.currentVideoId) {
      this.saveProgress(this.data.actualWatchTime);
    }
  }
});