/*
 * admin.js
 *
 * Copyright © 2015 Antergos
 *
 * This file is part of nodebb-plugin-sso-id-sus.
 *
 * nodebb-plugin-sso-id-sus is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 *
 * nodebb-plugin-sso-id-sus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * The following additional terms are in effect as per Section 7 of the license:
 *
 * The preservation of all legal notices and author attributions in
 * the material or in the Appropriate Legal Notices displayed
 * by works containing it is required.
 *
 * You should have received a copy of the GNU General Public License
 * along with nodebb-plugin-sso-id-sus; If not, see <http://www.gnu.org/licenses/>.
 *
 */

define('admin/plugins/sso-id-sus', ['settings'], function(Settings) {
	'use strict';
	/* globals $, app, socket, require */

	var ACP = {};

	ACP.init = function() {
		Settings.load('sso-id-sus', $('.sso-id-sus-settings'));


		$('#save').on('click', function() {
			Settings.save('sso-id-sus', $('.sso-id-sus-settings'), function() {
				app.alert({
					type: 'success',
					alert_id: 'sso-id-sus-saved',
					title: 'Settings Saved',
					message: 'Please reload your NodeBB to apply these settings',
					clickfn: function() {
						socket.emit('admin.reload');
					}
				});
			});
		});
	};

	return ACP;
});