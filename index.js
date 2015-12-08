var self = require('sdk/self');
var { setInterval, clearInterval } = require("sdk/timers");
var events = require("sdk/system/events");
var {Ci,Cu} = require("chrome");

var {TextDecoder, OS} = Cu.import("resource://gre/modules/osfile.jsm", {});

var { getActiveView }=require("sdk/view/core");
var timers = require('sdk/timers');
var tabs = require("sdk/tabs");
Cu.import("resource://gre/modules/osfile.jsm")


var panel = require("sdk/panel").Panel({
	width: 320,
	height: 68,
	position: {
		bottom: 0,
		left: 0
	},
	contentURL: "./controlPanel.html",
	contentScriptFile: "./controls.js"
});
getActiveView(panel).setAttribute("noautohide", true);
panel.show();

var HttpRequestRecord = function(channel,pageReady) {
	var time = new Date();
	var myself = this;
	myself.messageType = "Request";
	myself.timeNumeric = time.getTime();
	myself.timeString = time.getHours()+":"+time.getMinutes()+":"+time.getSeconds()+"."+time.getMilliseconds();

	myself.location = {
		URI: channel.URI.asciiSpec,
		host: channel.URI.host,
		path: channel.URI.path
	};
	
	//myself.contentLength = channel.contentLength;
	myself.headers = {};
	myself.afterPageReady = pageReady;

	channel.visitRequestHeaders(function(header,value) {
		myself.headers[header] = value;
	});
}
var HttpResponseRecord = function(channel,pageReady) {
	var time = new Date();
	var myself = this;
	myself.messageType = "Response";
	myself.timeNumeric = time.getTime();
	myself.timeString = time.getHours()+":"+time.getMinutes()+":"+time.getSeconds()+"."+time.getMilliseconds();

	myself.location = {
		URI: channel.URI.asciiSpec,
		host: channel.URI.host,
		path: channel.URI.path
	};

	//myself.contentLength = channel.contentLength;
	myself.headers = {};
	myself.afterPageReady = pageReady;

	channel.visitResponseHeaders(function(header,value) {
		myself.headers[header] = value;
	});
}

var site_lists_path = "~/Desktop/cn/Networks_Project/data/site-lists/"
var decoder = new TextDecoder();

var readSites = function(fname) {
	fpath = "/home/wiley/Desktop/cn/Networks_Project/data/site-lists/"+fname
	console.log("Reading URLs from file " + fpath);
	OS.File.read(fpath).then(
	 	function onSuccess(data) {
	 		obj = JSON.parse(decoder.decode(data));
	    	console.log(obj);
	    	visitAllSites(fixURIs(obj.sites),fname.split(".json")[0]);
  		},
  		function onFailure(reason) {
	 		console.log("Failed to read sites file:")
  			console.log(reason);
  		}
  	)
}

// Complete partial URIs, e.g. NYTimes.com -> http://www.nytimes.com
var fixURIs = function(uris) {
	fixed = [];
	for(var i = 0; i < uris.length; i++) {
		var u = uris[i].toLowerCase();

		// Note: this is kind of crude, may not always work
		if(u.split('.').length<3) {u = "www." + u;}
		if(u.substring(0,4)!="http") {u = "http://"+u;}

		fixed.push(u);
	}
	return(fixed);
}

var visitAllSites = function(sites_list, subdir) {
	var timeout = 5000;
	var N = sites_list.length;
	
	var doRecursivePromise = function(idx) {
		console.log("Visiting site " + (idx+1) + " of " + N);

		// Get a promise that we are visiting the site at this index
		p = visitSite(sites_list[idx],subdir,timeout);
		// When promise is fulfilled (i.e. tab is closed), start the next promise
		if(idx+1 < N) {
			p.then(function() {
				doRecursivePromise(idx+1);
			});
		}
	}

	//Create subdirectory for this dataset and start the loop
	OS.File.makeDir("sites/"+subdir).then(doRecursivePromise(0));
}

var visitSite = function(site_url,subdir,timeout) {
	return(new Promise(function(resolve, reject) {
		console.log("Going to URL " + site_url + (timeout ? " with timeout " + timeout : ""));

		var httpRecords = [];
		var isReady = false;
		var onRequest  = function(event){httpRecords.push(new HttpRequestRecord (event.subject.QueryInterface(Ci.nsIHttpChannel),isReady));}
		var onResponse = function(event){httpRecords.push(new HttpResponseRecord(event.subject.QueryInterface(Ci.nsIHttpChannel),isReady));}

		var timeInfo = {};

		// We assume the sites directory (and the subdirectory, if one is specified) already exist
		var dir = "sites/" + (subdir ? subdir+"/" : "") + require("sdk/url").URL(site_url).host;
		OS.File.makeDir(dir).then(
			function() {
				tabs.open({
					url: site_url,
					isPinned: false,
					onOpen: function onOpen(tab) {
						timeInfo.open=new Date().getTime()
						events.on("http-on-modify-request",  onRequest );
						events.on("http-on-examine-response",onResponse);

					},
					onLoad: function onLoad(tab) {
						timeInfo.load=new Date().getTime()
						isReady = true;
						console.log("Page fully loaded; collecting scripts");
						worker = tab.attach({
							contentScriptFile: ["./jquery.min.js","./scriptTracker.js"],
							contentScript: '$("script").css("color","red");'
						});
						worker.port.on("scriptTrackerMessage", function(payload) {
							OS.File.writeAtomic(dir+"/scripts.json", payload); 
						});
						if(timeout) {
							timers.setTimeout(function(){tab.close()},timeout);
						}
					},
					onClose: function onClose(tab) {
						timeInfo.close=new Date().getTime()
						events.off("http-on-modify-request",  onRequest );
						events.off("http-on-examine-response",onResponse);

						console.log("Writing HTTP events to file");
						OS.File.writeAtomic(dir+"/httpRecords.json", JSON.stringify(httpRecords));
						OS.File.writeAtomic(dir+"/timeInfo.json",JSON.stringify(timeInfo));
						resolve("Finished visiting URL " + site_url);

					} // Paren hell
				});
			}
		)
	}));
}


panel.port.on("command_go", function(payload) {
	visitSite(payload);
});

panel.port.on("command_go_file", function(payload) {
	console.log("Whew");
	readSites(payload);
	console.log("Whew2");
});

/*
events.on("cookie-changed",listener)
events.on("cookie-rejected",listener)
*/

