const fs = require("fs");
const Tree = require("../model/Tree");

/**
 * Get all audios in the path as object
 * @param {String} path - path of the directory with the audios files
 * @returns {}
 */
function getAudiosTree(path) {
  let tree = new Tree();
  recursiveDirs(tree, path);
  return tree;
}

/**
 * Mount the tree of file recursively
 * @param {Object} tree - tree with the
 * @param {String} path - path of the directory with the audios files
 */
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

      tree.dirs[fileName] = new Tree();
      recursiveDirs(tree["dirs"][fileName], path + "/" + fileName);
    }
  });
}

module.exports = { getAudiosTree };
