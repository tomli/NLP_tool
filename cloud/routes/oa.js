var login = require('../login.js');
var config = require('../../hw_config.js');
var nlp = require("../../actions/nlp");
var token = require("../../hw-sdk/gettoken");


exports = module.exports = function(router) {


    router.get('/', function (req, res) {
        if (login.isLogin(req)) {
        res.render('oa/new');
         } else {
                res.redirect('/login');
         // res.redirect('/kf/login');
         }
    });


    router.post('/oa', function(req, res) {
        var title = req.body.title;
        var text = req.body.text;
        token.getToken(config.hw_username, config.hw_domain_name, config.hw_password, function (token) {

            nlp.summary_extract(token, text, function (result) {
                res.render('oa/result', {result: result});
            })

        });
    });



}