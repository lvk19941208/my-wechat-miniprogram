const cloud = require('wx-server-sdk');
cloud.init({
  env: 'cloud1-0gl2fjfc4ecb00c7'
});

const db = cloud.database();
const PAGE_SIZE = 100;

function formatDateToString(timestamp) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
}

function parseDateToTimestamp(date) {
  if (!date) return 0;
  if (date instanceof Date) return date.getTime();
  if (typeof date === 'number') return date;
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    console.warn(`Invalid date format: ${date}`);
    return 0;
  }
  return parsed.getTime();
}

exports.main = async (event, context) => {
  try {
    const now = new Date();
    const region = event.region || '';
    console.log('Current time:', now, 'Region:', region);

    const alerts = [];
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      const usersRes = await db.collection('users')
        .where(region && region !== 'all' ? { region } : {})
        .skip(skip)
        .limit(PAGE_SIZE)
        .get();
      const users = usersRes.data;
      console.log(`Fetched users (skip=${skip}):`, users.length);

      if (users.length === 0) {
        hasMore = false;
        break;
      }

      for (let user of users) {
        const openid = user._openid;
        console.log('Checking user:', openid);

        if (!user.region) {
          console.warn(`User ${openid} has no region, skipping`);
          continue;
        }

        const startTimestamp = parseDateToTimestamp(user.startDate) || 0;
        const endTimestamp = parseDateToTimestamp(user.endDate) || Infinity;
        if (endTimestamp < now.getTime() && endTimestamp !== Infinity) {
          console.log(`User ${openid} ended: ${formatDateToString(endTimestamp)}`);
          continue;
        }

        const logs = await db.collection('checkins')
          .where({ _openid: openid })
          .get();
        console.log(`Raw checkins for ${openid}:`, logs.data.length);

        let checkIns = {};
        for (const log of logs.data) {
          const timestamp = parseDateToTimestamp(log.timestamp);
          if (timestamp === 0) {
            console.warn(`Invalid timestamp for check-in: ${JSON.stringify(log)}`);
            continue;
          }
          if (timestamp < startTimestamp || (endTimestamp !== Infinity && timestamp > endTimestamp)) {
            continue;
          }
          const dateStr = formatDateToString(timestamp);
          checkIns[dateStr] = true;
        }

        const userAlertsRes = await db.collection('risk_alerts')
          .where({ _openid: openid })
          .orderBy('last_alert_timestamp', 'desc')
          .get();
        const userAlerts = userAlertsRes.data;

        const activeAlert = userAlerts.find(alert => alert.status === 'active');
        const lastResolvedAlert = userAlerts.find(alert => alert.status === 'resolved');

        if (lastResolvedAlert) {
          const lastResolvedTimestamp = parseDateToTimestamp(lastResolvedAlert.resolved_date);
          if (lastResolvedTimestamp !== 0) {
            const resolvedDay = formatDateToString(lastResolvedTimestamp);
            const todayStr = formatDateToString(now.getTime());
            if (resolvedDay === todayStr) {
              console.log(`User ${openid} resolved today, skipping`);
              continue;
            }
          }
        }

        // 检查最近三天（today - 3 至 today - 1）
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const checkEndDate = new Date(today);
        checkEndDate.setDate(today.getDate() - 1); // 昨天
        const checkStartDate = new Date(checkEndDate);
        checkStartDate.setDate(checkEndDate.getDate() - 2); // 前三天

        const checkStartTimestamp = Math.max(startTimestamp, checkStartDate.getTime());
        const checkEndTimestamp = Math.min(endTimestamp, checkEndDate.getTime());

        let missedDays = [];
        let consecutiveMissedDays = [];
        let currentDate = new Date(checkStartTimestamp);

        while (currentDate <= checkEndDate && currentDate.getTime() <= checkEndTimestamp) {
          const dateStr = formatDateToString(currentDate.getTime());
          if (!checkIns[dateStr]) {
            consecutiveMissedDays.push(dateStr);
          } else {
            consecutiveMissedDays = [];
            console.log(`Found check-in for ${openid} on ${dateStr}`);
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }

        if (consecutiveMissedDays.length >= 3) {
          missedDays = consecutiveMissedDays;
        }

        const missedThreeDays = missedDays.length >= 3;

        if (missedThreeDays) {
          const missedRange = missedDays.length > 0 
            ? `${missedDays[0]} 至 ${missedDays[missedDays.length - 1]}`
            : '连续三天未签到';
          const alertData = {
            _openid: openid,
            name: user.name,
            last_alert_date: formatDateToString(now.getTime()),
            last_alert_timestamp: now.getTime(),
            status: 'active',
            alert_reason: `未签到：${missedRange}`,
            missed_days: missedDays,
            resolved_date: '未解决',
            region: user.region,
            remark: user.remark || ''
          };

          if (activeAlert) {
            // 更新现有活跃预警的日期范围
            const alertId = activeAlert._id;
            await db.collection('risk_alerts').doc(alertId).update({
              data: {
                last_alert_date: formatDateToString(now.getTime()),
                last_alert_timestamp: now.getTime(),
                alert_reason: `未签到：${missedRange}`,
                missed_days: missedDays,
                remark: user.remark || ''
              }
            });
            alertData._id = alertId;
            console.log(`Updated alert for ${openid}: ${missedRange}`);
          } else {
            // 创建新预警
            const result = await db.collection('risk_alerts').add({ data: alertData });
            alertData._id = result._id;
            console.log(`Added alert for ${openid}: ${missedRange}`);
          }
          alerts.push({ ...alertData });
        } else if (activeAlert) {
          // 如果不再连续三天未签到，标记为已解决
          await db.collection('risk_alerts').doc(activeAlert._id).update({
            data: {
              status: 'resolved',
              resolved_date: formatDateToString(now.getTime()),
              resolved_reason: '用户已恢复签到'
            }
          });
          console.log(`Resolved alert for ${openid}`);
        }
      }

      skip += PAGE_SIZE;
    }

    console.log('Final alerts:', alerts.length);
    return { success: true, alerts };
  } catch (error) {
    console.error('CheckRisk error:', error);
    return { success: false, message: '检查失败', error };
  }
};