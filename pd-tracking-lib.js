/// Attention PURE JAVASCRIPT ONLY
// No external libraries/require

var pdTrackingLib = (function () {
	var tracking = {
		utils: {},
		services: {}
	};

	//placeholder for utils
	tracking.utils.ajaxRequest = (function () {

	function ajaxRequest(httpMethod, url, data, clientData, callback, errorCallback) {
		const urlWithRightDomain = utils.buildUrl(url);

		var xmlHttp = new XMLHttpRequest();
		xmlHttp.onreadystatechange = function () {
			if (xmlHttp.readyState == XMLHttpRequest.DONE) {
				if (xmlHttp.status >= 200 && xmlHttp.status <= 299) {
					callback(xmlHttp.responseText && xmlHttp.responseText != '' ? JSON.parse(xmlHttp.responseText) : null);
				} else {
					errorCallback({
						status: xmlHttp.status,
						data: xmlHttp.responseText
					});

					const event = new CustomEvent('httpErrorEvent', { 'detail': { error: { response: xmlHttp } } });
					window.dispatchEvent(event);
				}
			}
		};

		xmlHttp.open(httpMethod, urlWithRightDomain, true);
		xmlHttp.withCredentials = true;
		xmlHttp.setRequestHeader('Content-Type', 'application/json');
		xmlHttp.setRequestHeader('Accept', 'application/json');
		xmlHttp.setRequestHeader('pd-app-client-id', clientData.id || clientData.name);
		xmlHttp.setRequestHeader('pd-app-client-version', clientData.version);

		if (httpMethod == 'POST') {
			xmlHttp.send(JSON.stringify(data));
		} else {
			xmlHttp.send();
		}
	}

	return { ajaxRequest: ajaxRequest };
})();


tracking.utils.buildUrl = (function () {
	function buildUrl(url) {
		if (window.location.host.indexOf('.studenta.com') > -1)
			return url.replace('.passeidireto.com', '.studenta.com');
		return url;
	}

	return buildUrl;
})();


tracking.utils.cookies = (function () {
	var siteDomain = window.location.host.indexOf(".studenta.com") > -1 ?
		".studenta.com" :
		".passeidireto.com";

	function getCookie(name) {
		var result = document.cookie.match(new RegExp(name + '=([^;]+)'));
		try {
			result && (result = JSON.parse(result[1]));
		} catch (Exception) {
			result && (result = result[1]);
		}
		return result;
	}

	function removeCookie(name, domain) {
		domain = domain || siteDomain;
		document.cookie = [name, '=; expires=Thu, 01-Jan-1970 00:00:01 GMT; path=/; domain=', domain].join('');
	}

	function setCookie(name, value) {
		var cookie = [name, '=', JSON.stringify(value), '; domain=', siteDomain, '; path=/;'].join('');
		document.cookie = cookie;
	}

	function validateFunction(functionName, src) {
		if (!src[functionName] || (typeof src[functionName] != "function")) {
			throw new Error("Invalid " + functionName + " function")
		}
	}

	function overrideCookiesUtils(cookiesUtils) {
		validateFunction("setCookie", cookiesUtils);
		validateFunction("getCookie", cookiesUtils);
		validateFunction("removeCookie", cookiesUtils);

		Object.assign({}, tracking.utils.cookies, cookiesUtils);
	}

	return {
		setCookie: setCookie,
		getCookie: getCookie,
		removeCookie: removeCookie,
		overrideCookiesUtils: overrideCookiesUtils
	};

})();

tracking.utils.debounce = (function () {

    function debounce(func, wait, immediate) {
        var timeout;
        return function () {
            var context = this, args = arguments;
            var later = function () {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            var callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    }

    return { debounce: debounce };
})();

tracking.utils.registerBeacon = (function () {
	function registerBeacon(url, data, clientData) {
		const urlWithRightDomain = utils.buildUrl(url);

		window.addEventListener('unload', () => {
			const headers = {
				'Content-Type': 'application/json',
				Accept: 'application/json',
				'pd-app-client-id': clientData.id || clientData.name,
				'pd-app-client-version': clientData.version,
			};
			const blob = new Blob([JSON.stringify(data)], headers);
			navigator.sendBeacon(urlWithRightDomain, blob);
		});
	}

	return registerBeacon;
})();



	//placeholder for services
	tracking.services.eventTracking = // generic tracking service
(function () {
	var currentSessionData;

	function init(sessionData) {
		currentSessionData = sessionData;
	}

	function extractPdUtm() {
		return window.location.search
			.slice(1)
			.split('&')
			.filter(function (utm) {
				return utm.startsWith('pd_');
			})
			.join('&');
	}

	function prepareTrackData(eventName, eventData, sessionId) {
		eventData.PdUtm = extractPdUtm();

		const {
			anonUserId = null,
			anonSessionId = null,
			flagrExperiments = null,
			countryId = null,
			languageId = null,
		} = currentSessionData;

		eventData = {
			anonUserId,
			anonSessionId,
			flagrExperiments,
			countryId,
			languageId,
			...eventData,
		};

		var data = {
			SessionId: sessionId,
			EventName: eventName,
			Data: eventData,
			TrackingLibVersion: '0.0.1',
		};

		var trackingApiUrl = 'https://dev-tracking-api.passeidireto.com';
		var url = trackingApiUrl + '/track';

		return { url, data };
	}

	function sendTrack(eventName, eventData, sessionId, keepAlive) {
		const { url, data } = prepareTrackData(eventName, eventData, sessionId);

		console.log('[PD Tracking Lib]', eventName, JSON.stringify(data), {keepAlive, url});

		if (keepAlive) {
			tracking.utils.registerBeacon(url, data, currentSessionData.clientData);
		} else {
			tracking.utils.ajaxRequest.ajaxRequest(
				'POST',
				url,
				data,
				currentSessionData.clientData,
				function (data) {},
				function (err) {
					console.error('[PD Tracking Lib] Something went wrong with event tracking', err);
				}
			);
		}
	}

	function track(eventName, eventData, retryCount, keepAlive) {
		var sessionId = tracking.services.sessionTracking.getSessionId();

		var delayRetryTime = parseInt('500');
		var sendEventRetry = parseInt('10000') / delayRetryTime;

		if (sessionId > 0 || (currentSessionData && currentSessionData.anonymous)) {
			return sendTrack(eventName, eventData, sessionId, keepAlive);
		}

		if (retryCount < sendEventRetry) {
			console.warn('[PD Tracking Lib] Session Tracking is not ready, delaying to send. Attempt:', ++retryCount);

			setTimeout(function () {
				track(eventName, eventData, retryCount, keepAlive);
			}, delayRetryTime);
		} else {
			console.error('[PD Tracking Lib] Session Tracking is not ready, giving up');
		}
	}

	return {
		track: function (eventName, eventData) {
			return track(eventName, eventData, 0);
		},
		init: init,
	};
})();


tracking.services.materialReadTracking = // service with all logic of periodic event tracking for material
(function () {
	const MATERIAL_READ_INTERVAL = parseInt("10000");
	var viewCall, currentMaterialId;

	function startMaterialRead(materialId) {
		currentMaterialId = materialId;

		// If session is active, start tracking immediately, otherwise wait to be active
		if (tracking.services.sessionActivity.isSessionActive()) {
			// changed material, cancel the old interval
			cancelMaterialRead();

			viewCall = setInterval(function () {
				tracking.services.eventTracking.track("MaterialRead", { MaterialId: materialId, MaterialReadInterval: MATERIAL_READ_INTERVAL })
			}, MATERIAL_READ_INTERVAL);

			tracking.services.sessionActivity.bindSessionInactiveCallback(sessionInactiveCallback);
		} else {
			sessionInactiveCallback();
		}
	}

	// cancel event tracking by session inactivity or material close
	function cancelMaterialRead() {
		if (viewCall) {
			clearInterval(viewCall);
			viewCall = null;
		}

		tracking.services.sessionActivity.unbindSessionInactiveCallback(sessionInactiveCallback);
		tracking.services.sessionActivity.unbindSessionActiveCallback(sessionActiveCallback);
	}

	// callback for the sessionActivity Service notify
	function sessionActiveCallback() {
		startMaterialRead(currentMaterialId);
		tracking.services.sessionActivity.unbindSessionActiveCallback(sessionActiveCallback);
	}

	// callback for the sessionActivity Service notify
	function sessionInactiveCallback() {
		cancelMaterialRead();
		tracking.services.sessionActivity.bindSessionActiveCallback(sessionActiveCallback);
	}

	function stopMaterialRead() {
		cancelMaterialRead();
		currentMaterialId = null;
	}

	return { startMaterialRead: startMaterialRead, stopMaterialRead: stopMaterialRead };

})();

tracking.services.materialWatchedTracking = // service with all logic of periodic event tracking for material watched
(function () {
    const MATERIAL_WATCHED_INTERVAL = parseInt("10000");
    const EVENT_NAME = 'MaterialWatched';
    var viewCall, currentMaterialId;

    function startMaterialWatched(materialId) {
        currentMaterialId = materialId;

        cancelMaterialWatched();

        viewCall = setInterval(function () {
            tracking.services.eventTracking.track(EVENT_NAME, { MaterialId: materialId, MaterialWatchedInterval: MATERIAL_WATCHED_INTERVAL, OnTab: !document.hidden })
        }, MATERIAL_WATCHED_INTERVAL);
    }

    // cancel event tracking by material pause/close
    function cancelMaterialWatched() {
        if (viewCall) {
            clearInterval(viewCall);
            viewCall = null;
        }
    }

    function stopMaterialWatched() {
        cancelMaterialWatched();
        currentMaterialId = null;
    }

    return { startMaterialWatched: startMaterialWatched, stopMaterialWatched: stopMaterialWatched };

})();


tracking.services.sessionActivity = // service to monitor user activity. Ex: is tab active?
(function () {
	var debounceUtils = tracking.utils.debounce;
	const DEBOUNCE_MS = 500;
	const INACTIVITY_TIMEOUT = parseInt("30000");

	var currentSessionData;

	var currentTabActive;

	var sessionActiveCallbacks = [];
	var sessionInactiveCallbacks = [];

	function validateSessionData(sessionData) {
		if (!sessionData.anonymous) {
			if (!sessionData.userId || sessionData.userId < 1) {
				throw new Error("Invalid userId")
			}
		}

		if (!sessionData.currentLocation) {
			throw new Error("Invalid currentLocation")
		}

		if (!sessionData.clientData) {
			throw new Error("Invalid clientData")
		} else {
			if ((!sessionData.clientData.id || sessionData.clientData.id < 1) && !sessionData.clientData.name) {
				throw new Error("Invalid clientData.id and clientData.name")
			}

			if (!sessionData.clientData.version) {
				throw new Error("Invalid clientData.version")
			}
		}
	}

	// update user data and start session tracking
	function initSession(sessionData, onSuccess, onError) {
		onSuccess = typeof onSuccess  === 'undefined' ? function() {} : onSuccess;
		onError = typeof onError  === 'undefined' ? function() {} : onError;

		validateSessionData(sessionData);
		currentSessionData = sessionData;

		tracking.services.sessionTracking.init(currentSessionData);
		tracking.services.eventTracking.init(currentSessionData);

		if (!sessionData.anonymous) {
			tracking.services.sessionTracking.trackSession(onSuccess, onError);
		} else {
			onSuccess();
		}
	}

	// userd for periodic user activity notification: click, mouse, scroll
	function trackUserActivity() {
		setExpireUserActivity();

		tracking.services.sessionTracking.trackSession();
	}

	const userActivityEventListener = debounceUtils.debounce(trackUserActivity, DEBOUNCE_MS);

	function userInactivityEventListener() {
		setExpireUserActivity(true);
	}

	// sets a timeout to disable the current session if no notification of user activity is sent in a range of time
	function setExpireUserActivity(immediately) {
		if (currentTabActive) {
			clearTimeout(currentTabActive);
		} else if (!immediately) {
			console.log('[PD Tracking Lib]', "Session active");

			// Execute active callbacks in the next cycle, when "currentTabActive" will be set
			setTimeout(function () {
				sessionActiveCallbacks.forEach(function (sessionActiveCallback) { sessionActiveCallback(); })
			});
		}

		currentTabActive = setTimeout(function () {
			currentTabActive = null;
			console.log('[PD Tracking Lib]', "Session inative");

			// Execute inactive callbacks
			sessionInactiveCallbacks.forEach(function (sessionInactiveCallback) { sessionInactiveCallback(); })
		}, immediately ? 0 : INACTIVITY_TIMEOUT);
	}

	// functions to bind/unbind for events of session active/inactive
	function bindSessionActiveCallback(callback) {
		sessionActiveCallbacks.push(callback);
	}

	function unbindSessionActiveCallback(callback) {
		var index = sessionActiveCallbacks.indexOf(callback);
		sessionActiveCallbacks.splice(index, 1)
	}

	function bindSessionInactiveCallback(callback) {
		sessionInactiveCallbacks.push(callback);
	}

	function unbindSessionInactiveCallback(callback) {
		var index = sessionInactiveCallbacks.indexOf(callback);
		sessionInactiveCallbacks.splice(index, 1)
	}

	function isSessionActive() {
		return !!currentTabActive;
	}

	return {
		initSession: initSession,
		userActivityEventListener: userActivityEventListener,
		userInactivityEventListener: userInactivityEventListener,
		bindSessionActiveCallback: bindSessionActiveCallback,
		unbindSessionActiveCallback: unbindSessionActiveCallback,
		bindSessionInactiveCallback: bindSessionInactiveCallback,
		unbindSessionInactiveCallback: unbindSessionInactiveCallback,
		isSessionActive: isSessionActive
	};

})();

tracking.services.sessionTracking = // service for periodic session tracking
(function () {
	const LAST_TRACKING_CALL_COOKIE_NAME = 'last-session-tracking-call';
	const LAST_TRACKING_ID_COOKIE_NAME = 'last-session-tracking-id';
	
	var sessionId, currentSessionData;

	function getCookieNameByClient(cookieName) {
		const clientId = currentSessionData.clientData.id;

		return cookieName + '_' + clientId;
	}

	function init(sessionData) {
		currentSessionData = sessionData;
	}

	function isValidSessionId(sessionId) {
		return typeof sessionId === 'number' && sessionId > 0;
	}

	function clearLastTrackingCookie() {
		tracking.utils.cookies.removeCookie(getCookieNameByClient(LAST_TRACKING_CALL_COOKIE_NAME));
		tracking.utils.cookies.removeCookie(getCookieNameByClient(LAST_TRACKING_ID_COOKIE_NAME));
	}

	function doTrackSession(onSuccess, onError) {
		const currentUrl = window.location.href;
		const referrerUrl = document.referrer;
		const FirstAccessedPage = tracking.utils.cookies.getCookie('first_accessed_page');
		const FirstAccessedPageReferrer = tracking.utils.cookies.getCookie('first_accessed_page_referer');

		const {
			anonUserId = null,
			anonSessionId = null,
			flagrExperiments = null,
			countryId = null,
		} = currentSessionData;

		const userId = currentSessionData.userId;

		const languageId = currentSessionData.languageId ? currentSessionData.languageId : null;
		const host = currentSessionData.host ? currentSessionData.host : null;

		tracking.utils.cookies.setCookie(getCookieNameByClient(LAST_TRACKING_CALL_COOKIE_NAME), new Date().toISOString());

		var sessionTrackingApiUrl = "https://dev-session-tracking-api.passeidireto.com";
		var url = sessionTrackingApiUrl + "/session/" + userId + "/track";
		
		const sessionTrackRequestBody = { 
			currentUrl: currentUrl,
			referrerUrl: referrerUrl,
			FirstAccessedPage: FirstAccessedPage,
			FirstAccessedPageReferrer: FirstAccessedPageReferrer,
			countryId: countryId,
			languageId:languageId,
			host:host,
			anonUserId: anonUserId,
			anonSessionId: anonSessionId,
			flagrExperiments: flagrExperiments
		};

		console.log('[PD Tracking Lib]', 'SessionTracking', JSON.stringify(sessionTrackRequestBody));

		tracking.utils.ajaxRequest.ajaxRequest('POST', url, sessionTrackRequestBody, currentSessionData.clientData,
			function (data) {
				if (data && isValidSessionId(data.SessionId)) {
					sessionId = data.SessionId;
					tracking.utils.cookies.setCookie(getCookieNameByClient(LAST_TRACKING_ID_COOKIE_NAME), sessionId);
					onSuccess();
				} else {
					windowUtil.trackWarn(
						'Invalid session id',
						{},
						{
							...sessionTrackRequestBody,
							...data,
						},
					);

					sessionId = -1;
					clearLastTrackingCookie();
					onError();
				}
			},
			function (err) {
				const RequestError = new Error('Fail to register session tracking');
				RequestError.name = 'SessionTrackingAPIError';
				windowUtil.trackError(
					RequestError,
					{
						request_error: true,
						request_status: err.status,
					},
					{
						...sessionTrackRequestBody,
					},
				);

				console.error('[PD Tracking Lib] Something went wrong with session tracking', err);
				sessionId = -1;

				clearLastTrackingCookie();
				onError(err);
			});
	}

	function trackSession(onSuccess, onError) {
		onSuccess = typeof onSuccess  === 'undefined' ? function() {} : onSuccess;
		onError = typeof onError  === 'undefined' ? function() {} : onError;

		var lastTrack = tracking.utils.cookies.getCookie(getCookieNameByClient(LAST_TRACKING_CALL_COOKIE_NAME));
		var sessionIdTrack = tracking.utils.cookies.getCookie(getCookieNameByClient(LAST_TRACKING_ID_COOKIE_NAME));

		if (!lastTrack || !sessionIdTrack) {
			return doTrackSession(onSuccess, onError);
		} else {
			lastTrack = new Date(lastTrack);
			var now = new Date();
			var diff = Math.abs(lastTrack - now);

			if (diff >= (parseInt("60000"))) {
				doTrackSession(onSuccess, onError);
			} else if (!isValidSessionId(sessionId)) {
				sessionId = sessionIdTrack;
				onSuccess();
			}
		}
	}

	return {
		init: init,
		trackSession: trackSession,
		getSessionId: function () { return sessionId; },
		getSessionKey: function () { return currentSessionData.sessionKey; }
	};

})();



	// mapping public functions
	return {
		// to allow mobile do use a different "cookie engine"
		overrideCookiesUtils: tracking.utils.cookies.overrideCookiesUtils,
		// session tracking init, receives user and client data 
		initSession: tracking.services.sessionActivity.initSession,
		// to bind to notify the lib of the user activities
		userActivityEventListener: tracking.services.sessionActivity.userActivityEventListener,
		// to bind to notify the lib of the user inactivities as changing tab
		userInactivityEventListener: tracking.services.sessionActivity.userInactivityEventListener,
		// generic event tracking
		trackEvent: tracking.services.eventTracking.track,
		// notify that a new material read is set and starts tracking
		startMaterialRead: tracking.services.materialReadTracking.startMaterialRead,
		// stop material read tracking
		stopMaterialRead: tracking.services.materialReadTracking.stopMaterialRead,
		// notify that a new material watched is set and starts tracking
		startMaterialWatched: tracking.services.materialWatchedTracking.startMaterialWatched,
		// stop material watched tracking
		stopMaterialWatched: tracking.services.materialWatchedTracking.stopMaterialWatched,
		version: '0.0.1'
	};
})();
