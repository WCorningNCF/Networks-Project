var dynNodes = $("script, object, embed, iframe");

var info = [];

var dynDescriptor = function(node) {
	var self = this;
	self.type = node.nodeName;
	self.location = node.src ? node.src : (node.data ? node.data : "Inline:" + node.innerHTML.length);
}

for (var i = 0; i < dynNodes.length; i++) {
	info.push(new dynDescriptor(dynNodes[i]));
}

//console.log(info)
self.port.emit("scriptTrackerMessage",JSON.stringify(info));