# 文本摘要提取小工具

使用华为智能云NLP接口实现文本摘要功能的web端小工具，部署在lean cloud上。


**配置**

1.注册一个leancloud账号，并开通一个app。将APP_ID和APP_KEY设置在/server.js中

``` 
  var APP_ID = process.env.LEANCLOUD_APP_ID || 'xxxxxxxxxxxxxxxxxxxxxxxx'; // 你的 app id
  var APP_KEY = process.env.LEANCLOUD_APP_KEY || 'xxxxxxxxxxxxxxxxxxxxxxxx'; // 你的 app key
  var MASTER_KEY = process.env.LEANCLOUD_APP_MASTER_KEY || 'xxxxxxxxxxxxxxxxxxxxxxxx'; // 你的 master key

  ``` 
  
2. 在/hw_config.js 中设置华为云账号密码，以及projectID
``` 
  
exports.hw_username = "xxxxxxxxxxx";  //华为云用户名
exports.hw_domain_name = "xxxxxxxxxxx"; //华为云用户名
exports.hw_password = "xxxxxxxxxxx"; //华为云密码
exports.hw_project_id = "06e07f7d440026962f6fc01dac93f5fb";  //华为云project_id
[如何获取project_id](https://support.huaweicloud.com/api-nlp/nlp_03_0006.html)


  ``` 

**部署**
  1. 安装lean  [cloud命令行工具](https://leancloud.cn/docs/leanengine_cli.html) 
  2. 使用如下命令把项目部署到lean cloud云引擎上
  ``` 
     lean deploy
     
  ``` 
   
**本地测试**

   配置完成后，运行
  ``` 
     npm run test
     
  ``` 