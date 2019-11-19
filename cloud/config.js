/**
 * Created by tom.li on 19-11-19.
 */
//express用做加密token的salt，自己申请应用搭建时，可稍微更改字符串，可以更安全
exports.cookieParserSalt="dsajwlajgepppwe3032ssd";


//注册后，是否需要通过邮件验证才可以使用
exports.needEmailVerify = false;

exports.needMobieVerifyWhenReg = true;
exports.needMobieVerifyAfterReg = false;

exports.siteName = "OA小工具";
exports.siteDesc = "Tom's OA tool using NLP";