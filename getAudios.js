const fs = require("fs");

function getAudios(path) {
  let tree = { files: [] };
  recursiveDirs(tree, path);
  return tree;
}

function recursiveDirs(tree, path) {
  let files = fs.readdirSync(path);

  files.forEach(fileName => {
    let dotIndex = fileName.indexOf(".");

    if (dotIndex !== -1) {
      let type = fileName.slice(dotIndex + 1, fileName.length);

      if (type !== "md") {
        let command = fileName.slice(0, dotIndex);
        tree.files.push({
          command: `.${command}`,
          file: `${path}/${fileName}`,
          type: type
        });
      }
    } else {
      if (!tree.dirs) {
        tree.dirs = {};
      }

      tree.dirs[fileName] = { files: [] };
      recursiveDirs(tree["dirs"][fileName], path + "/" + fileName);
    }
  });
}

module.exports = getAudios;
