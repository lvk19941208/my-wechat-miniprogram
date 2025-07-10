const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event, context) => {
  const db = cloud.database();
  try {
    // 为 notices 集合的 createdAt 字段创建 TTL 索引
    await db.collection('notices').createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: 604800 } // 7天 = 604800秒
    );
    return {
      success: true,
      message: 'TTL 索引创建成功'
    };
  } catch (err) {
    console.error('创建 TTL 索引失败:', err);
    return {
      success: false,
      message: '创建 TTL 索引失败',
      error: err
    };
  }
};