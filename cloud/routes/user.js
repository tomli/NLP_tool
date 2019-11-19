
var AV = require('leanengine');
var login = require('../login.js');
var config = require('../config.js');
var mutil = require('../mutil');
var _ = require('underscore');
var _s = require('underscore.string');

var mobilePhoneSmsCodeMap = {};

var errorTransMap = {
    'The mobile phone number was invalid.': '无效的手机号码!',
    'Mobile phone number has already been taken': '这个手机号码已经被注册过了!',
    'The username and password mismatch.': '密码错误!',
    "Can't send sms code too frequently.": '提交过于频繁!',
    'Username has already been taken': '这个微手机号已经被注册过了!.',
    //'The mobile phone number is missing, and must be specified': '请先在<a class="btn btn-default" href="/selfEdit">个人信息</a>里填写手机号码,以接受短信认证!',
    'Could not find user': '此手机号不存在!'
};


function signUp(req, res, username, nickname, password, mobile, failRegFunc) {
    var user = new AV.User();
    user.set('username', username);
    user.set('nickname', nickname);
    user.set('password', password);
    if (mobile)
        user.setMobilePhoneNumber(mobile);
    user.signUp(null).then(function (user) {
        if (config.needMobieVerifyAfter&&mobile) {
            AV.User.requestMobilePhoneVerify(mobile).then(function () {
                res.send({
                    passed: true,
                    info: '请输入发送到你手机上的验证码!'
                });
            }, function (error) {
                failRegFunc(req, res, error);
            });
        } else
            res.send({
                passed: true,
                info: '注册成功! ',
                lfurl: login.getLastFailedURL(req)
            });
    }, function (error) {
        failRegFunc(req, res, error);
    });
}


exports = module.exports = function(app) {

    app.get('/register',  function(req, res) {
        if (login.isLogin(req)) {
            res.redirect('/');
        } else {
            res.locals.showFooter = false;
            res.render('register', {
                username: '',
                nickname: '',
                mobile: '',
                errormsg: null
            });
        }
    });

    var failRegFunc = function (req, res, error) {
        var msg = errorTransMap[error.message]?errorTransMap[error.message]:error.message;
        if(req.query.ajax){
            res.send({passed:true ,
                info:'请输入发送到你手机上的验证码!'});
        }else{
            mutil.renderInfo(res, msg);
        }
    }

    app.post('/register',  function(req, res) {
        var username = req.body.username;
        var mobile = req.body.mobile;
        var nickname = req.body.nickname;
        var password = req.body.password;
        if(mobile&&!username)
            username = mobile;
        var vcode = req.body.vcode;
        if (username && password && nickname) {
            if(config.needMobieVerifyWhenReg){
                var user = new AV.User();
                user.set('username', username);
                user.set('nickname', nickname);
                user.set('password', password);
                user.set('mobilePhoneNumber', mobile);
                user.set('smsCode', vcode);
                user.signUpOrlogInWithMobilePhone().then(function (success) {
                    var lfurl = login.getLastFailedURL(req);
                    mutil.renderInfo(res, '注册成功!', lfurl , lfurl);
                    // 成功
                }, function (error) {
                    failRegFunc(req,res, error);
                    // 失败
                });
            }else
                signUp(req, res, username, nickname, password, mobile, failRegFunc);
        } else {
            var msg = '带*的字段不能为空！';
            res.send({passed:false ,
                info:msg});
        }
    });


    app.get('/requestMobileVerify',  function(req, res) {
        var mobile = req.query.mobile;
        var ajax = req.query.ajax;
        if(!mobile&&req.client)
            mobile = req.client.mobilePhoneNumber;
        //console.log('req.client.mobilePhoneNumber::'+req.client.mobilePhoneNumber)
        console.log('req.query.mobile::'+req.query.mobile)
        if(!mobile || mobile == '')
            res.redirect('/inputMobile');
        else{
            console.log('requestMobilePhoneVerify  to  :: '+mobile)
            if(req.query.from&&req.query.from=='setMobile')
                login.renderMobileVerify(res, mobile);
            else{
                AV.User.requestMobilePhoneVerify(mobile).then(function () {
                    if(ajax){
                        res.send({passed:true ,
                            info:'请输入发送到你手机上的验证码!'});
                    }else{
                        login.renderMobileVerify(res, mobile);
                    }
                },function (error) {
                    failRegFunc(req, res, error);
                });
            }
        }
    });


    app.get('/requestSmsCode',  function(req, res) {
        var mobile = req.query.mobile;
        var ajax = req.query.ajax;
        var template = req.query.template;
        if(!mobile&&req.client)
            mobile = req.client.mobilePhoneNumber;
        //console.log('req.client.mobilePhoneNumber::'+req.client.mobilePhoneNumber)
        console.log('req.query.mobile::'+req.query.mobile)
        if(!mobile || mobile == '')
            res.redirect('/inputMobile');
        else{
            var vcode = _.random(1000,9999);
            AV.Cloud.requestSmsCode({
                mobilePhoneNumber: mobile,
                template: template,
                code: vcode,
                username: mobile,
                sitename: config.siteName
            }).then(function (results) {
                mobilePhoneSmsCodeMap[mobile] = vcode;
                if(ajax){
                    res.send({passed:true ,
                        info:'请输入发送到你手机上的验证码!'});
                }else{
                    login.renderMobileVerify(res, mobile);
                }
            },function (error) {
                failRegFunc(req, res, error);
            });
        }
    });


    app.get('/login',  function(req, res) {
        if (login.isLogin(req)) {
            res.redirect('/');
        } else {
            res.render('login.ejs', {
                info: '欢迎回来!'
            });
        }
    });


    app.post('/login', function (req, res) {
        var username = req.body.username;
        var mobile = req.body.mobile;
        var password = req.body.password;
        if(!username&&mobile)
            username = mobile;
        AV.User.logIn(username, password, {
            success: function (user) {
                var lfurl = login.getLastFailedURL(req);
                console.log('Triggered lfurl on ' + lfurl);
                mutil.renderInfo(res, 'login Sucess', lfurl , lfurl);
                // res.render('admin', {info: '欢迎!'+user.get('nickname'), enemyResponse: ''});
            },
            error: function (user, error) {
                console.log(error);
                var msg = errorTransMap[error.message]?errorTransMap[error.message]:error.message;
                mutil.renderInfo(res, msg);
            }
        });
    });


    app.post('/mlogin', function (req, res) {
        var mobile = req.body.mobile;
        var password = req.body.password;
        AV.User.logInWithMobilePhone(mobile, password, {
            success: function (user) {
                var lfurl = login.getLastFailedURL(req);
                console.log('Triggered lfurl on ' + lfurl);
                mutil.renderInfo(res,  '欢迎,'+(user.get('nickname')||'')+'!', lfurl , lfurl);
                // res.render('admin', {info: '欢迎!'+user.get('nickname'), enemyResponse: ''});
            },
            error: function (user, error) {
                console.log(error);
                var msg = errorTransMap[error.message]?errorTransMap[error.message]:error.message;
                mutil.renderInfo(res, msg);
            }
        });
    });


    app.get('/logout', function (req, res) {
        AV.User.logOut();
        res.redirect('/');
    });

}