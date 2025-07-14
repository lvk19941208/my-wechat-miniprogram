Page({
  data: {},

  onLegalConsult() {
    wx.navigateTo({
      url: '/pages/legalConsult/legalConsult'
    });
  },

  onPsychConsult() {
    wx.navigateTo({
      url: '/pages/psychConsult/psychConsult'
    });
  }
});
