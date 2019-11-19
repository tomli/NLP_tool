'use strict';
var AV = require('leanengine');


var APP_ID = process.env.LEANCLOUD_APP_ID || 'xxxxxxxxxxxxxxxxxxxxxxxx'; // 你的 app id
var APP_KEY = process.env.LEANCLOUD_APP_KEY || 'xxxxxxxxxxxxxxxxxxxxxxxx'; // 你的 app key
var MASTER_KEY = process.env.LEANCLOUD_APP_MASTER_KEY || 'xxxxxxxxxxxxxxxxxxxxxxxx'; // 你的 master key


/*

 */

//AV.useAVCloudUS();
AV.initialize(APP_ID, APP_KEY, MASTER_KEY);
// AV.init({appId: APP_ID, appKey: APP_KEY, masterKey:MASTER_KEY,
//   serverURLs: 'https://avoscloud.com',});
// 如果不希望使用 masterKey 权限，可以将下面一行删除
AV.Cloud.useMasterKey();

var app = require('./app.js');

// 端口一定要从环境变量 `LEANCLOUD_APP_PORT` 中获取。
// LeanEngine 运行时会分配端口并赋值到该变量。
var PORT = parseInt(process.env.LEANCLOUD_APP_PORT || 3000);
app.listen(PORT, function () {
  console.log('Node app is running, port:', PORT);
});
