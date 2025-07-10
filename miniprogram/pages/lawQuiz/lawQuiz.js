const db = wx.cloud.database();

Page({
  data: {
    videoId: '',
    questions: [],
    score: 0,
    showResult: false,
    canSubmit: false,
    userOpenid: ''
  },

  onLoad(options) {
    const videoId = options.videoId;
    const openid = options.openid || wx.getStorageSync('openid');
    if (!openid) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    this.setData({ videoId, userOpenid: openid });
    console.log('lawQuiz 接收到的 _openid:', openid);
    this.loadQuiz(videoId);
  },

  async loadQuiz(videoId) {
    try {
      const videoRes = await db.collection('law_videos').doc(videoId).get();
      const quizId = videoRes.data.quizId;
      const quizRes = await db.collection('law_quizzes').doc(quizId).get();
      const questions = quizRes.data.questions.map(q => ({
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        score: q.score,
        selected: null
      }));
      this.setData({ questions });
      console.log('加载题目:', JSON.stringify(questions));
    } catch (err) {
      console.error('加载题库失败:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  selectCustomAnswer(e) {
    const qIndex = parseInt(e.currentTarget.dataset.qindex);
    const oIndex = parseInt(e.currentTarget.dataset.oindex);
    console.log('点击事件:', { qIndex, oIndex });

    if (isNaN(qIndex) || isNaN(oIndex)) {
      console.error('无效的索引:', { qIndex, oIndex });
      return;
    }

    const questions = this.data.questions;
    if (!questions[qIndex]) {
      console.error('问题索引超出范围:', qIndex);
      return;
    }

    questions[qIndex].selected = oIndex;
    const canSubmit = questions.every(q => q.selected !== null);

    this.setData({ questions, canSubmit });
    console.log('更新后 questions:', JSON.stringify(questions));
  },

  submitQuiz() {
    const questions = this.data.questions;
    let score = 0;
    questions.forEach(q => {
      if (q.selected === q.correctAnswer) {
        score += q.score;
      }
    });
    this.setData({
      score,
      showResult: true
    });
    console.log('提交得分:', score);
    this.saveQuizResult(score);
  },

  async saveQuizResult(score) {
    try {
      const userOpenid = this.data.userOpenid;
      const videoId = this.data.videoId;

      // 获取视频标题
      const videoRes = await db.collection('law_videos').doc(videoId).get();
      const videoTitle = videoRes.data.title;

      // 检查是否已有记录
      const recordRes = await db.collection('user_learning_records')
        .where({
          userOpenid: userOpenid,
          videoId: videoId
        })
        .get();

      if (recordRes.data.length > 0) {
        // 更新现有记录
        await db.collection('user_learning_records')
          .where({
            userOpenid: userOpenid,
            videoId: videoId
          })
          .update({
            data: {
              quizScore: score,
              quizTimestamp: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              videoTitle: videoTitle // 确保 videoTitle 也更新
            }
          });
      } else {
        // 创建新记录
        await db.collection('user_learning_records').add({
          data: {
            userOpenid: userOpenid,
            videoId: videoId,
            videoTitle: videoTitle, // 保存视频标题
            watched: false,
            progress: 0,
            quizScore: score,
            quizTimestamp: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        });
      }

      console.log('保存用户分数成功:', { userOpenid, videoId, videoTitle, score });
      wx.showToast({ title: '分数已保存', icon: 'success' });
    } catch (err) {
      console.error('保存用户分数失败:', err);
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  }
});