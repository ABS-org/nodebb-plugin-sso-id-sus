
(function(module) {
	"use strict";

	var User = module.parent.require('./user'),
		db = module.parent.require('./database'),
		meta = module.parent.require('./meta'),
		nconf = module.parent.require('nconf'),
		identSUS = require('id-sus-sdk-nodejs'),
		async = module.parent.require('async'),
		passport = module.parent.require('passport'),
		request = module.parent.require('request'),
		Auth0Strategy = require('passport-auth0').Strategy,
		authenticationController = module.parent.require('./controllers/authentication'),
		IdSus = {},
		constants;

	constants = Object.freeze({
		'name': "ID SUS",
		'admin': {
			'icon': 'fa-user-md',
			'route': '/plugins/sso-id-sus'
		}
	});


	IdSus.getStrategy = function(strategies, callback) {
		meta.settings.get('sso-id-sus', function(err, settings) {
			if (err || !settings.id || !settings.secret || !settings.domain) {
				var msg = err ? err : 'AUTH0 ERROR: id, secret, and domain are required.';
				return callback(msg);
			}

			var config = {
				client_id: settings.id,
				client_secret: settings.secret,
				auth_host: settings.domain,
				redirect_uri: nconf.get('url') + '/auth/sso-id-sus/callback' 
			}

			var idSus = identSUS(config)
			console.log(idSus.getUrlCode())
			console.log(nconf.get('url') + '/auth/sso-id-sus/callback')

			strategies.push({
				name: 'sso-id-sus',
				url: idSus.getUrlCode(),
				callbackURL: nconf.get('url') + '/auth/sso-id-sus/callback',
				icon: constants.admin.icon,
				scope: 'user:email'
			});

			

			callback(null, strategies);
		});

	};

	IdSus.getAssociation = function(data, callback) {
		console.log('----- getAssociation -----');
		User.getUserField(data.uid, 'auth0id', function(err, auth0id) {
			if (err) {
				return callback(err, data);
			}

			if (auth0id) {
				data.associations.push({
					associated: true,
					name: constants.name,
					icon: constants.admin.icon
				});
			} else {
				data.associations.push({
					associated: false,
					url: nconf.get('url') + '/auth/auth0',
					name: constants.name,
					icon: constants.admin.icon
				});
			}

			callback(null, data);
		})
	};

	IdSus.addMenuItem = function(custom_header, callback) {
		custom_header.authentication.push({
			"route": constants.admin.route,
			"icon": constants.admin.icon,
			"name": constants.name
		});

		callback(null, custom_header);
	};



	IdSus.init = function(params, callback) {

		var router = params.router;
		var middleware = params.middleware;

		function renderAdmin(req, res) {
			res.render('admin/plugins/sso-id-sus', {
				callbackURL: nconf.get('url') + '/auth/sso-id-sus/callback'
			});
		}

		function loginSus(req, res, next){
			meta.settings.get('sso-id-sus', function(err, settings) {
				

				var config = {
					client_id: settings.id,
					client_secret: settings.secret,
					auth_host: settings.domain,
					redirect_uri: nconf.get('url') + '/auth/sso-id-sus/callback' 
				}

				var idSus = identSUS(config)

				function updateUser(req, res, uid, data){
					console.log(req.user)
					console.log(uid)
					console.log('user:' + uid)
					console.log(data)
					req.user = {username: data.email.split('@')[0], email: data.email, uid: uid}
					User.setUserField(req.user.uid, 'idsus', uid);
					db.setObjectField('user:' + uid, 'susconnecta', data);
					authenticationController.onSuccessfulLogin(req, uid);

					res.redirect(nconf.get('url'));	
					
				}

				idSus.getAccessToken(req.query.code, function(err, data){
					idSus.getScopes(data.access_token, data.scope, function(err,data){
						User.getUidByEmail(data.email, function(err, uid) {
							console.log('------uid-----')
							console.log(uid)
							console.log('------uid-----')
							if (!uid) {
								console.log('Sem uid (Criar User)')
								User.create({username: data.email.split('@')[0], email: data.email}, function(err, uid) {
									if (err !== null) {
										callback(err);
									} else {
										updateUser(req, res, uid, data);
									}
								});
							} else {
								console.log('Com uid' + uid)
								updateUser(req, res, uid, data)
							}
						});

					})
				})

				
			})
		}



		function refreshToken(req, res) {
			if('exprire_id' < 'date_now'){
				meta.settings.get('sso-id-sus', function(err, settings) {
				
					var config = {
						client_id: settings.id,
						client_secret: settings.secret,
						auth_host: settings.domain,
						redirect_uri: nconf.get('url') + '/auth/sso-id-sus/callback' 
					}

					var idSus = identSUS(config)

					idSus.revokeToken('access_token', function(err, data){
						idSus.refreshToken(refresh_token, function(err, data){
							/*
							data = { 	
								access_token: 'vvOqVxAU1uLY1t5iFUqqRqDGqz7ORJ',
								token_type: 'Bearer',
								expires_in: Thu Mar 31 2016 00:55:19 GMT+0000 (UTC),
								refresh_token: 'azKukSlyP3Hm6670SQ30xmxEPk4FZP',
								scope: [ 'conselhos', 'cpf', 'dados_publicos', 'email' ] 
							}
							*/

						});
					});
				})
			};
		}

		function logoutCallback(req, res) {
			meta.settings.get('sso-id-sus', function(err, settings) {
				
				var config = {
					client_id: settings.id,
					client_secret: settings.secret,
					auth_host: settings.domain,
					redirect_uri: nconf.get('url') + '/auth/sso-id-sus/callback' 
				}

				var idSus = identSUS(config)

				idSus.revokeToken('access_token', function(err, data){

					res.render('/', {logoutFlag: true});
				})
			})
		}

		
		router.get('/auth/sso-id-sus/callback',  middleware.applyCSRF, loginSus);
		router.get('/api/auth/sso-id-sus/callback', middleware.applyCSRF, loginSus);

		router.get('/admin/plugins/sso-id-sus', middleware.admin.buildHeader, renderAdmin);
		router.get('/api/admin/plugins/sso-id-sus', renderAdmin);
		router.get('/auth/sso-id-sus/logout/callback', logoutCallback);

		callback();
		//https://login.susconecta.org.br/oauth/authorize/?state=random_state_string&client_id=uZNmqYfUuI6DQQ3NVmDPx8kHHQPuFKABeScX4FPU&response_type=code
	};

	module.exports = IdSus;
}(module));
