var self = require('sdk/self');
var { setInterval, clearInterval } = require("sdk/timers");
var events = require("sdk/system/events");
var {Ci,Cu} = require("chrome");
var { getActiveView }=require("sdk/view/core");
var tabs = require("sdk/tabs");
Cu.import("resource://gre/modules/osfile.jsm")


var panel = require("sdk/panel").Panel({
	width: 400,
	height: 100,
	contentURL: "./controlPanel.html",
	contentScriptFile: "./controls.js"
});
getActiveView(panel).setAttribute("noautohide", true);
panel.show();



globals = {
	isListening: false,
	httpRecords: [],
}

var tryGetHeader = function(channel,hName) {
	try {
		return(channel.getRequestHeader(hName));
	}
	catch(e) {
		return("");
	}
}



var HttpRequestRecord = function(channel) {
	var time = new Date();
	var myself = this;
	myself.messageType = "Request";
	myself.timeNumeric = time.getTime();
	myself.timeString = time.getHours()+":"+time.getMinutes()+":"+time.getSeconds()+"."+time.getMilliseconds();

	myself.location = {
		URI: channel.URI.asciiSpec,
		host: channel.URI.host,
		path: channel.URI.path
	}
	
	//myself.contentLength = channel.contentLength;
	myself.headers = {};

	channel.visitRequestHeaders(function(header,value) {
		myself.headers[header] = value;
	});
}
var HttpResponseRecord = function(channel) {
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

	channel.visitResponseHeaders(function(header,value) {
		myself.headers[header] = value;
	});
}

panel.port.on("goToURL", function(payload) {
	console.log("Going to URL " + payload);
	
	var httpRecords = [];
	var onRequest  = function(event){httpRecords.push(new HttpRequestRecord (event.subject.QueryInterface(Ci.nsIHttpChannel)));}
	var onResponse = function(event){httpRecords.push(new HttpResponseRecord(event.subject.QueryInterface(Ci.nsIHttpChannel)));}

	tabs.open({
		url: payload,
		isPinned: false,
		onOpen: function onOpen(tab) {
			events.on("http-on-modify-request",  onRequest );
			events.on("http-on-examine-response",onResponse);
		},
		onReady: function onReady(tab) {
			console.log("Collecting scripts from " + tab.url);
			worker = tab.attach({
				contentScriptFile: ["./jquery.min.js","./scriptTracker.js"],
				contentScript: '$("script").css("color","red");'
			});
			worker.port.on("scriptTrackerMessage", function(payload) {
				OS.File.writeAtomic("scripts.txt", payload); 
			});
		},
		onClose: function onClose(tab) {
			events.off("http-on-modify-request",  onRequest );
			events.off("http-on-examine-response",onResponse);

			console.log("Writing HTTP events to file");
			OS.File.writeAtomic("httpRecords.txt", JSON.stringify(httpRecords));

		}
	});
});

/*
events.on("cookie-changed",listener)
events.on("cookie-rejected",listener)
*/

