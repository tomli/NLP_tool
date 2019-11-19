/**
 * Created by lzw on 14-8-7.
 */

var AV = require('leanengine');
var _ = require('underscore');
var util = require('util');
var anonymousToken = 'anonymous';
var anonymousCid = 'anonymousCid';
var muser = require('./muser.js');
var mutil = require('./mutil.js');
var config = require('./config.js');

var adminIds = [];

function setResLoginStatus(res, isLogin, client) {
    res.locals.isLogin = isLogin;
    res.locals.mClient = client;
}

function renderEmailVerify(res, email) {
    res.render('verify_email', {email: email});
}

function renderMobileVerify(res, mobile, msg) {
    res.render('verify_mobile', {mobile: mobile, barTitle:'验证手机号码', msg:msg});
}

function findClient(req, res, f) {
    //var curUser = AV.User.current();
    var curUser =  req.AV.user;
    if (curUser) {
        curUser.fetch().then(function(curUser){
            var user = muser.transfromUser(curUser);
            setResLoginStatus(res, true, user);
            f.call(this, user.token, user.id, user);
        },mutil.renderErrorFn(res));
    } else {
        var anonymousClient = {
            id: anonymousCid,
            username: '匿名用户',
            email: req.body.email,
            token: anonymousToken
        };
        setResLoginStatus(res, false, anonymousClient);
        f.call(this, anonymousToken, anonymousCid, anonymousClient);
    }
}

function isAdmin(cid) {
    var p = new AV.Promise();
    //var user = AV.Object.createWithoutData('_User', cid);
    findAdmins().then(function (admIds) {
        p.resolve(_.contains(adminIds, cid));
    }, mutil.rejectFn(p));
    return p;
}

function findAdmins(modifyQueryFn) {
    var p = new AV.Promise();
    if(adminIds.length>0){
        p.resolve(adminIds);
    }else{
        mutil.findAll('Admin', function (q) {
            q.include('user');
            if(modifyQueryFn){
                modifyQueryFn(q);
            }
        }).then(function (results) {
            _.each(results, function(ele){
                adminIds.push(ele.get('user').id);
            });
            p.resolve(adminIds);
        });
    }
    return p;
}

exports.clientTokenParser = function () {
    return function (req, res, next) {
        var regs = [/\.css$/, /^\/fonts\//, /\.js$/,/\.jpg$/,/\.gif$/, /\.png$/,/\.pdf/,/\.ico$/, /\.txt$/,/^\/images/];
        var isStatic = _.some(regs, function (reg) {
            return reg.test(req.originalUrl);
        });

        if (isStatic) {
            next();
        } else {
            console.log('req url ' + req.originalUrl);
            findClient(req, res, function (token, cid, client) {
                //console.log('find client');
                req.token = token;
                req.cid = cid;
                req.client = client;
                res.locals.client = client;
                console.log('find cid=' + req.cid);
                isAdmin(cid).then(function (isAdmin) {
                    req.admin = isAdmin;
                    client.isAdmin = isAdmin;
                    if (req.cid != anonymousCid && client.emailVerified == false) {
                        if (/^\/(requestEmailVerify|logout)/.test(req.originalUrl) || config.needEmailVerify === false) {
                            next();
                        } else {
                            renderEmailVerify(res, client.email);
                        }
                    } else {
                        if (/^\/admin.*/.test(req.originalUrl)) {
                            if (isAdmin) {
                                next();
                            } else {
                                console.log('isn\'t not admin');
                                mutil.renderForbidden(res);
                            }
                        }else{
                            next();
                        }
                    }
                }, function (err) {
                    console.log(err);
                    mutil.logError(err);
                    res.send(util.inspect(err) + '! or you must create class Admin in DB!!!!!!');
                });
            });
        }
    };
};

function isLogin() {
    return AV.User.current();
}



function getLastFailedURL(req) {
    var lfurl = '/';
    var lastFailedURL = req.sessionCookies.get('lastFailedURL');

    /*    if (req.cookies && req.cookies.lastFailedURL){
     lfurl = req.cookies.lastFailedURL;
     //        req.cookies.lastFailedURL = null;
     }
     */
    return lastFailedURL||lfurl;
}

function setLastFailedRUL(req, res) {
    var lastFailedURL = req.lastFailedURL? req.lastFailedURL: (req.originalUrl||req.url);
    console.log('set lastFailedURL to ' + lastFailedURL);
    req.sessionCookies.set('lastFailedURL', lastFailedURL, { maxAge: 3000000, httpOnly: true });
    //res.cookie('lastFailedURL', '1', { domain: '.yanhuang.avosapps.com', maxAge: 3000000, httpOnly: true })
}

function needVerifiedMobie(req, res, then) {
    needLogin(req, res, function (req, res) {
        if (req.client.mobilePhoneVerified)
            then(req, res);
        else {
            setLastFailedRUL(req, res);
            //        req._avos_session.lastFailedURL = req.url;
//            mutil.renderError(res, "你必须验证手机号之后才能使用此项功能．请点<a class='btn btn-primary btn-lg' href='/requestMobileVerify'>这里</a>验证.");
            if (req.client.mobilePhoneNumber)
                res.redirect('/requestMobileVerify?from=needVerifiedMobie');
            else
                res.render('selfEdit', {
                    title:'设定手机号',
                    client: req.client,
                    tag: null,
                    wxusername: req.client.username,
                    from: 'needVerifiedMobie',
                    mobile: mobile,
                    errormsg: '你必须设定手机号之后才能使用此项功能．'
                });
            mutil.renderInfo(res, "你必须验证手机号之后才能使用此项功能．请点<a class='btn btn-primary btn-lg' href='/requestMobileVerify'>这里</a>验证.");
        }
    });
}


function needSuperUser(req, res, then) {
    needLogin(req, res, function (req, res) {

        console.log("req.client.username="+req.client.username) ;
//        if(req.client.isAdmin)
        if('tom'== req.client.username
            //||'weir'== req.client.username
            || req.admin)
            then(req, res);
        else {
            setLastFailedRUL(req, res);
            //        req._avos_session.lastFailedURL = req.url;
            mutil.renderError(res, "超级用户才能使用此项功能．");
        }
    });
}

function notLogin(req, res) {
    var isloggedIn = isLogin(req);
    if(!isloggedIn){
//        req._avos_session.lastFailedURL = req.url;
        res.cookie('lastFailedURL', req.originalUrl||req.url, { maxAge: 3000000 });
    }
    return !isloggedIn;
}


function needLogin(req, res, then) {
    var isloggedIn = isLogin(req);
    if(isloggedIn)
        then(req, res);
    else {
        console.log("user not logged in, redirect to login page!") ;
        setLastFailedRUL(req, res);
        res.redirect('/login?info=needLogin&from=cordova');
    }
}

exports.findClient = findClient;
exports.anonymousToken = anonymousToken;
exports.anonymousCid = anonymousCid;
exports.isLogin = isLogin;
exports.isAdmin = isAdmin;
exports.renderEmailVerify = renderEmailVerify;
exports.renderMobileVerify = renderMobileVerify;
exports.needLogin = needLogin;
exports.needVerifiedMobie = needVerifiedMobie;
exports.needSuperUser = needSuperUser;
exports.getLastFailedURL = getLastFailedURL;
exports.notLogin = notLogin;