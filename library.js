

(function(module) {
  'use strict';
  /* globals module, require */

  var User = module.parent.require('./user'),
    plugins = module.parent.require('./plugins'),
    meta = module.parent.require('./meta'),
    db = module.parent.require('../src/database'),
    utils = module.parent.require('../public/src/utils'),
    passport = module.parent.require('passport'),
    IdentSus = require('id-sus-sdk-nodejs'),
    _ = require('underscore'),
    IdsusStrategy = require('passport-idsus').Strategy,
    nconf = module.parent.require('nconf'),
    async = module.parent.require('async'),
    winston = module.parent.require('winston'),
    fs = require('fs'),
    path = require('path'),
    request = require('request');

  var authenticationController = module.parent.require('./controllers/authentication');

  var constants = Object.freeze({
    'name': 'ID SUS',
    'admin': {
      'icon': 'fa-user-md',
      'route': '/plugins/sso-id-sus'
    }
  });

  var Idsus = {
    settings: undefined
  };

  Idsus.loggedOut = function(data){
    var config = {
      client_id: Idsus.settings.id,
      client_secret: Idsus.settings.secret,
      redirect_uri: Idsus.settings.baseUrl + '/auth/idsus/callback',
      login_url: Idsus.settings.loginURL,
      api_url: Idsus.settings.apiURL,
    };

    var IdentSusCfg = IdentSus(config)

    if(data.req.cookies['__susconecta']){
      var cookieSusConecta = JSON.parse(data.req.cookies['__susconecta']);

      IdentSusCfg.logout(cookieSusConecta, function (err, body) {
        if(err){
          res.status(200).json({});  
        }

        res.status(200).json({});  

      })
    }

  };

  Idsus.init = function(params, callback) {
    function render(req, res) {
      res.render('admin/plugins/sso-id-sus', {
        callbackURL: nconf.get('url') + '/auth/idsus/callback'
      });
    }

    function cookieAuth(req, res){
      var config = {
        client_id: Idsus.settings.id,
        client_secret: Idsus.settings.secret,
        redirect_uri: Idsus.settings.baseUrl + '/auth/idsus/callback',
        login_url: Idsus.settings.loginURL,
        api_url: Idsus.settings.apiURL,
      };
      
      res.set('Content-Type', 'text/javascript');

      var IdentSusCfg = IdentSus(config)
      console.log(config.login_url + "/base/setcookies" )

      request(config.login_url + "/base/setcookies", function (error, response, body) {
        console.log(error);
        console.log(response);
        console.log(body);
        if (!error && response.statusCode == 200) {
          console.log(body);
        }
      })

      if(req.cookies['__susconecta']){
        if(req.user){
          res.status(200).json({reload: false});
        }else{
          var cookieSusConecta = JSON.parse(req.cookies['__susconecta']);
          var identOpt = {origin: 'cookie', sessionid: cookieSusConecta.SID}

          IdentSusCfg.getTokenAndScopes(identOpt, function (err, body) {
            if(err){
              return callback(err);
            }
            
            var userScope = body.scopeObj;

            User.getUidByEmail(userScope.email, function(err, uid) {
              req.login({uid: uid}, function(err) {
                if (err) {
                  return callback(err);
                }

                res.status(200).json({reload: true});
              });

            })
          })
        }
      }else{
        if(req.user){
          User.auth.revokeSession(req.sessionID, req.user.uid, function(err) {
            if (err) {
              res.status(200).json({reload: false});
            }
            req.logout();
            res.status(200).json({reload: true});
          });
        }else{
          res.status(200).json({reload: false});
        }
        
      }
    
    }


    function userParticipation(req, res){

      function validateEmail(email) {
        var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(email);
      }

      if(req.params.email === undefined){
        return res.status(422).json({error: {email: 'blank'}});
      }

      if(!validateEmail(req.params.email)){
        return res.status(422).json({error: {email: 'invalid'}});
      }

      User.getUidByEmail(req.params.email, function(err, uid) {
        var cursor = db.client.collection('objects').find({uid: uid,  _key: { $in: [ /^topic/, /^post/ ] } })

        var content = { total: 0, data: []};

        cursor.each(function(err, doc) {
          if (doc != null) {
            content.total += 1; 
            content.data.push(doc);
          } else {
            return res.status(200).json(content);
          }
       });

      })

    }

    function categories(req, res){
        var cursor = db.client.collection('objects').find({ _key: { $in: [ /^category/ ] } })

        var content = { total: 0, data: []};
        var data = []

        cursor.each(function(err, doc) {
          if (doc != null) {
            content.total += 1; 
            data.push(doc);
          } else {
            for (var i = 0; i < data.length; i++) {
              content.data.push({
                name: data[i].name,
                description: data[i].description,
                url: nconf.get('url') + "category/" + data[i].slug
              })
            }
            return res.status(200).json(content);
          }
       });
    }


    function unreadNotifications(req, res){
      function validateEmail(email) {
        var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(email);
      }

      if(req.params.email === undefined){
        return res.status(422).json({error: {email: 'blank'}});
      }

      if(!validateEmail(req.params.email)){
        return res.status(422).json({error: {email: 'invalid'}});
      }

      User.getUidByEmail(req.params.email, function(err, uid) {
        var cursor_unread = db.client.collection('objects').find({ _key: 'uid:' + uid + ':notifications:unread' });
        var unread_notifications = [];
        var notification_key = [];
        var notification_obj = [];
        var results = {total: 0, data: [] };
        var i;

        cursor_unread.each(function(err, unread_doc) {
          if (unread_doc != null) {
            unread_notifications.push(unread_doc);
          } else {
            for (i = 0; i < unread_notifications.length; i++) {
              notification_key.push('notifications:' + unread_notifications[i].value)
            }
            
            unread_notifications = db.client.collection('objects').find({ _key: { $in: notification_key } });

            unread_notifications.each(function(err, unread_doc) {
              if (unread_doc != null) {
                results.total++
                notification_obj.push(unread_doc)
              }else{
                for (i = 0; i < notification_obj.length; i++) {
                  results.data.push({
                    message: notification_obj[i].bodyShort,
                    url: nconf.get('url') + notification_obj[i].path.substring(1)
                  })
                }

                return res.status(200).json(results);
              }
            })

          }
        })

      })
    }

    params.router.get('/admin/plugins/sso-id-sus', params.middleware.admin.buildHeader, render);
    params.router.get('/api/admin/plugins/sso-id-sus', render);

    params.router.get('/auth/idsus/cookie.js', cookieAuth);
    params.router.get('/api/user/interactions/:email', userParticipation);
    params.router.get('/api/user/notifications/:email', unreadNotifications);
    params.router.get('/api/categories', categories);
    

    callback();
  };

  Idsus.getSettings = function(callback) {
    if (Idsus.settings) {
      return callback();
    }

    meta.settings.get('sso-id-sus', function(err, settings) {
      Idsus.settings = settings;
      callback();
    });
  }

  Idsus.getStrategy = function(strategies, callback) {
    if (!Idsus.settings) {
      return Idsus.getSettings(function() {
        Idsus.getStrategy(strategies, callback);
      });
    }

    if (
      Idsus.settings !== undefined && Idsus.settings.hasOwnProperty('id') && Idsus.settings.id && Idsus.settings.hasOwnProperty('secret') && Idsus.settings.secret && Idsus.settings.hasOwnProperty('loginURL') && Idsus.settings.loginURL && Idsus.settings.hasOwnProperty('apiURL') && Idsus.settings.apiURL 
    ) {
      console.log(Idsus.settings)

      passport.use(new IdsusStrategy({
        clientID: Idsus.settings.id,
        clientSecret: Idsus.settings.secret,
        callbackURL: Idsus.settings.baseUrl + '/auth/idsus/callback',
        loginURL: Idsus.settings.loginURL,
        apiURL: Idsus.settings.apiURL,
      }, function(accessToken, tokenType, expiresIn, refreshToken, scopes, user, done, err) {
        function success(uid) {
          done(null, {
            uid: uid
          });
        }

        User.getUidByEmail(user.email, function(err, uid) {
          if (!uid) {

            User.create({ username: user.email.split('@')[0], email: user.email, fullname: user.name }, function(err, uid) {
              if (err !== null) {
                callback(err);
              } else {

                if(user.avatar == null){
                  success(uid)
                }

                var url = 'https://login.susconecta.org.br' + user.avatar;
                var extname = path.extname(url).substring(1);

                if (['png', 'jpeg', 'jpg', 'gif'].indexOf(extname) === -1) {
                  success(uid)
                }

                var r = request(url)

                r.on('response', function (resp) {
                  if(resp.statusCode == 200){
                    //Write image file
                    resp.pipe(fs.createWriteStream('./public/uploads/profile/' + uid + '-profileimg.jpg'));
                    //Add to User profile
                    User.setUserField(uid, 'uploadedpicture', '/uploads/profile/' + uid + '-profileimg.jpg');
                    User.setUserField(uid, 'picture', '/uploads/profile/' + uid + '-profileimg.jpg');    
                  }
                  success(uid)
                })
  
              }
            });
          } else {
            success(uid)
          }
        });

      }));

      strategies.push({
        name: 'idsus',
        url: '/auth/idsus',
        callbackURL: '/auth/idsus/callback',
        icon: constants.admin.icon
      });
    }

    callback(null, strategies);
  };

  // Facebook.getAssociation = function(data, callback) {
  //   user.getUserField(data.uid, 'fbid', function(err, fbId) {
  //     if (err) {
  //       return callback(err, data);
  //     }

  //     if (fbId) {
  //       data.associations.push({
  //         associated: true,
  //         url: 'https://facebook.com/' + fbId,
  //         name: constants.name,
  //         icon: constants.admin.icon
  //       });
  //     } else {
  //       data.associations.push({
  //         associated: false,
  //         url: nconf.get('url') + '/auth/facebook',
  //         name: constants.name,
  //         icon: constants.admin.icon
  //       });
  //     }

  //     callback(null, data);
  //   })
  // };

  // Facebook.storeTokens = function(uid, accessToken, refreshToken) {
  //   //JG: Actually save the useful stuff
  //   winston.info("Storing received fb access information for uid(" + uid + ") accessToken(" + accessToken + ") refreshToken(" + refreshToken + ")");
  //   user.setUserField(uid, 'fbaccesstoken', accessToken);
  //   user.setUserField(uid, 'fbrefreshtoken', refreshToken);
  // };

  // Facebook.login = function(fbid, name, email, picture, accessToken, refreshToken, profile, callback) {

  //   winston.verbose("Facebook.login fbid, name, email, picture: " + fbid + ", " + ", " + name + ", " + email + ", " + picture);

  //   Facebook.getUidByFbid(fbid, function(err, uid) {
  //     if (err) {
  //       return callback(err);
  //     }

  //     if (uid !== null) {
  //       // Existing User

  //       Facebook.storeTokens(uid, accessToken, refreshToken);

  //       callback(null, {
  //         uid: uid
  //       });
  //     } else {
  //       // New User
  //       var success = function(uid) {
  //         // Save facebook-specific information to the user
  //         user.setUserField(uid, 'fbid', fbid);
  //         db.setObjectField('fbid:uid', fbid, uid);
  //         var autoConfirm = Facebook.settings && Facebook.settings.autoconfirm === "on" ? 1 : 0;
  //         user.setUserField(uid, 'email:confirmed', autoConfirm);

  //         // Save their photo, if present
  //         if (picture) {
  //           user.setUserField(uid, 'uploadedpicture', picture);
  //           user.setUserField(uid, 'picture', picture);
  //         }

  //         Facebook.storeTokens(uid, accessToken, refreshToken);

  //         callback(null, {
  //           uid: uid
  //         });
  //       };

  //       user.getUidByEmail(email, function(err, uid) {
  //         if (err) {
  //           return callback(err);
  //         }

  //         if (!uid) {
  //           user.create({ username: name, email: email }, function(err, uid) {
  //             if (err) {
  //               return callback(err);
  //             }

  //             success(uid);
  //           });
  //         } else {
  //           success(uid); // Existing account -- merge
  //         }
  //       });
  //     }
  //   });
  // };

  // Facebook.getUidByFbid = function(fbid, callback) {
  //   db.getObjectField('fbid:uid', fbid, function(err, uid) {
  //     if (err) {
  //       return callback(err);
  //     }
  //     callback(null, uid);
  //   });
  // };

  Idsus.addMenuItem = function(custom_header, callback) {
    custom_header.authentication.push({
      'route': constants.admin.route,
      'icon': constants.admin.icon,
      'name': constants.name
    });

    callback(null, custom_header);
  };

  // Facebook.deleteUserData = function(data, callback) {
  //   var uid = data.uid;

  //   async.waterfall([
  //     async.apply(user.getUserField, uid, 'fbid'),
  //     function(oAuthIdToDelete, next) {
  //       db.deleteObjectField('fbid:uid', oAuthIdToDelete, next);
  //     }
  //   ], function(err) {
  //     if (err) {
  //       winston.error('[sso-facebook] Could not remove OAuthId data for uid ' + uid + '. Error: ' + err);
  //       return callback(err);
  //     }
  //     callback(null, uid);
  //   });
  // };

  module.exports = Idsus;
}(module));
