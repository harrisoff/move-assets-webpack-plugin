// basically a copy of
// https://github.com/johnagan/clean-webpack-plugin/blob/master/src/clean-webpack-plugin.test.ts

const path = require('path');
const { TempSandbox } = require('temp-sandbox');
const webpackActual = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const MoveAssetsPlugin = require('../src');

const sandbox = new TempSandbox({ randomDir: true });

// utils

function normalizePath(p) {
  return path.normalize(p);
}

function resolvePath(p) {
  return normalizePath(sandbox.path.resolve(p));
}

// front-end
const feRootPath = resolvePath('fe');
const feSourcePath = resolvePath('fe/src');
const feEntryPath = resolvePath('fe/src/index.js');
const fePublicPath = resolvePath('fe/public');
const feViewPath = resolvePath('fe/public/index.html');
const feIcoPath = resolvePath('fe/public/favicon.ico');
const feLibPath = resolvePath('fe/public/js/libs/jq.js');
const feDistPath = resolvePath('fe/dist');
// back-end
const beCssPath = resolvePath('be/public/css/app.css');
const beJsPath1 = resolvePath('be/public/js/app-old.js');
const beJsPath2 = resolvePath('be/public/js/1-old.js');
const beLibPath = resolvePath('be/public/libs/jq-old.js');
const beViewPath1 = resolvePath('be/view/index.html');
const beViewPath2 = resolvePath('be/view/log.html');

/** dir structure
 * + fe/
 *   + dist/
 *     + index.html
 *     + js/
 *       + index.js
 *       + 1.js
 *       + libs/
 *         + jq.js
 * + be/
 *   + public/
 *     + css/
 *       + app.css
 *     + js/
 *       + ...
 *     + libs/
 *       + ...
 *   + view/
 *     + index.html
 *     + log.html
 */

// webpack

// https://github.com/webpack/webpack/pull/11438
function extentStats(stats) {
  // eslint-disable-next-line
  stats.getErrors = () => [].concat(
    ...stats.compilation.errors,
    ...stats.compilation.children
      .filter((child) => child.getStats().hasErrors())
      .map((child) => child.getStats().getErrors()),
  );
}

function webpack(options = {}) {
  const compiler = webpackActual(options);

  const runAsync = () => new Promise((resolve, reject) => {
    compiler.run((error, stats) => {
      extentStats(stats);
      if (error || stats.hasErrors()) {
        reject(error || stats.getErrors());
        return;
      }
      resolve(stats);
    });
  });

  return { ...compiler, run: runAsync };
}

// sandbox

function createSrcBundle(numberOfBundles = 1) {
  let entryFileContents = '\'use strict\';\n\n';
  let count = 1;
  while (count < numberOfBundles) {
    const filename = `${count}.js`;

    entryFileContents = `${entryFileContents}
      require.ensure([], function(require){ require('./${filename}')}, '${count}');`;

    sandbox.createFileSync(
      `${feSourcePath}/${filename}`,
      // eslint-disable-next-line no-useless-concat
      '\'use strict\';\n\n' + `module.exports = '${filename}';`,
    );

    count += 1;
  }

  sandbox.createFileSync(feEntryPath, entryFileContents);
}

function createOldFiles() {
  // be/public/css
  sandbox.createFileSync(
    beCssPath,
    '#app { font-weight: bold; }',
  );
  // be/public/js
  sandbox.createFileSync(
    beJsPath1,
    '\'use strict\';\n\n; module.exports = "app.js";',
  );
  sandbox.createFileSync(
    beJsPath2,
    '\'use strict\';\n\n; module.exports = "chunk.js";',
  );
  // be/public/libs
  sandbox.createFileSync(
    beLibPath,
    '\'use strict\';\n\n; var jQuery = {};',
  );
  // be/view
  sandbox.createFileSync(
    beViewPath1,
    '<!doctype html><html><head><title>index.html</title></head><body></body></html>',
  );
  sandbox.createFileSync(
    beViewPath2,
    '<!doctype html><html><head><title>log.html</title></head><body></body></html>',
  );
}

function createNewFiles() {
  // fe/src
  createSrcBundle(2);
  // fe/public/index.html
  sandbox.createFileSync(
    feViewPath,
    '<!doctype html><html><head><title>index.html</title></head><body></body></html>',
  );
  // fe/public/js/libs
  sandbox.createFileSync(
    feLibPath,
    '\'use strict\';\n\n; var jQuery = {};',
  );
  // fe/public/favicon.ico
  sandbox.createFileSync(
    feIcoPath,
    '',
  );
}

const cwd = process.cwd();
beforeEach(() => {
  process.chdir(sandbox.dir);
  sandbox.cleanSync();
});
afterEach(() => {
  process.chdir(cwd);
});
afterAll(() => {
  sandbox.destroySandboxSync();
  process.chdir(cwd);
});

test('do not delete old files', async () => {
  createOldFiles();
  createNewFiles();

  const options = {
    // vue.config.js
    entry: {
      app: [
        './src/index.js',
      ],
    },
    context: feRootPath,
    output: {
      path: feDistPath,
      filename: 'js/[name].js',
      publicPath: '/',
      chunkFilename: 'js/[name].js',
    },

    plugins: [
      new HtmlWebpackPlugin({
        template: feViewPath,
      }),
      new CopyPlugin({
        patterns: [
          {
            from: fePublicPath,
            to: feDistPath,
            globOptions: {
              ignore: [
                'index.html',
              ],
            },
          },
        ],
      }),
      new MoveAssetsPlugin({
        outputDir: 'dist',
        clean: false,
        patterns: [
          {
            from: 'dist/index.html',
            to: '../be/view/index.html',
          },
          {
            from: 'dist/js/libs',
            to: '../be/public/libs',
          },
          {
            from: 'dist/js',
            to: '../be/public/js',
          },
        ],
      }),
    ],
  };
  const stats = await webpack(options).run();

  expect(Object.keys(stats.compilation.assets).map(normalizePath).sort())
    .toEqual([
      '../../be/public/js/1.js',
      '../../be/public/js/app.js',
      '../../be/view/index.html',
      '../../be/public/libs/jq.js',
      'favicon.ico',
    ].map(normalizePath).sort());

  const fileList = await sandbox.getFileList();
  expect(fileList.map(normalizePath).sort())
    .toEqual([
      // be
      'be/view/index.html',
      'be/view/log.html',
      'be/public/css/app.css',
      'be/public/js/1.js',
      'be/public/js/app.js',
      'be/public/libs/jq.js',
      // be old
      'be/public/js/1-old.js',
      'be/public/js/app-old.js',
      'be/public/libs/jq-old.js',
      // fe
      'fe/src/1.js',
      'fe/src/index.js',
      'fe/public/index.html',
      'fe/public/js/libs/jq.js',
      'fe/public/favicon.ico',
      'fe/dist/favicon.ico',
    ].map(normalizePath).sort());
});

test('delete old files', async () => {
  createOldFiles();
  createNewFiles();

  const options = {
    // vue.config.js
    entry: {
      app: [
        './src/index.js',
      ],
    },
    context: feRootPath,
    output: {
      path: feDistPath,
      filename: 'js/[name].js',
      publicPath: '/',
      chunkFilename: 'js/[name].js',
    },

    plugins: [
      new HtmlWebpackPlugin({
        template: feViewPath,
      }),
      new CopyPlugin({
        patterns: [
          {
            from: fePublicPath,
            to: feDistPath,
            globOptions: {
              ignore: [
                'index.html',
              ],
            },
          },
        ],
      }),
      new MoveAssetsPlugin({
        outputDir: 'dist',
        patterns: [
          {
            from: 'dist/index.html',
            to: '../be/view/index.html',
          },
          {
            from: 'dist/js/libs',
            to: '../be/public/libs',
          },
          {
            from: 'dist/js',
            to: '../be/public/js',
          },
        ],
      }),
    ],
  };
  const stats = await webpack(options).run();

  expect(Object.keys(stats.compilation.assets).map(normalizePath).sort())
    .toEqual([
      '../../be/public/js/1.js',
      '../../be/public/js/app.js',
      '../../be/view/index.html',
      '../../be/public/libs/jq.js',
      'favicon.ico',
    ].map(normalizePath).sort());

  const fileList = await sandbox.getFileList();
  expect(fileList.map(normalizePath).sort()).toEqual([
    // be
    'be/view/index.html',
    'be/view/log.html',
    'be/public/css/app.css',
    'be/public/js/1.js',
    'be/public/js/app.js',
    'be/public/libs/jq.js',
    // fe
    'fe/src/1.js',
    'fe/src/index.js',
    'fe/public/index.html',
    'fe/public/js/libs/jq.js',
    'fe/public/favicon.ico',
    'fe/dist/favicon.ico',
  ].map(normalizePath).sort());
});

test('use backslash', async () => {
  createOldFiles();
  createNewFiles();

  const options = {
    // vue.config.js
    entry: {
      app: [
        './src/index.js',
      ],
    },
    context: feRootPath,
    output: {
      path: feDistPath,
      filename: 'js/[name].js',
      publicPath: '/',
      chunkFilename: 'js/[name].js',
    },

    plugins: [
      new HtmlWebpackPlugin({
        template: feViewPath,
      }),
      new CopyPlugin({
        patterns: [
          {
            from: fePublicPath,
            to: feDistPath,
            globOptions: {
              ignore: [
                'index.html',
              ],
            },
          },
        ],
      }),
      new MoveAssetsPlugin({
        outputDir: 'dist',
        patterns: [
          {
            from: 'dist\\index.html',
            to: '../be/view/index.html',
          },
          {
            from: 'dist/js/libs',
            to: '../be\\public\\libs',
          },
          {
            from: 'dist/js',
            to: '../be/public/js',
          },
        ],
      }),
    ],
  };
  const stats = await webpack(options).run();
  expect(Object.keys(stats.compilation.assets).map(normalizePath).sort())
    .toEqual([
      '../../be/public/js/1.js',
      '../../be/public/js/app.js',
      '../../be/view/index.html',
      '../../be/public/libs/jq.js',
      'favicon.ico',
    ].map(normalizePath).sort());

  const fileList = await sandbox.getFileList();
  expect(fileList.map(normalizePath).sort())
    .toEqual([
      // be
      'be/view/index.html',
      'be/view/log.html',
      'be/public/css/app.css',
      'be/public/js/1.js',
      'be/public/js/app.js',
      'be/public/libs/jq.js',
      // fe
      'fe/src/1.js',
      'fe/src/index.js',
      'fe/public/index.html',
      'fe/public/js/libs/jq.js',
      'fe/public/favicon.ico',
      'fe/dist/favicon.ico',
    ].map(normalizePath).sort());
});
