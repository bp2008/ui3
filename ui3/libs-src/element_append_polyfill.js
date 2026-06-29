if (!Element.prototype.append) {
  Element.prototype.append = function () {
    for (var i = 0; i < arguments.length; i++) {
      var node = arguments[i];
      if (!(node instanceof Node)) {
        node = document.createTextNode(String(node));
      }
      this.appendChild(node);
    }
  };
}