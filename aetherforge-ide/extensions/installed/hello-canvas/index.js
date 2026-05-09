// Hello Canvas plugin for AetherForge IDE
// Registers a command that adds a button node to the visual canvas.

exports.activate = function (aetherforgeAPI) {
  aetherforgeAPI.commands.register('hello-canvas.addButton', function () {
    var existingNodes = aetherforgeAPI.canvas.getNodes();
    var x = 80 + (existingNodes.length % 5) * 160;
    var y = 80 + Math.floor(existingNodes.length / 5) * 120;

    aetherforgeAPI.canvas.addNode({
      componentType: 'button',
      label: 'Hello from Plugin!',
      x: x,
      y: y,
      props: { text: 'Hello from Plugin!' }
    });

    aetherforgeAPI.toast.show('Hello Canvas: button node added to canvas!', 'success');
  });
};
