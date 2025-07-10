const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-0gl2fjfc4ecb00c7' });
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  console.log('wxContext:', wxContext); // 调试信息
  return {
    openid: wxContext.OPENID
  };
};