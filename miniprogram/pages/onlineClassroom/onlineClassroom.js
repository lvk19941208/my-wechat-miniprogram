Page({
  data: {
    categories: [
      { id: 'psychology', name: '心理健康' },
      { id: 'communication', name: '家庭沟通' },
      { id: 'law', name: '法律教育' }
    ],
    contents: [],
    selectedCategory: '',
    isLoading: false,
    errorMessage: '',
    placeholderImageUrl: 'cloud://cloud1-0gl2fjfc4ecb00c7.636c-cloud1-0gl2fjfc4ecb00c7-1350622662/images/placeholder.png'
  },

  onLoad() {
    this.loadPlaceholderImage();
    this.loadContents();
  },

  loadPlaceholderImage() {
    wx.cloud.getTempFileURL({
      fileList: [this.data.placeholderImageUrl],
      success: res => {
        if (res.fileList[0].tempFileURL) {
          this.setData({ placeholderImageUrl: res.fileList[0].tempFileURL });
        }
      },
      fail: err => {
        console.error('获取占位图片 URL 失败:', err);
      }
    });
  },

  onCategoryTap(e) {
    const categoryId = e.currentTarget.dataset.id;
    this.setData({ selectedCategory: categoryId, contents: [], errorMessage: '' });
    this.loadContents(categoryId);
  },

  loadContents(categoryId = '') {
    if (this.data.isLoading) return;
    this.setData({ isLoading: true, errorMessage: '' });

    const db = wx.cloud.database();
    const query = categoryId ? { category: categoryId } : {};

    db.collection('education_contents')
      .where(query)
      .orderBy('createdAt', 'desc')
      .get({
        success: res => {
          const contents = res.data.map(item => {
            item.createdAt = this.formatDate(item.createdAt);
            return item;
          });

          const fileIds = contents
            .map(item => item.thumbnail)
            .concat(contents.filter(item => item.type === 'video').map(item => item.url));

          if (fileIds.length === 0) {
            this.setData({
              contents,
              isLoading: false,
              errorMessage: contents.length === 0 ? '暂无相关内容' : ''
            });
            return;
          }

          wx.cloud.getTempFileURL({
            fileList: fileIds,
            success: fileRes => {
              const fileMap = {};
              fileRes.fileList.forEach(file => {
                fileMap[file.fileID] = file.tempFileURL;
              });

              const updatedContents = contents.map(item => {
                item.thumbnail = fileMap[item.thumbnail] || this.data.placeholderImageUrl;

                if (item.type === 'video') {
                  item.originalFileId = item.url;
                  item.url = fileMap[item.url] || item.url;
                }

                return item;
              });

              this.setData({
                contents: updatedContents,
                isLoading: false,
                errorMessage: updatedContents.length === 0 ? '暂无相关内容' : ''
              });
            },
            fail: err => {
              console.error('获取临时 URL 失败:', err);
              this.setData({
                contents,
                isLoading: false,
                errorMessage: '图片或视频加载失败'
              });
            }
          });
        },
        fail: err => {
          console.error('加载内容失败:', err);
          this.setData({
            isLoading: false,
            errorMessage: '加载失败，请稍后重试'
          });
          wx.showToast({ title: '加载失败，请重试', icon: 'none' });
        }
      });
  },

  onContentTap(e) {
    const { type, id, title } = e.currentTarget.dataset;
    const item = this.data.contents.find(i => i._id === id);
    if (!item) {
      wx.showToast({ title: '内容未找到', icon: 'none' });
      return;
    }

    if (type === 'video') {
      const fileId = encodeURIComponent(item.originalFileId || item.url);
      wx.navigateTo({
        url: `/pages/videoPlayer/videoPlayer?url=${fileId}&title=${encodeURIComponent(title)}`
      });
    } else if (type === 'article') {
      if (item.url && item.url.startsWith('cloud://')) {
        const url = encodeURIComponent(item.url);
        wx.navigateTo({
          url: `/pages/articleViewer/articleViewer?url=${url}&title=${encodeURIComponent(title)}`
        });
      } else {
        wx.showToast({
          title: '文章链接无效',
          icon: 'none'
        });
      }
    }
  },

  formatDate(date) {
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      console.error('无效的日期:', date);
      return '无效日期';
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  onImageError(e) {
    console.error('缩略图加载失败:', e.detail);
    if (e.detail.errMsg.includes('thumbnail')) {
      wx.showToast({
        title: '缩略图加载失败',
        icon: 'none',
        duration: 1500
      });
    }
  }
});
