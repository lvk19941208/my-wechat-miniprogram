Page({
  data: {
    userName: '',
    openid: '',
    images: [], // 存储图片信息（本地路径和云存储路径）
    maxImages: 3 // 最大上传图片数量
  },

  onLoad() {
    const openid = wx.getStorageSync('openid');
    const userName = wx.getStorageSync('userName') || '未知用户';
    console.log('activityReflection onLoad, openid:', openid);
    this.setData({
      userName: userName,
      openid: openid
    });
    if (!openid) {
      wx.showToast({
        title: '用户未登录',
        icon: 'none'
      });
      wx.navigateBack();
    }
    // 设置导航栏标题
    wx.setNavigationBarTitle({
      title: `${userName} 的活动心得`
    });
  },

  // 选择图片（拍照或从相册选择）
  chooseImage() {
    const remaining = this.data.maxImages - this.data.images.length;
    if (remaining <= 0) {
      wx.showToast({
        title: '最多上传3张图片',
        icon: 'none'
      });
      return;
    }

    wx.chooseImage({
      count: remaining,
      sizeType: ['original', 'compressed'],
      sourceType: ['album', 'camera'],
      success: res => {
        const tempFilePaths = res.tempFilePaths;
        const newImages = tempFilePaths.map(path => ({
          localPath: path,
          cloudPath: ''
        }));
        this.setData({
          images: this.data.images.concat(newImages)
        });
        // 逐一上传图片
        tempFilePaths.forEach((path, index) => {
          this.uploadImage(path, this.data.images.length - tempFilePaths.length + index);
        });
      },
      fail: err => {
        console.error('选择图片失败:', err);
        wx.showToast({
          title: '选择图片失败',
          icon: 'none'
        });
      }
    });
  },

  // 上传图片到云存储
  uploadImage(filePath, index) {
    wx.showLoading({ title: '上传中...', mask: true });
    const cloudPath = `activity_reflections/${this.data.openid}/${Date.now()}-${index}.jpg`;
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: filePath,
      success: res => {
        wx.hideLoading();
        console.log('图片上传成功，fileID:', res.fileID);
        const images = this.data.images;
        images[index].cloudPath = res.fileID;
        this.setData({ images });
      },
      fail: err => {
        wx.hideLoading();
        console.error('图片上传失败:', err);
        wx.showToast({
          title: '图片上传失败',
          icon: 'none'
        });
        // 上传失败时移除该图片
        const images = this.data.images;
        images.splice(index, 1);
        this.setData({ images });
      }
    });
  },

  // 删除图片
  deleteImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.images;
    const image = images[index];

    if (image.cloudPath) {
      wx.cloud.deleteFile({
        fileList: [image.cloudPath],
        success: res => {
          console.log('删除云存储图片成功:', res);
        },
        fail: err => {
          console.error('删除云存储图片失败:', err);
        }
      });
    }

    images.splice(index, 1);
    this.setData({ images });
  },

  // 预览图片
  previewImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.images.map(item => item.localPath);
    wx.previewImage({
      current: images[index],
      urls: images
    });
  },

  // 提交心得
  submitReflection() {
    const { images, openid } = this.data;
    if (images.length === 0) {
      wx.showToast({
        title: '请至少上传一张图片',
        icon: 'none'
      });
      return;
    }

    // 检查是否有图片未上传完成
    const hasPendingUpload = images.some(image => !image.cloudPath);
    if (hasPendingUpload) {
      wx.showToast({
        title: '请等待图片上传完成',
        icon: 'none'
      });
      return;
    }

    // 调试：打印提交数据
    console.log('提交数据:', {
      openid: openid,
      imagePaths: images.map(image => image.cloudPath),
      timestamp: new Date()
    });

    wx.showLoading({ title: '提交中...', mask: true });

    const db = wx.cloud.database();
    db.collection('activity_reflections').add({
      data: {
        // 移除 _openid 字段，系统会自动添加
        imagePaths: images.map(image => image.cloudPath),
        timestamp: new Date(),
        feedback: '',
        feedback_timestamp: null
      },
      success: res => {
        wx.hideLoading();
        console.log('提交成功:', res);
        wx.showToast({
          title: '提交成功',
          icon: 'success'
        });
        this.setData({
          images: []
        });
      },
      fail: err => {
        wx.hideLoading();
        console.error('提交心得失败:', err);
        wx.showToast({
          title: '提交失败: ' + (err.errMsg || '未知错误'),
          icon: 'none'
        });
      }
    });
  },

  goBack() {
    wx.navigateBack();
  }
});