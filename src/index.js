const path = require('path');
const fs = require('fs-extra');

function normalizePath(p) {
  return path.normalize(p).replace(/\\/g, '/');
}

class MoveAssetsPlugin {
  constructor(options = {}) {
    const { outputDir, patterns } = options;
    this.outputDir = outputDir || 'dist';
    this.patterns = patterns || [];
  }

  apply(compiler) {
    const plugin = {
      name: 'move-assets-webpack-plugin',
    };

    compiler.hooks.emit.tap(plugin, (compilation) => {
      if (this.patterns.length === 0) return;

      const { context } = compiler;
      const { assets } = compilation;

      this.patterns.forEach(({ to }) => {
        fs.removeSync(path.join(context, to));
      });

      Object.keys(assets).forEach((name) => {
        let newName = normalizePath(path.join(this.outputDir, name));
        for (const pattern of this.patterns) {
          const from = normalizePath(pattern.from);
          if (newName.match(from)) {
            const to = normalizePath(pattern.to);
            newName = newName.replace(from, to);
            newName = path.join('../', newName);
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
