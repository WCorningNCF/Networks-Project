var self = require('sdk/self');
var { setInterval } = require("sdk/timers");
var events = require("sdk/system/events");
var {Ci,Cu} = require("chrome");

var tabs = require("sdk/tabs");
Cu.import("resource://gre/modules/osfile.jsm")
var tryGetHeader = function(channel,hName) {
	try {
		return(channel.getRequestHeader(hName));
	}
	catch(e) {
		return("");
	}
}

var isListening = true;
var httpRecords = [];

var HttpRecord = function(messageType,time,headers) {
	var self = this;
	self.messageType = messageType;
	self.timeNumeric = time.getTime();
	self.timeString = time.getHours()+":"+time.getMinutes()+":"+time.getSeconds()+"."+time.getMilliseconds();
	self.headers = headers;
	console.log(self.timeString + " " + self.messageType);

	//console.log(self);
}

var requestListener = function(event) {
	if(isListening) {
		var now = new Date();
		var channel = event.subject.QueryInterface(Ci.nsIHttpChannel);
		
		var headers = {};

		channel.visitRequestHeaders(function(header,value) {
			headers[header] = value;
		});
		httpRecords.push(new HttpRecord("Request",now,headers));

		/*
		var host = tryGetHeader(channel,"Host");
		var content_type =  tryGetHeader(channel,"Content-Type");
		var accept = tryGetHeader(channel,"Accept");
		console.log("\n"+time);
		console.log("\t"+channel.URI.asciiSpec);
		console.log("\t"+host);
		console.log("\t"+content_type+" "+accept);

		if(host!=="a1.nyt.com"&&host!=="www.nytimes.com"&&host!=="graphics8.nytimes.com") {
			console.log("!!!!!!!!!!!! Trying host deny")
			channel.setRequestHeader("Host","",false);
		}

		/*
		console.log(time)
		var s = "";
		channel.visitRequestHeaders(function(header,value) {
			s += header + " : " + value + "; ";
		});
		console.log(s+"\n\n");
		*/
	}
}

var responseListener = function(event) {
	if(isListening) {
		var now = new Date();
		var channel = event.subject.QueryInterface(Ci.nsIHttpChannel);
		
		var headers = {};

		channel.visitResponseHeaders(function(header,value) {
			headers[header] = value;
		});
		httpRecords.push(new HttpRecord("Response",now,headers));
	}
}

events.on("http-on-modify-request",requestListener);

events.on("http-on-examine-response",responseListener);

tabs.on("ready",function(tab) {
	console.log(tab.url);
	worker = tab.attach({
		contentScriptFile: ["./jquery.min.js","./scriptTracker.js"],
		contentScript: '$("script").css("color","red");'
	});
	worker.port.on("scriptTrackerMessage", function(payload) {
		OS.File.writeAtomic("scripts.txt", payload); 
	});
});


var stillTalkingTracker = setInterval(function() {
	if(isListening) {
		if(Date.now() > httpRecords[httpRecords.length-1].timeNumeric + 10000) {
			isListening = false
			doneTalking();
			console.log("Finished logging events; writing to file");
			OS.File.writeAtomic("httpRecords.txt", JSON.stringify(httpRecords)); 
		}
	}
}, 2500);

var doneTalking = function() {clearInterval(stillTalkingTracker);};

/*
events.on("cookie-changed",listener)
events.on("cookie-rejected",listener)
*/

