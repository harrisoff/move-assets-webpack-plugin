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
const feNestedCwdPath = resolvePath('fe/cwd');
const feNestedDistPath = resolvePath('fe/cwd/dist');
const feOuterDistPath = resolvePath('dist');
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
  // note that the working directory is `/`
  process.chdir(sandbox.dir);
  sandbox.cleanSync();
  createOldFiles();
  createNewFiles();
});
afterEach(() => {
  process.chdir(cwd);
});
afterAll(() => {
  sandbox.destroySandboxSync();
  process.chdir(cwd);
});

const baseOptions = {
  // vue.config.js
  entry: {
    app: [
      './src/index.js',
    ],
  },
  context: feRootPath, // /fe
  output: {
    path: feDistPath, // fe/dist
    filename: 'js/[name].js',
    publicPath: '/',
    chunkFilename: 'js/[name].js',
  },
  plugins: [],
};
const basePlugins = [
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
];

// context

test('1. output context is nested in webpack context', async () => {
  // /fe/cwd
  sandbox.createDirSync(feNestedCwdPath);
  process.chdir(feNestedCwdPath);

  const options = {
    ...baseOptions,
    output: undefined, // /fe/cwd/dist
    plugins: [
      new HtmlWebpackPlugin({
        template: feViewPath,
      }),
      new CopyPlugin({
        patterns: [
          {
            from: fePublicPath,
            to: feNestedDistPath,
            globOptions: {
              ignore: [
                'index.html',
              ],
            },
          },
        ],
      }),
      new MoveAssetsPlugin({
        patterns: [
          {
            from: 'cwd/dist/index.html',
            to: '../be/view/index.html',
          },
          {
            from: 'cwd/dist',
            to: '../be/public',
          },
        ],
      }),
    ],
  };
  const stats = await webpack(options).run();

  expect(Object.keys(stats.compilation.assets).map(normalizePath).sort())
    .toEqual([
      '../../../be/view/index.html',
      '../../../be/public/1.js',
      '../../../be/public/app.js',
      '../../../be/public/js/libs/jq.js',
      '../../../be/public/favicon.ico',
    ].map(normalizePath).sort());

  const fileList = await sandbox.getFileList();
  expect(fileList.map(normalizePath).sort())
    .toEqual([
      // be old
      'be/view/log.html',
      // be
      'be/view/index.html',
      'be/public/1.js',
      'be/public/app.js',
      'be/public/js/libs/jq.js',
      'be/public/favicon.ico',
      // fe
      'fe/src/1.js',
      'fe/src/index.js',
      'fe/public/index.html',
      'fe/public/js/libs/jq.js',
      'fe/public/favicon.ico',
    ].map(normalizePath).sort());
});

test('2. output context is out of webpack context', async () => {
  const options = {
    ...baseOptions,
    output: undefined, // /dist
    plugins: [
      new HtmlWebpackPlugin({
        template: feViewPath,
      }),
      new CopyPlugin({
        patterns: [
          {
            from: fePublicPath,
            to: feOuterDistPath,
            globOptions: {
              ignore: [
                'index.html',
              ],
            },
          },
        ],
      }),
      new MoveAssetsPlugin({
        patterns: [
          {
            from: '../dist/index.html',
            to: '../be/view/index.html',
          },
          {
            from: '../dist',
            to: '../be/public',
          },
        ],
      }),
    ],
  };
  const stats = await webpack(options).run();

  expect(Object.keys(stats.compilation.assets).map(normalizePath).sort())
    .toEqual([
      '../be/view/index.html',
      '../be/public/1.js',
      '../be/public/app.js',
      '../be/public/js/libs/jq.js',
      '../be/public/favicon.ico',
    ].map(normalizePath).sort());

  const fileList = await sandbox.getFileList();
  expect(fileList.map(normalizePath).sort())
    .toEqual([
      // be old
      'be/view/log.html',
      // be
      'be/view/index.html',
      'be/public/1.js',
      'be/public/app.js',
      'be/public/js/libs/jq.js',
      'be/public/favicon.ico',
      // fe
      'fe/src/1.js',
      'fe/src/index.js',
      'fe/public/index.html',
      'fe/public/js/libs/jq.js',
      'fe/public/favicon.ico',
    ].map(normalizePath).sort());
});

// options

test('3. bad patterns orders', async () => {
  const options = {
    ...baseOptions,
    plugins: [
      ...basePlugins,
      new MoveAssetsPlugin({
        patterns: [
          {
            from: 'dist/index.html',
            to: '../be/view/index.html',
          },
          {
            from: 'dist/js',
            to: '../be/public/js',
          },
          {
            from: 'dist/js/libs',
            to: '../be/public/libs',
          },
        ],
      }),
    ],
  };
  const stats = await webpack(options).run();

  expect(Object.keys(stats.compilation.assets).map(normalizePath).sort())
    .toEqual([
      '../../be/view/index.html',
      '../../be/public/js/1.js',
      '../../be/public/js/app.js',
      '../../be/public/js/libs/jq.js',
      'favicon.ico',
    ].map(normalizePath).sort());

  const fileList = await sandbox.getFileList();
  expect(fileList.map(normalizePath).sort())
    .toEqual([
      // be old
      'be/view/log.html',
      'be/public/css/app.css',
      // be
      'be/view/index.html',
      'be/public/js/1.js',
      'be/public/js/app.js',
      'be/public/js/libs/jq.js',
      // fe
      'fe/src/1.js',
      'fe/src/index.js',
      'fe/public/index.html',
      'fe/public/js/libs/jq.js',
      'fe/public/favicon.ico',
      'fe/dist/favicon.ico',
    ].map(normalizePath).sort());
});

test('4. no options', async () => {
  const options = {
    ...baseOptions,
    plugins: [
      ...basePlugins,
      new MoveAssetsPlugin(),
    ],
  };
  const stats = await webpack(options).run();

  expect(Object.keys(stats.compilation.assets).map(normalizePath).sort())
    .toEqual([
      'index.html',
      'js/1.js',
      'js/app.js',
      'js/libs/jq.js',
      'favicon.ico',
    ].map(normalizePath).sort());

  const fileList = await sandbox.getFileList();
  expect(fileList.map(normalizePath).sort())
    .toEqual([
      // be old
      'be/view/index.html',
      'be/view/log.html',
      'be/public/js/1-old.js',
      'be/public/js/app-old.js',
      'be/public/libs/jq-old.js',
      'be/public/css/app.css',
      // fe
      'fe/src/1.js',
      'fe/src/index.js',
      'fe/public/index.html',
      'fe/public/js/libs/jq.js',
      'fe/public/favicon.ico',
      'fe/dist/index.html',
      'fe/dist/js/1.js',
      'fe/dist/js/app.js',
      'fe/dist/js/libs/jq.js',
      'fe/dist/favicon.ico',
    ].map(normalizePath).sort());
});

test('5. keep old files', async () => {
  const options = {
    ...baseOptions,
    plugins: [
      ...basePlugins,
      new MoveAssetsPlugin({
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
      '../../be/view/index.html',
      '../../be/public/js/1.js',
      '../../be/public/js/app.js',
      '../../be/public/libs/jq.js',
      'favicon.ico',
    ].map(normalizePath).sort());

  const fileList = await sandbox.getFileList();
  expect(fileList.map(normalizePath).sort())
    .toEqual([
      // be old
      'be/view/log.html',
      'be/public/js/1-old.js',
      'be/public/js/app-old.js',
      'be/public/libs/jq-old.js',
      'be/public/css/app.css',
      // be
      'be/view/index.html',
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

// others

test('6. use backslash', async () => {
  const options = {
    ...baseOptions,
    plugins: [
      ...basePlugins,
      new MoveAssetsPlugin({
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
      '../../be/view/index.html',
      '../../be/public/js/1.js',
      '../../be/public/js/app.js',
      '../../be/public/libs/jq.js',
      'favicon.ico',
    ].map(normalizePath).sort());

  const fileList = await sandbox.getFileList();
  expect(fileList.map(normalizePath).sort())
    .toEqual([
      // be old
      'be/view/log.html',
      'be/public/css/app.css',
      // be
      'be/view/index.html',
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

test('7. dist in outer directory', async () => {
  const options = {
    ...baseOptions,
    output: {
      ...baseOptions.output,
      path: feOuterDistPath,
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: feViewPath,
      }),
      new CopyPlugin({
        patterns: [
          {
            from: fePublicPath,
            to: feOuterDistPath,
            globOptions: {
              ignore: [
                'index.html',
              ],
            },
          },
        ],
      }),
      new MoveAssetsPlugin({
        // in this case, '../be' is out of the sandbox
        // so use './be' instead
        patterns: [
          {
            from: '../dist/index.html',
            to: '../be/view/index.html',
          },
          {
            from: '../dist/js/libs',
            to: '../be/public/libs',
          },
          {
            from: '../dist/js',
            to: '../be/public/js',
          },
        ],
      }),
    ],
  };
  const stats = await webpack(options).run();

  expect(Object.keys(stats.compilation.assets).map(normalizePath).sort())
    .toEqual([
      '../be/view/index.html',
      '../be/public/js/1.js',
      '../be/public/js/app.js',
      '../be/public/libs/jq.js',
      'favicon.ico',
    ].map(normalizePath).sort());

  const fileList = await sandbox.getFileList();
  expect(fileList.map(normalizePath).sort())
    .toEqual([
      // be old
      'be/view/log.html',
      'be/public/css/app.css',
      // be
      'be/view/index.html',
      'be/public/js/1.js',
      'be/public/js/app.js',
      'be/public/libs/jq.js',
      // fe
      'fe/src/1.js',
      'fe/src/index.js',
      'fe/public/index.html',
      'fe/public/js/libs/jq.js',
      'fe/public/favicon.ico',
      'dist/favicon.ico',
    ].map(normalizePath).sort());
});
