/**
 * Created by lzw on 14-8-8.
 */
var AV = require('leanengine');
var util = require('util');
var mlog=require('./mlog.js');

var AV = require('leanengine');
var mutil = require('./mutil.js');
var nutil = require('./nutil.js');
var madmin = require('./madmin.js');
var _ = require('underscore');


var ejsTemplates = [];
var siteParameter;
var groups = [];
var cities = [];
var citiesByName = [];
var city = [];

var staticVals = {};


function callDianPingWithLocation(latitude, longitude, cb) {
    var param = {};
    param["category"] =
        "美食";
    param["limit"] = "2";
    param["latitude"] = latitude;
    param["longitude"] = longitude;
   callDianPingThen(param, 'find_businesses', function (httpResponse) {
            console.log(
                    'got dianping response text  ' + httpResponse.text + ' for param ' + param);
            console.log('got dianping response data  ' + httpResponse.data + ' for latitude ' + param["latitude"] + ' and longitude ' + param["longitude"]);
            if(cb)
                cb(httpResponse.data);
        }, mutil.logErrorFn());
}

function callDianPingThen(param,action, cb, ecb) {
    var appkey = "052750407";
    var secret = "8d2d4efa9cbb457ca8c45a9375ab0951";
//            param["sort"]="7";
    // 对参数名进行字典排序
    var array = new Array();
    for (var key in param) {
        array.push(key);
    }
    array.sort();

    // 拼接有序的参数名-值串
    var paramArray = new Array();
    paramArray.push(appkey);
    for (var index in array) {
        var key = array[index];
        paramArray.push(key + param[key]);
    }
    paramArray.push(secret);
    // SHA-1编码，并转换成大写，即可获得签名
    var shaSource = paramArray.join("");
    var jsSHA = require('jssha');
    var shaObj = new jsSHA(shaSource, 'TEXT');
    var sign = shaObj.getHash('SHA-1', 'HEX');
    var url = 'http://api.dianping.com/v1/business/'+action+'?appkey=' + appkey + '&sign=' + sign;
    for (var key in param) {
        url+='&'+key+'=' + encodeURI(param[key]) ;
    }
//    var url = 'http://api.dianping.com/v1/business/find_businesses?appkey=' + appkey + '&sign=' + sign + '&city=' + encodeURI(param["city"]) + '&keyword=' + encodeURI(param["keyword"]) + '';
//            var url =  'http://api.dianping.com/v1/business/find_businesses?appkey='+appkey+'&sign='+sign+'&city=%E4%B8%8A%E6%B5%B7&keyword='+param["keyword"];
    console.log('to call dianping api from ::::::: ' + url);
    AV.Cloud.httpRequest({
        url: url,
        headers: {
            'Content-Type': 'application/json'
        },
        success: function (httpResponse) {
            cb(httpResponse);
        },
        error: ecb
    });
}

function initAdminsThen(callback) {
    madmin.findAdmins().then(function (admins) {
        staticVals.Admins =  nutil.AVObjs2JsonObjs(_.pluck(admins, 'user'));
        callback(staticVals.Admins);
    });
}

function initSiteTemplate() {
    var query = new AV.Query('EjsTemplates');
    query.find().then(function (temps) {
        temps = temps || [];
        _.each(temps, function(template){
            ejsTemplates[template.get('name')] = template.get('content');
        });
    });
}

var sitepara = {
    "logoTitle": "匠心咖啡创业资源对接平台",
    "aboutUs": "匠心咖啡是一个圈子",
    "ACL": {
        "*": {
            "write": true,
            "read": true
        }
    },
    "sloganTitle": "彪悍的人生，不需要解释。",
    "createdAt": "2016-07-25T09:36:52.602Z",
    "updatedAt": "2017-07-17T16:28:44.270Z"
};

function initSiteParameter() {
    var query = new AV.Query('siteParameter');
    query.find().then(function (sps) {
        console.log('sps.length :'+ sps.length );
        if(sps.length == 0){
            var sp = nutil.JsonObj2AVObj(sitepara, 'siteParameter');
            sp.save().then(function (ssitem) {
                throw new Error("siteParameter must be initialed in Database!");
            }, mutil.logErrorFn());
        }else
            staticVals.siteParameter = nutil.AVObj2JsonObj(sps[0]);
    }, function (error) {
        console.log('error :'+ error );
        mutil.logError(error);
        throw new Error("siteParameter must be initialed in Database!");
    });
}

function getSiteParameter() {
    return staticVals.siteParameter;
}

function initGroups() {
    var query = new AV.Query('Group');
    query.find().then(function (gs) {
        groups = gs;
    });
}

function getGroups() {
    return groups;
}

function initCities() {
    var query = new AV.Query('DianPing');
    query.first().then(function (dp) {
        cities = dp.get('cities');
        _.each(cities, function(city){
            citiesByName[city.city_name] = city;
        });
        city = dp.get('city');
    });
}

function getCities(start, end) {
    if(end){
        return cities.slice(start,end);
    }
    return cities;
}

function getAdminsThen(callBack) {
    if(!staticVals.Admins){
        initAdminsThen(callBack);
    }
    callBack(staticVals.Admins);
}

function initAdmins() {
    madmin.findAdmins().then(function (admins) {
        console.log('admins.length :'+ admins.length );
        if(admins.length == 0){
                throw new Error("Admin must be initialed in Database!");
        }else
            staticVals.Admins =  nutil.AVObjs2JsonObjs(_.pluck( nutil.AVObjs2JsonObjs(admins), 'user'));
    }, mutil.logErrorFn());
}
function getAdmins() {
   return staticVals.Admins;
}

function getCityByName(name) {
    return citiesByName[name];
}

function getCity() {
    return city;
}


function getEjsTemplates(name) {
    return ejsTemplates[name];
}

function completePercent(room){
    if(room.get('completed')){
        var fin = room.className == 'Room'?5:3;
        return ((room.get('completed')/fin)*100%10)*10;
    }else
        return room.get('isOK')?100:50;
}


function headImg(user){
    if(user.sex){
        return user.headimgurl||'/images/noimg'+user.sex+'.jpg';
    }else if(user.get&&user.get('sex')){
        return user.get('headimgurl')||'/images/noimg'+user.get('sex')+'.jpg';
    }else{
        return user.headimgurl||'/images/noimg1.jpg';
    }
}

exports.headImg=headImg;
exports.completePercent=completePercent;
exports.cities=cities;
exports.getEjsTemplates=getEjsTemplates;
exports.initSiteTemplate=initSiteTemplate;
exports.initCities=initCities;
exports.getCities=getCities;
exports.getAdminsThen=getAdminsThen;
exports.getAdmins=getAdmins;
exports.getGroups=getGroups;
exports.getCity=getCity;
exports.getCityByName=getCityByName;
exports.callDianPingThen=callDianPingThen;
exports.callDianPingWithLocation=callDianPingWithLocation;
exports.initSiteParameter=initSiteParameter;
exports.getSiteParameter=getSiteParameter;
exports.initAdmins=initAdmins;