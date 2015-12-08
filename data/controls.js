
document.getElementById("button_go").onclick = function() {
	console.log("Waw")
	self.port.emit("command_go",document.getElementById("text_in").value);
	console.log("Waw2")
};
document.getElementById("button_go_file").onclick = function() {
	console.log("Wow")
	self.port.emit("command_go_file",document.getElementById("text_in").value);
	console.log("Wow2")
};