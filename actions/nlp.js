var config = require('../cloud/config.js');
var utils = require('../hw-sdk/utils');
var ais = require('../hw-sdk/ais');
var https = require("https");   // 加载node.js内置的https的模块

// 初始化服务的区域信息，目前支持华北-北京(cn-north-4)、亚太-香港(ap-southeast-1)等区域信息
utils.initRegion("cn-north-4");

module.exports = {
    summary_extract: function(token, content, callback) {

        var endPoint = utils.getEndPoint(ais.NLP_EXT_SERVICE);
        let path = '/v1/'+config.hw_project_id+'/nlg/summarization';
        // 构建请求信息和请求参数信息
        var requestData = {
            "content": content
        };
        var options = utils.getHttpRequestEntityOptions(endPoint, "POST", path, {
            "Content-Type": "application/json",
            "X-Auth-Token": token
        });
        var requestBody = JSON.stringify(requestData);

        var request = https.request(options, function (response) {

            // 验证服务调用返回的状态是否成功，如果为200, 为成功, 否则失败。
            if (response.statusCode !== 200) {
                console.log('Http status code is: ' + response.statusCode);
            }

            // 返回文本内容检测服务结果
            response.on("data", function (chunk) {
                // 返回中文unicode处理
                var result = JSON.parse(chunk.toString());
                callback(result);
            })
        });

        request.on("error", function (err) {
            console.log(err.message);
        });

        request.write(requestBody);
        request.end();
    }
}