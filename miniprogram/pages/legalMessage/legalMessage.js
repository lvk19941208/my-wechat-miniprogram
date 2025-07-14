// legalMessage.js
Page({
  data: {
    openid: '',
    messages: [],  // 聊天记录数组
    inputMessage: ''
  },

  onLoad() {
    this.getOpenidAndLoadMessages();
  },

  // 调用云函数获取openid
  getOpenidAndLoadMessages() {
    wx.cloud.callFunction({
      name: 'getOpenid',
      success: res => {
        const openid = res.result.openid;
        this.setData({ openid });
        this.loadMessages(openid);
      },
      fail: err => {
        console.error('获取openid失败', err);
      }
    });
  },

  // 根据openid加载用户聊天记录
  async loadMessages(openid) {
    const db = wx.cloud.database();
    try {
      const res = await db.collection('legalMessages')
        .where({ _openid: openid })
        .orderBy('createdAt', 'asc')
        .get();

      this.setData({ messages: res.data });
    } catch (error) {
      console.error('加载聊天记录失败', error);
    }
  },

  // 输入框绑定的事件，实时更新输入内容
  onInputChange(e) {
    this.setData({ inputMessage: e.detail.value });
  },

  // 点击发送按钮，保存消息到数据库
  async sendMessage() {
    const { inputMessage, openid } = this.data;
    if (!inputMessage.trim()) {
      wx.showToast({ title: '请输入内容', icon: 'none' });
      return;
    }

    const db = wx.cloud.database();
    try {
      // 先获取用户昵称（从users集合取name字段），假设users里存了openid对应的name
      const userRes = await db.collection('users').where({ _openid: openid }).limit(1).get();
      const userName = (userRes.data[0] && userRes.data[0].name) || '匿名用户';

      // 组合消息格式
      const fullMessage = `${userName}：${inputMessage.trim()}`;

      // 保存到legalMessages集合
      await db.collection('legalMessages').add({
        data: {
          _openid: openid,
          content: fullMessage,
          createdAt: new Date()
        }
      });

      // 更新本地显示
      this.setData(prev => ({
        messages: [...prev.messages, {
          _openid: openid,
          content: fullMessage,
          createdAt: new Date()
        }],
        inputMessage: ''
      }));

      // 页面滚动到底部
      wx.pageScrollTo({
        scrollTop: 99999,
        duration: 300
      });

    } catch (error) {
      console.error('发送留言失败', error);
      wx.showToast({ title: '发送失败', icon: 'none' });
    }
  }
});
