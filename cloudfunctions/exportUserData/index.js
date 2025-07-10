const cloud = require('wx-server-sdk');
const ExcelJS = require('exceljs');

cloud.init({
  env: 'cloud1-0gl2fjfc4ecb00c7'
});

const db = cloud.database();

exports.main = async (event, context) => {
  console.log('Event received:', event);

  const { openid, name } = event;
  if (!openid) {
    console.error('Missing openid');
    return { success: false, message: '用户 openid 不能为空' };
  }

  try {
    // 查询签到记录
    console.log('Querying checkins for openid:', openid);
    const checkinsRes = await db.collection('checkins').where({ _openid: openid }).get();
    const checkins = checkinsRes.data;
    console.log('Checkins:', checkins);

    // 查询日常分享
    console.log('Querying daily_logs for openid:', openid);
    const dailyLogsRes = await db.collection('daily_logs').where({ _openid: openid }).get();
    const dailyLogs = dailyLogsRes.data;
    console.log('Daily logs:', dailyLogs);

    // 查询活动心得
    console.log('Querying activity_reflections for openid:', openid);
    const reflectionsRes = await db.collection('activity_reflections').where({ _openid: openid }).get();
    const reflections = reflectionsRes.data;
    console.log('Activity reflections:', reflections);

    // 创建 Excel 工作簿
    console.log('Creating Excel workbook');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '帮教管理系统';
    workbook.created = new Date();

    // 工作表 1：签到记录
    const checkinsSheet = workbook.addWorksheet('签到记录');
    checkinsSheet.columns = [
      { header: '签到时间', key: 'timestamp', width: 20 },
      { header: '纬度', key: 'latitude', width: 15 },
      { header: '经度', key: 'longitude', width: 15 },
      { header: '地址', key: 'fullAddress', width: 30 }
    ];
    checkins.forEach(checkin => {
      checkinsSheet.addRow({
        timestamp: checkin.timestamp ? new Date(checkin.timestamp).toLocaleString() : '未知',
        latitude: checkin.latitude || '未知',
        longitude: checkin.longitude || '未知',
        fullAddress: checkin.fullAddress || '未知'
      });
    });

    // 工作表 2：日常分享
    const dailyLogsSheet = workbook.addWorksheet('日常分享');
    dailyLogsSheet.columns = [
      { header: '分享时间', key: 'timestamp', width: 20 },
      { header: '内容', key: 'content', width: 50 }
    ];
    dailyLogs.forEach(log => {
      dailyLogsSheet.addRow({
        timestamp: log.timestamp ? new Date(log.timestamp).toLocaleString() : '未知',
        content: log.content || '无'
      });
    });

    // 工作表 3：活动心得
    const reflectionsSheet = workbook.addWorksheet('活动心得');
    reflectionsSheet.columns = [
      { header: '提交时间', key: 'timestamp', width: 20 },
      { header: '心得图片', key: 'imagePaths', width: 50 } // 宽度可以根据图片大小调整
    ];

    // 处理图片嵌入
    for (let i = 0; i < reflections.length; i++) {
      const reflection = reflections[i];
      const row = reflectionsSheet.addRow({
        timestamp: reflection.timestamp ? new Date(reflection.timestamp).toLocaleString() : '未知',
        imagePaths: '' // 先占位，稍后嵌入图片
      });

      if (reflection.imagePaths && reflection.imagePaths.length > 0) {
        // 只处理第一张图片（如果有多张，可以循环处理）
        const imagePath = reflection.imagePaths[0];
        console.log('Downloading image:', imagePath);

        // 下载图片
        const downloadRes = await cloud.downloadFile({
          fileID: imagePath
        });
        const imageBuffer = downloadRes.fileContent;
        console.log('Image downloaded, size:', imageBuffer.length);

        // 将图片添加到工作簿
        const imageId = workbook.addImage({
          buffer: imageBuffer,
          extension: 'jpeg' // 根据实际图片格式调整（如 png、jpg）
        });

        // 将图片嵌入到单元格（B列，当前行）
        reflectionsSheet.addImage(imageId, {
          tl: { col: 1, row: i + 1 }, // 从第2列（B列）、当前行开始
          ext: { width: 100, height: 100 } // 图片显示尺寸，可以调整
        });
      }
    }

    // 生成 Excel 文件
    console.log('Generating Excel buffer');
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `用户数据_${name}_${Date.now()}.xlsx`;

    // 上传到云存储
    console.log('Uploading file to cloud storage:', fileName);
    const uploadRes = await cloud.uploadFile({
      cloudPath: `exports/${fileName}`,
      fileContent: buffer
    });
    console.log('File uploaded:', uploadRes);

    return {
      success: true,
      fileID: uploadRes.fileID
    };
  } catch (err) {
    console.error('Export error:', err);
    return {
      success: false,
      message: '导出失败: ' + err.message
    };
  }
};