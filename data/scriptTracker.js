var scriptElements = $("script")
var s = "";
for (var i = 0; i < scriptElements.length; i++) {
	s += (scriptElements[i].src ? scriptElements[i].src : "Inline script") + "\n"
}
self.port.emit("scriptTrackerMessage",s);