

(function(module) {
  'use strict';
  /* globals module, require */

  var User = module.parent.require('./user'),
    meta = module.parent.require('./meta'),
    db = module.parent.require('../src/database'),
    passport = module.parent.require('passport'),
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

  Idsus.init = function(params, callback) {
    function render(req, res) {
      res.render('admin/plugins/sso-id-sus', {
        callbackURL: nconf.get('url') + '/auth/idsus/callback'
      });
    }

    params.router.get('/admin/plugins/sso-id-sus', params.middleware.admin.buildHeader, render);
    params.router.get('/api/admin/plugins/sso-id-sus', render);

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
      Idsus.settings !== undefined && Idsus.settings.hasOwnProperty('id') && Idsus.settings.id && Idsus.settings.hasOwnProperty('secret') && Idsus.settings.secret && Idsus.settings.hasOwnProperty('domain') && Idsus.settings.domain
    ) {
      passport.use(new IdsusStrategy({
        clientID: Idsus.settings.id,
        clientSecret: Idsus.settings.secret,
        callbackURL: Idsus.settings.baseUrl + '/auth/idsus/callback',
        authURL: Idsus.settings.domain
      }, function(accessToken, tokenType, expiresIn, refreshToken, scopes, user, done) {

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
