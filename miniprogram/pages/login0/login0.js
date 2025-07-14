Page({
  data: {
    helpServiceDisabled: false
  },

  onLoad() {},

  onHelpService() {
    if (this.data.helpServiceDisabled) return;
    this.setData({ helpServiceDisabled: true });
    wx.navigateTo({ url: '/pages/login/login' });
    setTimeout(() => this.setData({ helpServiceDisabled: false }), 500);
  },

  onFamilyEducation() {
    wx.navigateTo({ url: '/pages/familyEducation/familyEducation' });
  },

  onConsult() { wx.navigateTo({ url: '/pages/consult/consult' }); },
  onPsychTest() { wx.showToast({ title: '功能待开发', icon: 'none' }); },
  onLegalNews() { wx.showToast({ title: '功能待开发', icon: 'none' }); },
  onCaseStudies() { wx.showToast({ title: '功能待开发', icon: 'none' }); },
  onLaws() { wx.showToast({ title: '功能待开发', icon: 'none' }); }
});