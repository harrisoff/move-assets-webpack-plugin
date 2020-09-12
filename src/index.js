const path = require('path');
const fs = require('fs-extra');

function normalizePath(p) {
  return path.normalize(p);
}

function escapeBackSlash(p) {
  return p.replace(/\\/g, '/');
}

class MoveAssetsPlugin {
  constructor(options = {}) {
    // TODO: validation
    const { patterns, clean } = options;
    this.patterns = patterns || [];
    this.clean = clean === undefined ? true : clean;

    this.patterns = this.patterns.map(({ from, to }) => ({
      from: normalizePath(escapeBackSlash(from)),
      to: normalizePath(escapeBackSlash(to)),
    }));
  }

  apply(compiler) {
    const plugin = {
      name: 'move-assets-webpack-plugin',
    };

    compiler.hooks.emit.tap(plugin, (compilation) => {
      if (this.patterns.length === 0) return;

      const { outputPath } = compiler;
      const webpackContext = compiler.context;
      const outputDirWithCwd = path.relative(webpackContext, outputPath);
      const revertPath = path.relative(outputPath, webpackContext);

      if (this.clean) {
        this.patterns.forEach(({ to }) => {
          fs.removeSync(path.join(webpackContext, to));
        });
      }

      const { assets } = compilation;
      Object.keys(assets).forEach((name) => {
        // patterns start with `outputDir` yet `name` is relative to it
        // so `outputDir` should be added to `from` as a prefix
        let newName = normalizePath(path.join(outputDirWithCwd, name));
        for (const { from, to } of this.patterns) {
          if (newName.indexOf(from) > -1) {
            newName = newName.replace(from, to);
            // revert the prefix
            newName = path.join(revertPath, newName);

            assets[newName] = assets[name];
            delete assets[name];
            break;
          }
        }
      });
    });
  }
}

module.exports = MoveAssetsPlugin;
