
document.getElementById("button_start").onclick = function() {
	self.port.emit("goToURL",document.getElementById("input_URL").value);
};