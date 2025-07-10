const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-0gl2fjfc4ecb00c7' })
exports.main = async (event, context) => {
  const db = cloud.database()
  const users = await db.collection('users').where({ role: 'user' }).get()
  for (let user of users.data) {
    const lastCheckin = await db.collection('checkins')
      .where({ _openid: user._openid })
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get()
    const now = new Date()
    const lastTime = lastCheckin.data.length > 0 ? new Date(lastCheckin.data[0].timestamp) : null
    if (!lastTime || (now - lastTime) > 3 * 24 * 60 * 60 * 1000) {
      console.log(`${user.name} 未签到超过3天`)
      // 订阅消息功能需要管理员openid和模板ID，暂时注释
      // await cloud.openapi.subscribeMessage.send({
      //   touser: '[管理员openid]',
      //   templateId: '[模板ID]',
      //   data: { thing1: { value: `${user.name} 未签到超过3天` } }
      // })
    }
  }
}