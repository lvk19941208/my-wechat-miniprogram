Page({
  data: {
    id: '',
    target_name: '',
    content: '',
    matchingUsers: 0,
    region: '',
    isSuperAdmin: false
  },

  onLoad(options) {
    // 权限验证
    const adminInfo = wx.getStorageSync('adminInfo');
    if (!adminInfo || !adminInfo.isAdmin) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      wx.redirectTo({ url: '/pages/adminLogin/adminLogin' });
      return;
    }

    this.setData({
      region: adminInfo.region ? adminInfo.region.trim() : '',
      isSuperAdmin: adminInfo.role === 'super_admin'
    }, () => {
      console.log('Admin region:', this.data.region, 'isSuperAdmin:', this.data.isSuperAdmin);

      if (options && options.id) {
        this.setData({ id: options.id });
        console.log('设置 id:', options.id);
        this.loadNotice(options.id);
      } else {
        console.log('未找到 id，进入发布模式');
      }
    });
  },

  onShow() {
    console.log('notifyPublish onShow, 当前 id:', this.data.id);
  },

  async loadNotice(id) {
    wx.showLoading({ title: '加载中...', mask: true });

    const db = wx.cloud.database();
    const { region, isSuperAdmin } = this.data;

    try {
      const res = await db.collection('notices').doc(id).get();
      const notice = res.data;
      console.log('加载通知成功，数据:', notice);

      // 权限验证：普通管理员只能编辑自己地区的小孩的通知
      if (!isSuperAdmin && region) {
        const userRes = await db.collection('users')
          .where({ _openid: notice.target_openid })
          .field({ region: true })
          .get();
        const userRegion = userRes.data.length > 0 ? userRes.data[0].region : '';
        console.log('Target user region:', userRegion);

        if (userRegion !== region) {
          wx.hideLoading();
          wx.showToast({ title: '无权限编辑此通知', icon: 'none' });
          setTimeout(() => {
            wx.navigateBack();
          }, 2000);
          return;
        }
      }

      const content = notice.content || '暂无内容';
      const target_name = notice.target_name || '';
      this.setData({
        target_name,
        content,
        matchingUsers: 0 // 重置匹配用户数量
      });
      this.checkMatchingUsers(target_name); // 重新计算匹配用户数量
      wx.setNavigationBarTitle({
        title: '编辑通知 - ' + this.formatDate(notice.createdAt || new Date(), true)
      });
      wx.hideLoading();
    } catch (err) {
      wx.hideLoading();
      console.error('加载通知失败:', err);
      wx.showToast({ title: '加载失败: ' + (err.errMsg || '未知错误'), icon: 'none', duration: 2000 });
      setTimeout(() => {
        wx.navigateBack();
      }, 2000);
    }
  },

  onNameInput(e) {
    const target_name = e.detail.value;
    this.setData({ target_name });
    this.checkMatchingUsers(target_name);
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value });
  },

  async checkMatchingUsers(name) {
    if (!name) {
      this.setData({ matchingUsers: 0 });
      return;
    }

    const db = wx.cloud.database();
    const { region, isSuperAdmin } = this.data;

    try {
      // 构建查询条件
      let query = { name: name };

      // 如果是普通管理员，需筛选自己地区的小孩
      if (!isSuperAdmin && region) {
        query.region = region;
      }

      const res = await db.collection('users')
        .where(query)
        .count();
      this.setData({ matchingUsers: res.total });
    } catch (err) {
      console.error('查询匹配用户失败:', err);
      this.setData({ matchingUsers: 0 });
    }
  },

  async submitNotice() {
    const { id, target_name, content, region, isSuperAdmin } = this.data;
    if (!target_name || !content) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '提交中...', mask: true });
    const db = wx.cloud.database();

    try {
      // 查询目标用户
      let userQuery = { name: target_name };
      if (!isSuperAdmin && region) {
        userQuery.region = region;
      }
      const userRes = await db.collection('users')
        .where(userQuery)
        .field({ _openid: true })
        .get();
      const targetUsers = userRes.data;
      console.log('Target users:', targetUsers);

      if (targetUsers.length === 0) {
        wx.hideLoading();
        wx.showToast({ title: '未找到匹配用户', icon: 'none' });
        return;
      }

      // 批量创建或更新通知
      const batchSize = 20; // 云数据库批量操作限制
      const tasks = [];
      for (let i = 0; i < targetUsers.length; i += batchSize) {
        const batchUsers = targetUsers.slice(i, i + batchSize);
        const batchTask = async () => {
          for (const user of batchUsers) {
            const data = {
              target_openid: user._openid,
              target_name,
              content,
              createdAt: new Date(),
              viewed: false
            };

            if (id) {
              // 编辑模式：更新通知
              await db.collection('notices').doc(id).update({
                data: {
                  target_openid: user._openid,
                  target_name,
                  content,
                  updatedAt: new Date()
                }
              });
            } else {
              // 发布模式：新增通知
              await db.collection('notices').add({ data });
            }
          }
        };
        tasks.push(batchTask());
      }

      await Promise.all(tasks);
      wx.hideLoading();
      wx.showToast({ title: id ? '更新成功' : '发布成功', icon: 'success' });

      // 获取页面栈，通知 notifyUsers 页面刷新
      const pages = getCurrentPages();
      const prevPage = pages[pages.length - 2]; // 上一个页面是 notifyUsers
      if (prevPage && prevPage.route === 'pages/notifyUsers/notifyUsers') {
        prevPage.setData({
          notices: [],
          page: 0,
          hasMoreNotices: true
        });
        prevPage.loadNotices(); // 触发刷新
      }

      setTimeout(() => {
        wx.navigateBack();
      }, 1000);
    } catch (err) {
      wx.hideLoading();
      console.error('提交通知失败:', err);
      wx.showToast({ title: '操作失败: ' + (err.errMsg || '未知错误'), icon: 'none' });
    }
  },

  async deleteNotice() {
    const { id, region, isSuperAdmin } = this.data;
    if (!id) {
      wx.showToast({ title: '未找到通知ID', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条通知吗？此操作不可恢复。',
      confirmText: '删除',
      confirmColor: '#FF4D4F',
      cancelText: '取消',
      success: async res => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...', mask: true });
          const db = wx.cloud.database();

          try {
            // 权限验证：普通管理员只能删除自己地区的小孩的通知
            if (!isSuperAdmin && region) {
              const noticeRes = await db.collection('notices').doc(id).get();
              const notice = noticeRes.data;
              const userRes = await db.collection('users')
                .where({ _openid: notice.target_openid })
                .field({ region: true })
                .get();
              const userRegion = userRes.data.length > 0 ? userRes.data[0].region : '';
              console.log('Target user region for delete:', userRegion);

              if (userRegion !== region) {
                wx.hideLoading();
                wx.showToast({ title: '无权限删除此通知', icon: 'none' });
                return;
              }
            }

            await db.collection('notices').doc(id).remove();
            wx.hideLoading();
            wx.showToast({ title: '删除成功', icon: 'success' });

            // 获取页面栈，通知 notifyUsers 页面刷新
            const pages = getCurrentPages();
            const prevPage = pages[pages.length - 2]; // 上一个页面是 notifyUsers
            if (prevPage && prevPage.route === 'pages/notifyUsers/notifyUsers') {
              prevPage.setData({
                notices: [],
                page: 0,
                hasMoreNotices: true
              });
              prevPage.loadNotices(); // 触发刷新
            }

            setTimeout(() => {
              wx.navigateBack();
            }, 1000);
          } catch (err) {
            wx.hideLoading();
            console.error('删除通知失败:', err);
            wx.showToast({ title: '删除失败: ' + (err.errMsg || '未知错误'), icon: 'none' });
          }
        }
      }
    });
  },

  goBack() {
    wx.navigateBack();
  },

  formatDate(date, short = false) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    if (short) {
      return `${year}-${month}-${day}`;
    }
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }
});