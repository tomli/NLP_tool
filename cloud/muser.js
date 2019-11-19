/**
 * Created by lzw on 14-9-29.
 */
var AV = require('leanengine');
var mutil = require('./mutil');
var mlog = require('./mlog');
var _ = require('underscore');
var _s = require('underscore.string');
var Avatar = AV.Object.extend('Avatar');

function findUserById(userId, queryFn) {
  var q = new AV.Query('_User');
  if (queryFn) {
    queryFn(q);
  }
  return q.get(userId);
}

function findUser(modifyQueryFn) {
  return mutil.findOne('_User', modifyQueryFn);
}

function findUserByName(name) {
  return findUser(function (q) {
    q.equalTo('username', name);
  });
}

function findUsernameById(id) {
  var p = new AV.Promise();
  findUserById(id).then(function (user) {
    p.resolve(user.get('username'));
  }, function (error) {
    console.log(error.message);
    p.resolve();
  });
  return p;
}

function findUsers(userIds) {
  var q = new AV.Query('_User');
  q.containedIn('objectId', userIds);
  q.include('setting');
  return q.find();
}

function findAllUsers(modifyQueryFn) {
  return mutil.findAll('_User', modifyQueryFn);
}

function findFriends(name) {
  var p = new AV.Promise();
  findUserByName(name).then(function (user) {
    user.relation('friends').query().find().then(function (results) {
      p.resolve(results);
    }, mutil.rejectFn(p));
  }, mutil.rejectFn(p));
  return p;
}

function addFriend(user, friend) {
  var friends = user.relation('friends');
  friends.add(friend);
  return user.save();
}

function removeFriend(user, friend) {
  var friends = user.relation('friends');
  friends.remove(friend);
  return user.save();
}

function findBothUser(fromUserId, toUserId) {
  var p = new AV.Promise();
  findUserById(fromUserId).then(function (fromUser) {
    mlog.log('fromUser found');
    findUserById(toUserId).then(function (toUser) {
      mlog.log('find user and resolve');
      p.resolve(fromUser, toUser);
    }, mutil.rejectFn(p));
  }, mutil.rejectFn(p));
  return p;
}

function doRelationForBoth(fromUserId, toUserId, relationFn) {
  var p = new AV.Promise();
  mlog.log('doRelationForBoth');
  findBothUser(fromUserId, toUserId).then(function (fromUser, toUser) {
    mlog.log('find users');
    relationFn(fromUser, toUser).then(function () {
      mlog.log('relationFn once');
      relationFn(toUser, fromUser).then(function () {
        p.resolve();
      }, mutil.rejectFn(p))
    }, mutil.rejectFn(p));
  }, mutil.rejectFn(p));
  return p;
}

function addFriendForBoth(fromUserId, toUserId) {
  return doRelationForBoth(fromUserId, toUserId, addFriend);
}

function removeFriendForBoth(fromUserId, toUserId) {
  return doRelationForBoth(fromUserId, toUserId, removeFriend);
}

function countAvatars() {
  var q = new AV.Query(Avatar);
  return q.count();
}

function findRandomAvatar() {
  var p = new AV.Promise();
  countAvatars().then(function (count) {
    if (count > 0) {
      var i = Math.floor(Math.random() * count);
      var q = new AV.Query(Avatar);
      q.skip(i);
      q.limit(1);
      q.ascending('createdAt');
      q.first().then(function (avatar) {
        p.resolve(avatar);
      }, mutil.rejectFn(p));
    } else {
      p.resolve(null);
    }
  }, function (error) {
    if (error.code == 101) {
      p.resolve(null);
    } else {
      p.reject(error);
    }
  });
  return p;
}

function beforeSaveUser(req, res) {
  var user = req.object;
  if (user.get('avatar') == null) {
    findRandomAvatar().then(function (avatar) {
      if (avatar != null) {
        user.set('avatar', avatar.get('file'));
      }
      res.success();
    }, mutil.cloudErrorFn(res));
  } else {
    res.success();
  }
}

function handleRelationRequest(req, res, handleRelationFn) {
  var params = req.params;
  var fromUserId = params.fromUserId;
  var toUserId = params.toUserId;
  handleRelationFn(fromUserId, toUserId).then(function () {
    res.success();
  }, mutil.cloudErrorFn(res));
}

function handleRemoveFriend(req, res) {
  handleRelationRequest(req, res, removeFriendForBoth);
}

function handleAddFriend(req, res) {
  handleRelationRequest(req, res, addFriendForBoth);
}

function convertRelation() {
  var p = new AV.Promise();
  mutil.findAll('_User', function (q) {
    q.include('friends');
  }).then(function (users) {
    var outPs = [];
    _.each(users, function (user) {
      var outP = user.relation('friends').query().find().then(function (friends) {
        var inPs = [];
        _.each(friends, function (friend) {
          inPs.push(user.follow(friend.id));
        });
        return AV.Promise.when(inPs);
      });
      outPs.push(outP);
    });
    AV.Promise.when(outPs).then(function(){
      p.resolve();
    },function(error){
      p.resolve();
    })
  });
  return p;
}

function convert(req,res){
  var p=convertRelation();
  p.then(function(){
    res.success();
  })
}


function transfromUser(curUser) {
    return {
        username:_s.startsWith(curUser.get('username'), 'wxuser_')?'未设定':curUser.get('username'),
        id:curUser.id,
        nickname:curUser.get('nickname'),
        email:curUser.get('email'),
        headimgurl:curUser.get('headimgurl')?curUser.get('headimgurl'):'/images/noimg.jpg',
        unionid:curUser.get('unionid'),
        country:curUser.get('country'),
        city:curUser.get('city'),
        openids:curUser.get('openids'),
        province:curUser.get('province'),
        twoDcode:mutil.picUrl(curUser, 'twoDcode'),
        sex:curUser.get('sex'),
        token:curUser.get('sessionToken'),
        mobilePhoneNumber:curUser.get('mobilePhoneNumber'),
        emailVerified:curUser.get('emailVerified'),
        mobilePhoneVerified:curUser.get('mobilePhoneVerified')
    };
}


function findUserClassRel(id, className, modifyQueryFn){
  var promise=new AV.Promise();
  var myItems = null;
  var addUser = AV.Object.createWithoutData('_User', id);
  var query = AV.Relation.reverseQuery(className, 'addUser', addUser);
  if (modifyQueryFn) {
    modifyQueryFn(query);
  }
  query.find().then(function (items) {
    myItems = items || [];
  }).then(function () {
    var query = AV.Relation.reverseQuery(className+'Comment', 'addUser', addUser);
    if (modifyQueryFn) {
      modifyQueryFn(query);
    }
    query.include(className);
    return query.find(function (itemCs) {
      var myItemCs = itemCs || [];
      // nutil.AVObjs2JsonObjs(myItemCs);
      promise.resolve(
          {
            myItems: myItems,
            myItemCs: myItemCs
          }
      );
    });
  });
  return promise;

}

exports.findUser = findUser;
exports.findUserById = findUserById;
exports.findUserClassRel = findUserClassRel;
exports.addFriend = addFriend;
exports.removeFriend = removeFriend;
exports.addFriendForBoth = addFriendForBoth;
exports.removeFriendForBoth = removeFriendForBoth;
exports.findFriends = findFriends;
exports.findAllUsers = findAllUsers;
exports.beforeSaveUser = beforeSaveUser;
exports.findRandomAvatar = findRandomAvatar;
exports.handleAddFriend = handleAddFriend;
exports.handleRemoveFriend = handleRemoveFriend;
exports.findUsernameById = findUsernameById;
exports.findUsers = findUsers;
exports.convertRelation = convertRelation;
exports.convert=convert;
exports.transfromUser=transfromUser;