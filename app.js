var AV = require('leanengine');
var express = require('express');
bodyParser = require('body-parser');
var ejs = require('ejs');
var app = express();
var util = require('util');
var expressLayouts = require('express-ejs-layouts');
var _ = require('underscore');
var _s = require('underscore.string');
var querystring = require('querystring');
var fs = require('fs');

var domain = require('domain');
var path = require('path');

var login = require('./cloud/login.js');
var mutil = require('./cloud/mutil.js');
var config = require('./cloud/config.js');


var router = require('express').Router();

// App全局配置
if (process.env.LEANCLOUD_APP_ENV == 'production') {
        app.set('views', path.join(__dirname, 'views')); // 设置模板目录
/*    if(AV.applicationId!='1yw5ol8u3tr302beaifyf97zt8kdlngmhsswqb2b9lio9hrh'){
        app.use(function (req, res, next) {
            mutil.renderError(res, '当你看到这个页面的时候, 程序猿Tom肯定又忘记吃药了. 请帮个忙打Tom的电话13917890249提醒他一下。');
        });
    }*/
} else {
        app.set('views', path.join(__dirname, 'views')); // 设置模板目录
        //app.set('layout', 'layoutNew') // defaults to 'layout'
//    app.set('layout', 'layoutPlain') // defaults to 'layout'
}


app.set('view engine', 'ejs');        // 设置template引擎

// 加载云代码方法
//app.use(cloud);

// 使用 LeanEngine 中间件
// （如果没有加载云代码方法请使用此方法，否则会导致部署失败，详细请阅读 LeanEngine 文档。）
app.use(AV.Cloud);

app.use(express.static('public'));

//app.use(express.static(path.join(__dirname, 'public')));
//app.use(avosExpressHttpsRedirect());
//app.use(bodyParser({maxFieldsSize:'4 * 1024 * 1024 '}));        // 读取请求body的中间件
//app.use(express.limit(4000000));

//var cookieSettingFunc = AV.Cloud.CookieSession();

app.use(AV.Cloud.CookieSession({ secret: 'my secret', maxAge: 3600000*24*30, fetchUser: true }));
/*
// 服务端需要使用 connect-busboy（通过 npm install 安装）
var busboy = require('connect-busboy');
// 使用这个中间件
//app.use(busboy());*/

var multer = require('multer');
app.use(multer({dest:'./uploads/'}));

app.use(bodyParser.json());
//app.use(bodyParser.urlencoded({ extended: true,  limit:4 * 1024 * 1024}));
app.use(bodyParser.urlencoded({ extended: false,  limit:4 *100* 1024 * 1024}));
//app.use(bodyParser());
// 未处理异常捕获 middleware
app.use(function(req, res, next) {
    var d = null;
    if (process.domain) {
        d = process.domain;
    } else {
        d = domain.create();
    }
    d.add(req);
    d.add(res);
    d.on('error', function(err) {
        console.error('uncaughtException url=%s, msg=%s', req.url, err.stack || err.message || err);
        if(!res.finished) {
            res.statusCode = 500;
            res.setHeader('content-type', 'application/json; charset=UTF-8');
            res.end('uncaughtException');
        }
    });
    d.run(next);
});


var isMobile = {
    Android: function(ua) {
        return /Android/i.test(ua);
    },
    BlackBerry: function(ua) {
        return /BlackBerry/i.test(ua);
    },
    iOS: function(ua) {
        return /iPhone|iPad|iPod/i.test(ua);
    },
    Windows: function(ua) {
        return /IEMobile/i.test(ua);
    },
    any: function(ua) {
        return (isMobile.Android(ua) || isMobile.BlackBerry(ua) || isMobile.iOS(ua) || isMobile.Windows(ua));
    }
};

var detectBroswer = function (req, res, next) {

//    if (req._body) return next();
    var locals = res.locals;
    locals.useragent = req.headers['user-agent'];
    locals.inWeChat = false;
    locals.inDesktop = false;
    locals.inAndroid = false;
    if (req && req.headers && req.headers['user-agent']) {
        var ua = req.headers['user-agent'];
        if (/MicroMessenger\//i.test(ua)
            && /MicroMessenger\//i.test(ua)) {
            req.inWeChat = true;
            locals.inWeChat = true;
        }
        if (!isMobile.any(ua)) {
            req.inDesktop = true;
            locals.inDesktop = true;
        }
        if (isMobile.Android(ua)) {
            req.inAndroid = true;
            locals.inAndroid = true;
        }
    }
    return next();
}



var setGloableLocals = function (req, res, next) {
//    res.locals.getAbbr = mutil.getAbbr;
    res.locals._ = _;
    res.locals._s = _s;
    res.locals.req = req;
    res.locals.isLogin = res.locals.isLogin||null;
    res.locals.mutil = mutil;
    res.locals.config = config;
    next();
}

//app.use(setClientLocals);
app.use(expressLayouts);
app.use(login.clientTokenParser());
app.use(setGloableLocals);
app.use(detectBroswer);

//app.use(app.router);

// CORS (Cross-Origin Resource Sharing) headers to support Cross-site HTTP requests
app.all('*', function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    next();
});




var user = require('./cloud/routes/user');
user(app);

var oa = require('./cloud/routes/oa');
oa(app);


// 如果任何路由都没匹配到，则认为 404
// 生成一个异常让后面的 err handler 捕获
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// 如果是开发环境，则将异常堆栈输出到页面，方便开发调试
if (process.env.LEANCLOUD_APP_ENV!='production') {
    app.use(function(err, req, res, next) { // jshint ignore:line
        var statusCode = err.status || 500;
        if(statusCode === 500) {
            console.error(err.stack || err);
        }
        res.status(statusCode);
        res.render('500', {
            message: err.message || err,
            error: err
        });
    });
}else{
// 如果是非开发环境，则页面只输出简单的错误信息
    app.use(function(err, req, res, next) { // jshint ignore:line
        res.status(err.status || 500);
        res.render('error', {
            message: err.message || err,
            error: {}
        });
    });

}

module.exports = app;