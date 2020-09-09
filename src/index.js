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
    const { outputDir, patterns, clean } = options;
    this.outputDir = outputDir || 'dist';
    this.patterns = patterns || [];
    this.clean = clean === undefined ? true : clean;

    this.outputDir = escapeBackSlash(this.outputDir);
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

      if (this.clean) {
        const { context } = compiler;
        this.patterns.forEach(({ to }) => {
          fs.removeSync(path.join(context, to));
        });
      }

      const { assets } = compilation;
      Object.keys(assets).forEach((name) => {
        let newName = normalizePath(path.join(this.outputDir, name));
        for (const { from, to } of this.patterns) {
          if (newName.indexOf(from) > -1) {
            newName = newName.replace(from, to);
            newName = path.join('..', newName);
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
