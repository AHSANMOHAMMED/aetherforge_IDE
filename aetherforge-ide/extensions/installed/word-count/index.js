// Word Count plugin for AetherForge IDE
// Registers a command that counts words in the current workspace file.

exports.activate = function (aetherforgeAPI) {
  aetherforgeAPI.commands.register('word-count.count', async function () {
    var workspacePath = aetherforgeAPI.workspace.getWorkspacePath();
    if (!workspacePath) {
      aetherforgeAPI.toast.show('No workspace open. Please open a folder first.', 'error');
      return;
    }
    // Read package.json as a representative "current file" for demonstration
    var filePath = workspacePath + '/package.json';
    try {
      var content = await aetherforgeAPI.workspace.readFile(filePath);
      var words = content
        .trim()
        .split(/\s+/)
        .filter(function (w) {
          return w.length > 0;
        });
      aetherforgeAPI.toast.show('Word count: ' + words.length + ' words in package.json', 'info');
    } catch (e) {
      aetherforgeAPI.toast.show('Could not read file: ' + String(e), 'error');
    }
  });
};
