
var AV = require('leanengine');
var util = require('util');
var mlog = require('./mlog.js');
var moment = require('moment');
var crypto = require('crypto');
var _ = require('underscore');
var _s = require('underscore.string');
var fs = require('fs');
var https = require("https");

const MillSecondsOfOneDay = 1000 * 60 * 60 * 24;

function isProduction() {
   return  process.env.LEANCLOUD_APP_ENV == 'production';
}

function doErr(err) {
  console.log(err);
}

function renderWithLayout(app, layout, func) {
    if(layout){
        var olayout = app.get('layout');
        app.set('layout', layout);
        func();
        app.set('layout', olayout);
    }else
        func();
}

function renderInfo(res, info, backLink, redirectUrl) {
    res.render('info', {info: info, backLink: backLink, redirectUrl: redirectUrl, barTitle:'提示'});
}

function inspectError(error) {
    var _error = error;
    if (error == null) {
        _error = "Unknown error";
    }
    if (typeof error != 'string') {
        _error = util.inspect(error);
        if (error.stack && process.env.LEANCLOUD_APP_ENV!='production') {
            _error += ' stack=' + error.stack;
        }
    }
    return _error;
}

function renderError(res, error) {
    var _error = inspectError(error);
    res.render('500', {error: _error});
}

function sendError(res, error) {
    var _error = inspectError(error);
    res.send( {error: _error});
}
function sendErrorFn(res) {
    return function (err) {
        sendError(res, err);
    };
}

function renderErrorFn(res, msg) {
  return function (err) {
    console.error(msg, err);
    renderError(res, err);
  };
}

function rejectFn(promise) {
  return function (error) {
    promise.reject(error);
  }
}

function logErrorFn(msg) {
  return function (err) {
    console.error(msg, err);
    mlog.logError(err);
  }
}

function logError(err) {
    mlog.logError(err);
}

function renderForbidden(res) {
  mlog.log('render forbidden');
  renderError(res, "Forbidden area.");
}

var failResponse = function (res, msg, error) {
    var sjsonA = msg ;
    if(error&&error.message)
        sjsonA += error.message;
    console.log('eeeeeeeeeeeeeeeeeeeeeeeee '+sjsonA);
    res.send(sjsonA);
};

function findOne(clzName, modifyQueryFn) {
  var Clz = new AV.Object.extend(clzName);
  var q = new AV.Query(Clz);
  if (modifyQueryFn) {
    modifyQueryFn(q);
  }
  return q.first();
}


function count(clzName, modifyQueryFn) {
    var Clz = new AV.Object.extend(clzName);
    var q = new AV.Query(Clz);
    if (modifyQueryFn) {
        modifyQueryFn(q);
    }
    return q.count();
}

function findAll(clzName, modifyQueryFn) {
  var q = new AV.Query(clzName);
  var res = [];
  var p = new AV.Promise();
  if (modifyQueryFn) {
    modifyQueryFn(q);
  }
  q.count({
      success: function (cnt) {
        var t = (cnt + 999) / 1000;  //I'm so clever!
        t = Math.floor(t);  //But...
        var promises = [];
        for (var i = 0; i < t; i++) {
          var skip = i * 1000;
          var q = new AV.Query(clzName);
          q.descending('updatedAt');
          q.limit(1000);
          if (modifyQueryFn) {
            modifyQueryFn(q);
          }
          q.skip(skip);
          promises.push(q.find({
            success: function (lines) {
              res = res.concat(lines);
              return AV.Promise.as(res);
            }
          }));
        }
        AV.Promise.when(promises).then(function () {
          p.resolve(res);
        }, rejectFn(p));
      },
      error: rejectFn(p)
    }
  );
  return p;
}

function testFn(fn, res) {
  fn.call(this).then(function () {
    res.send('ok');
  }, mutil.renderErrorFn(res));
}


function isToday(date) {
    //console.log('isToday '+date+':'+moment(date).isSame(new Date(), 'day'));
    //console.log('isToday '+date+':'+moment(date).isSame(new Date(), 'day'));
    return  date&&moment(date).isSame(moment(), 'day');
//    return  date&&moment(date).isSame(new Date(), 'day');
//    return  date&&moment(date).tz('Asia/Shanghai').isSame(new Date(), 'day');
}

function calDaysBeforeDate(date) {
    var now = new Date();
    return (date.getTime() - now.getTime())/MillSecondsOfOneDay%1 ;
}


function calDaysAfterDate(date) {
    var now = new Date();
    return Math.round((now.getTime() - date.getTime())/MillSecondsOfOneDay) ;
}

function calDateBeforeDays(days) {
  var now = moment().subtract(days, 'day');
  now.hour(0);
  now.minute(0);
  now.second(0);
  return now.toDate();
}

function calDateFromDateByDays(date, days) {
  var date = new moment(date);
  date.subtract(days, 'day');
  return date.toDate();
}

function durationQueryFn(field, startDate, endDate) {
  return function (q) {
    q.greaterThan(field, startDate);
    q.lessThan(field, endDate);
  };
}

function updatedAtDurationQueryFn(startDate, endDate) {
  return durationQueryFn('updatedAt', startDate, endDate);
}

function createdAtDurationQueryFn(startDate, endDate) {
  return durationQueryFn('createdAt', startDate, endDate);
}

function encrypt(s) {
  var md5 = crypto.createHash('md5');
  md5.update(s);
  return md5.digest('hex');
}

function cloudErrorFn(response) {
  return function (error) {
    console.log('cloudError '+error.message);
    response.error(error.message);
  };
}

//Be careful when using , never use it in embed loops on the array
function remove(array, element) {
    var idx = _.indexOf(array, element);
    if(idx>=0){
        array.splice(idx, 1);
        return true;
    }
    return false;
}


function getHTMLTemplate(res, view) {
    return fs.readFileSync(res.__proto__.app.get('views')+'/'+view+'.ejs' , 'utf8');
}

function copyAVObjFields(sourceObj, destObj) {
    _.each(sourceObj.attributes, function(value, key){
        destObj.set(key, value);
    })
}


function uniqueSave(avo, fieldnnames, cb, ncb, ecb) {
    var query = new AV.Query(avo.className);
    _.each(fieldnnames, function(fieldnname){
        query.equalTo(fieldnname, avo.get(fieldnname));
        if(avo.get(fieldnname) && avo.get(fieldnname).id)
            query.include(fieldnname);
    });
    query.find().then(function (groups) {
        if(groups&&groups.length>0){
            if(ncb)
                ncb(groups);
        }else{
            avo.save().then(cb, ecb);
        }
    }, function (err) {
        console.error('you may need to create table '+avo.className+'firstly!', err);
    });
}


function checkExist(avo, fieldnnames, ecb, ncb, errorcb) {
    var query = new AV.Query(avo.className);
    _.each(fieldnnames, function(fieldnname){
        query.equalTo(fieldnname, avo.get(fieldnname));
        if(avo.get(fieldnname) && avo.get(fieldnname).id)
            query.include(fieldnname);
    });
    query.find().then(function (groups) {
        if(groups&&groups.length>0){
            if(ecb)
                ecb(groups);
        }else{
            if(ncb)
                ncb();
        }
    }, function (err) {
        console.error('you may need to create table '+avo.className+'firstly!', err);
        if(errorcb)
            errorcb();
    });
}



function saveFile(res, fname, data, f) {
    var theFile = new AV.File(fname, data);
    theFile.save().then(function (theFile) {
        f(theFile);
    }, function (err) {
        renderError(res, err);
    });
}

function saveFilesThen(req, res, iconFile, f) {
    if (!req.files) {
        f(null);
        return;
    }
    if (iconFile && iconFile.name !== '') {
        fs.readFile(iconFile.path, function (err, data) {
            if (err) {
                return renderError(res, err);
            }
            //var base64Data = data.toString('base64');
            var theFile = new AV.File(iconFile.name, data);
            theFile.save().then(function (theFile) {
                f(theFile, data);
                fs.unlink(iconFile.path,function(err){
                    if(err) return console.error(err);
                    console.log('file deleted successfully');
                });
            }, function (err) {
                renderError(res, err);
            });
        });
    } else {
        f(null);
    }
}


function getNonNullValue(item, fieldName, defaultValue) {
    if(!(item && item.get(fieldName))){ return defaultValue||'';}
    return item.get(fieldName);
}

function getNonNullDataFValue(item, fieldName, defaultValue) {
    if(!(item && item.get('dataf')&& item.get('dataf').get(fieldName))){ return defaultValue||'';}
    return item.get('dataf').get(fieldName);
}

function getNonNullSelectValue(item, fieldName, value) {
    if(!(item && item.get(fieldName))){ return '';}
    return  item.get(fieldName) == value?'selected':'';
}

function getNonNullFile(item, fieldName) {
    if(!(item && item.get(fieldName))){ return '';}
    return picUrl(item,fieldName);
}

function getNonNullArrayValue(item, fieldName) {
    if(!(item && item.get(fieldName))){ return '';}
    var completedTag = '';
    var tag = item.get(fieldName);
    for (var i = 0; i < tag.length; i++) {
        if(i>0)
            completedTag += ' ';
        completedTag +=  tag[i];
    }
    return completedTag;
}


function picUrl(obj, columnName) {
    var pic = obj.get(columnName);
    if (pic) {
        return pic.url();
//        return '<p><a href="' + pic.url() + '" target="_blank" title="查看附件"><img src="' + pic.url() + '" width="100" height="100"></a></p>';
    }
    return null;
}
//end tom added

function populatePicsForAll(objs, picName) {
    var promise = new AV.Promise();
    _.each(objs, function(obj){
//        promise = promise.then(function() {
//            populatePics(obj, picName);
//        });
        promise = populatePics(obj, picName);
    });
    return promise;
}

function populatePics(obj, picName) {
    var p = new AV.Promise();
    var pics = obj.get(picName);
    pics = pics?pics:[];
    var q = new AV.Query("_File");
    q.containedIn('objectId', pics);
    p = q.find().then(function (files) {
        var pfiles = pfiles?pfiles:[];
        pfiles = _.map(files, function(pic) {
            return pic.get('url');
        });
        eval('obj.'+picName+'= pfiles');
    },function (object, error) {
        console.error(error.messag);
    });
    return p;
}

//统计平均时间显示格式
function transformTime(averagetime) {
    var result = '';
    //ms -> s
    averagetime = averagetime / 1000;
    if (averagetime > 60) {
        //ms -> s
        averagetime = averagetime / 60;
        if (averagetime > 60) {
            var hour = averagetime / 60;
            averagetime = averagetime % 60;
            result = hour.toFixed(0) + ' 小时 ' + averagetime.toFixed(0) + ' 分钟';
        } else {
            result = averagetime.toFixed(0) + ' 分钟';
        }
    } else {
        result = averagetime.toFixed(0) + ' 秒';
    }
    return result;
}


function formatDate(t) {
    var date = moment(t).fromNow();
    var cleanDate = '<span class="form-cell-date">' + moment(t).format('YYYY-MM-DD') + '</span> ';
    return date;
}

function formatTimeMinute(t) {
    var date = moment(t).fromNow();
    var cleanDate = '<span class="form-cell-date">' + moment(t).format('MM-DD') + '</span> <span class="form-cell-time">' + moment(t).format('HH:mm') + '</span>';
    return date;
}

function formatTimeHourRaw(t) {
    var date = moment(t).format('YYYY-MM-DD HH点');
    return date;
}

function formatTimeMinute(t) {
    return moment(t).format('M[月]D[日]') + ' ' + moment(t).format('H[:]mm');
}

function formatTime(t) {
    var date = moment(t).fromNow();
    var cleanDate = '<span class="form-cell-date">' + moment(t).format('YYYY-MM-DD') + '</span> <span class="form-cell-time">' + moment(t).format('HH:mm:ss') + '</span>';
    return date;
}

function formatTimeLong(t) {
    var date = moment(t).format('YYYY-MM-DD HH:mm:ss');
//    var date = moment(t).utc().format('YYYY-MM-DD HH:mm:ss');
    return date;
}

function formTag(item, tagsFieldName) {
    var tName = tagsFieldName?tagsFieldName:'tags';
    var tag = [];
    var completedTag = '';
    if (item&&item.get(tName)){
        tag = item.get(tName);
        for (var i = 0; i < tag.length; i++) {
            if(i>0)
                completedTag += ' ';
            completedTag +=  tag[i];
        }
    }
    return completedTag;
}

function getAbbr(text, length) {
    if(text&&text.length>length+2)
        return text.substring(0, length)+'...';
    return text;
}


function scriptSafe(text) {
    if(text){
        var result = text.replace(/\r\n/g, "");
        result = result.replace(/\n/g, "");
        return result;
    }
    return text;
}

function getRootUrl(req) {
    return req.protocol + '://' + req.get('host');
}
function getFullUrl(req) {
//    console.log('req.get(host) ::::::: ' + req.get('host') );
//    console.log('req.originalUrl ::::::: ' + req.originalUrl );
    console.log('req.url ::::::: ' + req.url );
//    console.log('_parsedUrl.path ::::::: ' + req._parsedUrl.path );
//    console.log('_parsedUrl.href ::::::: ' + req._parsedUrl.href );
    return  getRootUrl(req) + req.url;
}


function getResizedPicURL(pic, options) {
    var picUrl = options.default||'/images/bg.jpg';
    if(pic)
        picUrl = pic.url?pic.url():pic;
    if (options.w || options.h || options.q || options.fmt|| options.m) {

        var width = options.w || 1000;
        var height = options.h || 1000;
        var quality = options.q || 100;
        var fmt = options.fmt || 'jpg';
        var mode = options.m || 2;
        picUrl = picUrl + '?imageView/' + mode + '/w/' + width + '/h/' + height
            + '/q/' + quality + '/format/' + fmt;
    }
    return picUrl;
}

function getFirstPhotoURL(group, width, height, quality, fmt) {
    var picUrl = '/images/office-s.jpg';
//    var pics = group.get('photos');
    var pics = group.get('photosUrl');
    var photos = pics?pics:[];
    if(photos.length>0){
//        return photos[0].get('url');
        picUrl =  photos[0];
        picUrl = getResizedPicURL(width, height, quality, fmt, picUrl);
    }
    return picUrl;
}


function getPhotoURLs(group, width, height, quality, fmt) {
    var pics = group.get('photosUrl');
    var photos = pics?pics:[];
    photos = _.map(photos, function (picUrl) {
        return getResizedPicURL(picUrl, {w:width, h:height, fmt:fmt, q:quality});
    });
    return photos;
}

function pushToAll(data)   {
    var query = new AV.Query('_Installation');
    query.find().then(function (groups) {
        groups = groups || [];
        _.each(groups, function (group) {
            AV.Push.send({
                cql: "select * from _Installation where installationId='"+group.get('installationId')+"'",
                data: data
            });
        });
    });
}


function randomFromCollections(groups, num)   {
    return  _.sample(groups, num);
}



function paginate(skip, limit, actuallength) {
    var back = -1;
    var next = -1;
    if (!skip) {
        skip = 0;
    }
    if (parseInt(skip) > 0) {
        back = parseInt(skip) - parseInt(limit);
    }
    if (actuallength == limit) {
        next = parseInt(skip) + parseInt(limit);
    }
    return {back: back, next: next};
}

function retrieveHttpFileThen(fname, url, then, ecallback) {
    if(!url){
        console.error( 'wrong url:'+url);
        then(null);
    }

    var imgurl = _s.strRight(url, "://");
    console.log( 'imgurl:'+imgurl);
    var host = _s.strLeft(imgurl, "/");
    console.log( 'host:'+host);
    //var path = _s.strRight(imgurl, "/");
    var path = url;
    //var fname = _s.strRightBack(imgurl, "/");

    var http = require('http');
    // var hostname = 'imgsrc.baidu.com';
    //var path = figureObj.bdbkSummaryImgUrl[0].replace('http://'+hostname, '');
    console.log( 'path:'+path);
    //path = '/baike/pic/item/eaf81a4c510fd9f9225839e7252dd42a2934a4f5.jpg';
    http.get({
        hostname: host,
        port: 80,
        path: path,
        agent: false  // create a new agent just for this one request
    }, function (res) {
        res.setEncoding('binary')
        var str = '';
        res.on('data', function(d) {
            str += d;
            //console.log( d);
        });
        res.on('end', function () {

            //console.log(str);
            fs.writeFile('upload/'+fname, str, 'binary', function(err){
                if (err){
                    console.error(err);
                    if(ecallback)
                        ecallback(err);
                }
                console.log('File saved with name:'+fname);
                fs.readFile('upload/'+fname, function (err, data) {
                    if (err) {
                        console.error(err);
                    }
                    //var base64Data = data.toString('base64');
                    var theFile = new AV.File(fname, data);
                    theFile.save().then(function (theFile) {
                        then(theFile);
                    }, logErrorFn());
                });
            });
        });

    });
}


function getHttpsThen(host, path, params, then, eFunc) {
    var options = {
        host: host,
        port: 443,
        path: path,
        method: 'GET',
        headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Encoding': 'utf-8',
//                'Accept-Encoding': 'gzip, deflate',
            'Accept-Language': 'zh-CN,zh;q=0.8,en-US;q=0.5,en;q=0.3',
            'Connection': 'keep-alive',
            'Host': host,
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:41.0) Gecko/20100101 Firefox/41.0'
        }
    };
    if(params)
        options.params = params;

    var str = '';
    var req = https.request(options, function(response) {
        // console.log("statusCode: ", response.statusCode);
        // console.log("headers: ", response.headers);
        response.on('data', function(d) {
            str += d;
            //process.stdout.write(d);
        });
        response.on('end', function () {
            // console.log( str);
            then(str);
        });
    });
    req.end();

    req.on('error', function(e) {
        console.error(e);
    });
}

function postHttpsThen(host, path, headers, body, then, eFunc) {
    var options = {
        host: host,
        port: 443,
        path: path,
        method: 'POST',
        headers: {
            // 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            // 'Accept-Encoding': 'utf-8',
            // 'Accept-Language': 'zh-CN,zh;q=0.8,en-US;q=0.5,en;q=0.3',
            // 'Connection': 'keep-alive',
            'Host': host,
            // 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:41.0) Gecko/20100101 Firefox/41.0'
        }
    };
    if(headers)
        options.headers = _.assign(options.headers, headers);
    if(body)
        options.data = body;

    var str = '';
    var req = https.request(options, function(response) {
        // console.log("statusCode: ", response.statusCode);
        // console.log("headers: ", response.headers);
        response.on('data', function(d) {
            str += d;
            //process.stdout.write(d);
        });
        response.on('end', function () {
            // console.log( str);
            then(str);
        });
    });
    req.end();

    req.on('error', function(e) {
        console.error(e);
    });
}


function postHttpThen(options, header, callbackFunc, eFunc, timeoutFunc) {
    console.log('send http post request to '+options.addr.host+':'+options.addr.port);
    var addr = options.addr;
    var path = options.path;
    var data = options.data;
    var post_data = typeof(data)=='string'?data:querystring.stringify(data);
    var post_options = {
        host: addr.host,
        port: addr.port,
        path: path,
        method: 'POST',
        headers: header
    };
    var str = '';

    var post_req = http.request(post_options, function(res) {
        res.setEncoding('utf8');
        res.on('data', function(d) {
            str += d;
            //process.stdout.write(d);
        });
        res.on('end', function () {
            console.log( str);
            callbackFunc(str);
        });
    });

    post_req.on('error', function(e) {
        console.error(e);
        eFunc(e);
    });

    post_req.setTimeout(options.timeout || 10000, timeoutFunc);

    // post the data
    post_req.write(post_data);
    post_req.end();

}


function populateFiles(picFiles, picUrls) {
    var promise = AV.Promise.as();
    _.each(picFiles, function(picFile, index) {
        promise = promise.then(function () {
            return populateOneFile(picFile, index, picUrls);
        });
    });
    return promise;
}

function populateOneFile(picFile, index, picUrls) {
    var p = new AV.Promise();
    var q = new AV.Query("_File");
    q.get(picFile.id).then(function (file) {
        var url = file.get('url');
        picUrls[index] = url;
        p.resolve();
    },function (object, error) {
        logError(error);
        p.resolve();
    });
    return p;
}

function sendEJSResult(res, path, obj, extending) {
    var userHtml = fs.readFileSync(res.__proto__.app.get('views') + path, 'utf8');
    var result = ejs.render(userHtml, obj);
    var obj = {
        passed: true,
        html: result
    };
    if(extending)
        obj = _.extend(extending,obj);
    res.send(obj);
}

function getObjectThen(clzName, itemId, execFunc, errorFunc, modifyQueryFn) {
    var Clz = new AV.Object.extend(clzName);
    var q = new AV.Query(Clz);
    if (modifyQueryFn) {
        modifyQueryFn(q);
    }
    q.get(itemId, {
        success: execFunc,
        error: errorFunc
    });
}


var addMsgToError = function (msg, error) {
    if(error&&error.message)
        error.message = msg+error.message;
    else if(error&&error.msg)
        error.msg = msg+error.msg;
    else if(error)
        error = msg + error;
    else
        error = msg;
    console.error(error);
    return error;
};

var addMsgToErrorFn = function (msg) {
    return function (error) {
        addMsgToError(msg, error);
    };
};

exports.retrieveHttpFileThen=retrieveHttpFileThen;
exports.doErr=doErr;
exports.renderErrorFn=renderErrorFn;
exports.renderError=renderError;
exports.sendError=sendError;
exports.sendErrorFn=sendErrorFn;
exports.rejectFn=rejectFn;
exports.renderForbidden=renderForbidden;
exports.logErrorFn=logErrorFn;
exports.logError = logError;
exports.renderInfo=renderInfo;
exports.failResponse=failResponse;
exports.saveFile=saveFile;
exports.saveFilesThen=saveFilesThen;
exports.getNonNullValue=getNonNullValue;
exports.getNonNullDataFValue=getNonNullDataFValue;
exports.getNonNullSelectValue=getNonNullSelectValue;
exports.getNonNullFile=getNonNullFile;
exports.getNonNullArrayValue=getNonNullArrayValue;
exports.picUrl=picUrl;
exports.transformTime=transformTime;
exports.formatDate=formatDate;
exports.formatTimeMinute=formatTimeMinute;
exports.formatTimeHourRaw=formatTimeHourRaw;
exports.formatTime=formatTime;
exports.formatTimeMinute=formatTimeMinute;
exports.formatTimeLong=formatTimeLong;
exports.formTag=formTag;
exports.getRootUrl=getRootUrl;
exports.getFullUrl=getFullUrl;
exports.populatePics=populatePics;
exports.populatePicsForAll=populatePicsForAll;
exports.getResizedPicURL=getResizedPicURL;
exports.pushToAll=pushToAll;
exports.getFirstPhotoURL=getFirstPhotoURL;
exports.getPhotoURLs=getPhotoURLs;
exports.uniqueSave=uniqueSave;
exports.checkExist=checkExist;
exports.copyAVObjFields=copyAVObjFields;
exports.getAbbr=getAbbr;
exports.scriptSafe=scriptSafe;
exports.getHTMLTemplate=getHTMLTemplate;
exports.renderWithLayout=renderWithLayout;

exports.isProduction=isProduction;
exports.findAll = findAll;
exports.findOne = findOne;
exports.count = count;
exports.testFn = testFn;
exports.isToday = isToday;
exports.calDateBeforeDays = calDateBeforeDays;
exports.updatedAtDurationQueryFn = updatedAtDurationQueryFn;
exports.calDaysBeforeDate = calDaysBeforeDate;
exports.calDaysAfterDate = calDaysAfterDate;
exports.calDateFromDateByDays = calDateFromDateByDays;
exports.createdAtDurationQueryFn = createdAtDurationQueryFn;
exports.encrypt = encrypt;
exports.cloudErrorFn = cloudErrorFn;
exports.remove=remove;
exports.paginate=paginate;
exports.randomFromCollections=randomFromCollections;

exports.getObjectThen = getObjectThen;
exports.getHttpsThen = getHttpsThen;
exports.postHttpsThen = postHttpsThen;
exports.postHttpThen = postHttpThen;
exports.populateFiles=populateFiles;
exports.sendEJSResult=sendEJSResult;
exports.addMsgToError=addMsgToError;
exports.addMsgToErrorFn = addMsgToErrorFn;