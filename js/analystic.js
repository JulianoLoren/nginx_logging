/*!
 * jQuery Cookie Plugin v1.4.1
 * https://github.com/carhartl/jquery-cookie
 *
 * Copyright 2006, 2014 Klaus Hartl
 * Released under the MIT license
 */
var kvas = {};
var kvaUuid;
var gkvaUuid;
var ssUuid;

(function(){

    (function (factory) {
            factory(kvas);get
    }(function ($) {

        var pluses = /\+/g;

        function encode(s) {
            return config.raw ? s : encodeURIComponent(s);
        }

        function decode(s) {
            return config.raw ? s : decodeURIComponent(s);
        }

        function stringifyCookieValue(value) {
            return encode(config.json ? JSON.stringify(value) : String(value));
        }

        function parseCookieValue(s) {
            if (s.indexOf('"') === 0) {
                // This is a quoted cookie as according to RFC2068, unescape...
                s = s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            }

            try {
                // Replace server-side written pluses with spaces.
                // If we can't decode the cookie, ignore it, it's unusable.
                // If we can't parse the cookie, ignore it, it's unusable.
                s = decodeURIComponent(s.replace(pluses, ' '));
                return config.json ? JSON.parse(s) : s;
            } catch(e) {}
        }

        function read(s, converter) {
            var value = config.raw ? s : parseCookieValue(s);
            return (typeof converter === '') ? converter(value) : value;
        }

        var config = $.cookie = function (key, value, options) {

            // Write

            if (arguments.length > 1 && typeof value !== 'function') {
                //TODO: merge with default Options
                //options = $.extend({}, config.defaults, options);

                if (typeof options.expires === 'number') {
                    var days = options.expires, t = options.expires = new Date();
                    t.setMilliseconds(t.getMilliseconds() + days * 864e+5);
                }

                return (document.cookie = [
                    encode(key), '=', stringifyCookieValue(value),
                    options.expires ? '; expires=' + options.expires.toUTCString() : '', // use expires attribute, max-age is not supported by IE
                    options.path    ? '; path=' + options.path : '',
                    options.domain  ? '; domain=' + options.domain : '',
                    options.secure  ? '; secure' : ''
                ].join(''));
            }

            // Read

            var result = key ? undefined : {},
                // To prevent the for loop in the first place assign an empty array
                // in case there are no cookies at all. Also prevents odd result when
                // calling $.cookie().
                cookies = document.cookie ? document.cookie.split('; ') : [],
                i = 0,
                l = cookies.length;

            for (; i < l; i++) {
                var parts = cookies[i].split('='),
                    name = decode(parts.shift()),
                    cookie = parts.join('=');

                if (key === name) {
                    // If second argument (value) is a function it's a converter...
                    result = read(cookie, value);
                    break;
                }

                // Prevent storing a cookie that we couldn't decode.
                if (!key && (cookie = read(cookie)) !== undefined) {
                    result[name] = cookie;
                }
            }

            return result;
        };

        config.defaults = {};

        $.removeCookie = function (key, options) {
            // Must not alter options, thus extending a fresh object...
            $.cookie(key, '', $.extend({}, options, { expires: -1 }));
            return !$.cookie(key);
        };

    }));

    function generateUUID() {
        var d = new Date().getTime();
        var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = (d + Math.random()*16)%16 | 0;
            d = Math.floor(d/16);
            return (c=='x' ? r : (r&0x3|0x8)).toString(16);
        });
        return uuid;
    }

    function initUUID() {
        var Cookies = kvas.cookie;
        kvaUuid = Cookies('kvas-uuid');
        
        var cookieOptions = {
            path: '/',
            domain: location.hostname.indexOf('kv-analytics.kiotviet.vn') >= 0 ? '.kv-analytics.kiotviet.vn' : '',
            secure: location.protocol === 'https:',
            expires: new Date(Date.now() + 10*365*24*3600*1000)
        }

        if (typeof kvaUuid === 'undefined' || kvaUuid === null) {
            kvaUuid = generateUUID();
            Cookies("kvas-uuid", kvaUuid, cookieOptions);
            Cookies("kvas-uuid-d", new Date().getTime(), cookieOptions);
        }
    }
    
    function initGUUID() {
        var Cookies = kvas.cookie;
        gkvaUuid = Cookies('gkvas-uuid'); 
        
        var cookieOptions = {
            path: '/',
            domain: location.hostname.indexOf('kiotviet.vn') >= 0 ? 'kiotviet.vn': '',
            secure: location.protocol === 'https:',
            expires: new Date(Date.now() + 10*365*24*3600*1000)
        }

        if (typeof gkvaUuid === 'undefined' || gkvaUuid === null) {
            gkvaUuid = generateUUID();
            Cookies("gkvas-uuid", gkvaUuid, cookieOptions);
            Cookies("gkvas-uuid-d", new Date().getTime(), cookieOptions);
        }
    }
    
    function initSS() {
        var Cookies = kvas.cookie;
        ssUuid = Cookies('kv-session'); 
        
        var cookieOptions = {
            path: '/',
            domain: location.hostname.indexOf('kv-analytics.kiotviet.vn') >= 0 ? '.kv-analytics.kiotviet.vn' : '',
            secure: location.protocol === 'https:',
            expires: new Date(Date.now() + 30*60*1000)
        }

        if (typeof ssUuid === 'undefined' || ssUuid === null) {
            ssUuid = generateUUID();
        }

        Cookies("kv-session", ssUuid, cookieOptions);
        Cookies("kv-session-d", new Date().getTime(), cookieOptions);
        return ssUuid;
    }

    function get(url, queryStr, callback) {
        queryStr += '&z=' + Math.floor(Math.random() * (1000000000));

        //if (navigator.sendBeacon) {
        //    navigator.sendBeacon(url, queryStr);
        //   return;
        //}
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function() {
            if (this.readyState == 4 && this.status == 200) {
                if (typeof callback != 'function') return;

                try {
                    callback.call(xhttp.responseText);
                } catch (e){
                    console.log(e);
                }
            }
        };
        url = url + '?' + queryStr;
        xhttp.open("GET", url, true);
        xhttp.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhttp.send();
    }

    function get2(url, data, callback) {
		 
		var out = [];
		for (var key in data) {
			if (data.hasOwnProperty(key)) {
				out.push(key + '=' + encodeURIComponent(data[key]));
			}
		}
		queryStr = out.join('&');

        if (navigator.sendBeacon) {
            navigator.sendBeacon(url, queryStr);
            return;
        }
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function() {
            if (this.readyState == 4 && this.status == 200) {
                if (typeof callback != 'function') return;

                try {
                    callback.call(xhttp.responseText);
                } catch (e){
                    console.log(e);
                }
            }
        };
        url = url + '?' + queryStr;
        xhttp.open("GET", url, true);
        xhttp.send();
    }

    function post(url, data, callback) {
        if (navigator.sendBeacon) {
            var headers = {
                type: 'application/x-www-form-urlencoded'
            };
            var blob = new Blob([data], headers);
            navigator.sendBeacon(url, blob);
            return;
        }
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function() {
            if (this.readyState == 4 && this.status == 200) {
                if (typeof callback != 'function') return;

                try {
                    callback.call(xhttp.responseText);
                } catch (e){
                    console.log(e);
                }
            }
        };

        xhttp.open("POST", url, true);
        xhttp.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhttp.send(data);
    }

    initUUID();
    initGUUID();
    initSS();

    var queue = window.kva.q || {}

    window.kva = function(){
        var args = arguments;
        var firstParameter = args[0];
        if (firstParameter === 'create') {
            var data = {
                trackingId: args[1],
                cookieDomain: args[2],
                name: args.length >= 4 ? args[3] : "t0"
            }
            if (args.length === 5) {
                var obj = args[4];
                transferToObj(obj, data);
            }
			 
            TrackerFactory.create(data);
            return;
        }
        
        var tracker = getTracker(args[0]);

        var method =  getMethod(args[0]);
		
		//console.log(method);
		//console.log(tracker[method]);
        tracker[method].call(tracker, args);
    }

    TrackerFactory = {
        create: function(obj){
            var t = new Tracker(obj);
			
            trackerMap[t.name] = t;
        }
    }

    var trackerMap = {};

    function transferToObj(src, des) {
        for (var key in src) {
            des[key] = src[key];
        }
    }

    var fieldMap = {
        'campaignName' : 'cn', 
        'campaignSource' : 'cs',
        'campaignMedium': 'cm',
        'campaignKeyword': 'ck',
        'campaignContent': 'cc',
        'campaignId': 'ci',
        'productId': 'product_id',
        'contentAction': 'ca',
        'searchId': 'si',
        'referrer': 'dr'
    }

    function transferToObjWithFieldMap(src, des) {
        for (var key in src) {
            if (fieldMap[key] !== undefined) {
                des[fieldMap[key]] = src[key];
            }
        }
    }

    function Tracker(obj){
        this.name = obj.name;
        this.cookieDomain = obj.cookieDomain === 'auto' ? 'kv-analytics.kiotviet.vn' : obj.cookieDomain;
        this.clientId = obj['clientId'] !== undefined ? obj.clientId : kvaUuid;
        this.gClientId = obj['gClientId'] !== undefined ? obj.gClientId : gkvaUuid;
        this.ssId = obj['ssId'] !== undefined ? obj.ssId : ssUuid;
        this.trackingId = obj.trackingId;
        if (obj['userId'] !== undefined) {
            this.userId = obj['userId'];
        }
    }

    function SystemInfo() {
        this.de = document.charset;
        this.vp = document.defaultView.innerWidth + 'x' + document.defaultView.innerHeight;
        this.sr = window.screen.availWidth + 'x' + window.screen.availHeight;
        this.sd = screen.colorDepth;
        this.ul = navigator.language;
        this.je = navigator.javaEnabled() ? 1 : 0;
        this.fl = '0';
    }

    function PageInfo() {
        this.dl = window.location.href;
        this.dt = document.title;
    }

    var systemInfo = new SystemInfo();

    Tracker.prototype = {
        set : function (data) {
            var key = data[1];
            var val = data[2];
            if (val !== null) {
                this[key] = val;
            } else {
                delete this[key];
            }
        },
        send : function (data) {
            var pageInfo = new PageInfo();
            var hitType = data[1];

            if (hitType === 'pageview' || hitType === 'shipping' || hitType === 'load_shipping') {
                var dataSend = {
                    v: 1,
                    t: hitType,
                    source:this.name,
                    cid: this.clientId,
                    gcid: this.gClientId,
                    kv_session: initSS(),
                    de: systemInfo.de,
                    je: systemInfo.je,
                    ul: systemInfo.ul,
                    dl: pageInfo.dl,
                    sd: systemInfo.sd,
                    sr: systemInfo.sr,
                    dt: pageInfo.dt,
                    tid: this.trackingId,
                    vp: systemInfo.vp
                };
                if (this['userId'] !== undefined) {
                    dataSend['uid'] = this.userId;
                }
                if (data[2] !== undefined) {
                    dataSend['dp'] = data[2];
                }
                if (data[3] !== undefined) {
                    var obj = data[3];
                    transferToObjWithFieldMap(obj, dataSend);
                }

                var qtr = toQueryString(dataSend);

                get('https://kv-analytics.kiotviet.vn/kv_cl', qtr);
            } else if (hitType === 'event') {
                var dataSend = {
                    v: 1,
                    t: hitType,
                    cid: this.clientId,
                    gcid: this.gClientId,
                    kv_session: initSS(),
                    source:this.name,
                    de: systemInfo.de,
                    je: systemInfo.je,
                    ul: systemInfo.ul,
                    dl: pageInfo.dl,
                    sd: systemInfo.sd,
                    sr: systemInfo.sr,
                    dt: pageInfo.dt,
                    tid: this.trackingId,
                    vp: systemInfo.vp,
                    ec: data[2],
                    ea: data[3]
                }
                if (data[4] !== undefined) {
                    if (typeof(data[4]) === 'object') {
                        dataSend['ep'] = JSON.stringify(data[4]);
                    } else {
                        dataSend['el'] = data[4];
                    }
                }
                if (data[5] !== undefined && typeof(data[5]) === 'number') {
                    dataSend['ev'] = data[5];
                }
                if (data[6] !== undefined) {
                    var obj = data[6];
                    transferToObjWithFieldMap(obj, dataSend);
                } 
                if (this['userId'] !== undefined) {
                    dataSend['uid'] = this.userId;
                }

                var qtr = toQueryString(dataSend);

                get('https://kv-analytics.kiotviet.vn/kv_cl', qtr);
            } else {
                console.log('Unsupport hit type => ' + hitType);
            }
        }
    }

    var getUrlParameter = function(sParam) {
        var sPageURL = decodeURIComponent(window.location.search.substring(1)), 
                        sURLVariables = sPageURL.split('&'), sParameterName, i;

        for (i = 0; i < sURLVariables.length; i++) {
            sParameterName = sURLVariables[i].split('=');

            if (sParameterName[0] === sParam) {
                return sParameterName[1] === undefined ? true : sParameterName[1];
            }
        }
    };

    function toQueryString(data) {
        var str = '';
        for (var key in data) {
            var val = data[key];
            str += key + '=' + encodeURIComponent(val) + '&';
        }
        str = str.substring(0, str.length - 1);
        return str;
    }

    function getTracker(nameStr) {
        var name = nameStr.indexOf('.') > -1 ? nameStr.split('.')[0] : 't0';
		
        return trackerMap[name];
    }

    function getMethod(str) {
        return str.indexOf('.') >- 1 ? str.split('.')[1] : str;
    }

    if (queue.constructor === Array) {
        for (var i = 0; i < queue.length; i++) {
            kva.apply(kva, queue[i]);
        }
    }
}

)();