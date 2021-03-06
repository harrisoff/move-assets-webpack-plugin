# move-assets-webpack-plugin

[![windows build status](https://github.com/harrisoff/move-assets-webpack-plugin/workflows/windows%20build/badge.svg)](https://github.com/harrisoff/move-assets-webpack-plugin/actions?query=workflow%3A%22windows+build%22)
[![linux build status](https://github.com/harrisoff/move-assets-webpack-plugin/workflows/linux%20build/badge.svg)](https://github.com/harrisoff/move-assets-webpack-plugin/actions?query=workflow%3A%22linux+build%22)
[![codecov coverage](https://img.shields.io/codecov/c/github/harrisoff/move-assets-webpack-plugin/master.svg)](https://codecov.io/gh/harrisoff/move-assets-webpack-plugin/)

[![npm download](https://img.shields.io/npm/dt/move-assets-webpack-plugin.svg)](https://www.npmjs.com/package/move-assets-webpack-plugin)
[![npm version](https://badge.fury.io/js/move-assets-webpack-plugin.svg)](https://www.npmjs.com/package/move-assets-webpack-plugin)
![license](https://img.shields.io/npm/l/move-assets-webpack-plugin.svg?sanitize=true)

[![npm](https://nodei.co/npm/move-assets-webpack-plugin.png?compact=true)](https://www.npmjs.com/package/move-assets-webpack-plugin)

- [Documentation](https://github.com/harrisoff/move-assets-webpack-plugin/blob/master/README.md)
- [文档](https://github.com/harrisoff/move-assets-webpack-plugin/blob/master/README.zh-CN.md)

## Features

Move the output files to other directories after the build.

Technically, this plugin modifies the asset's path while compiling, so the files are directly written to the target directory, rather than moved after the build.

If the output looks like this:

```
+ dist/
  + js/
  + css/
  + index.html
```

However you have to move the files separately into the backend directory, like this:

```
+ WebRoot/
  + public/
    + js/
    + css/
  + WEB-INF/
    + view/
      + index.html
```

Now you may need this plugin.

**⚠️ If you are using create-react-app, please make sure to check the differences between @vue/cli and create-react-app mentioned at the end.**

**⭐ If this plugin helped, please [star the repo](https://github.com/harrisoff/move-assets-webpack-plugin), Thanks!**

## Getting Started

```bash
npm install move-assets-webpack-plugin -D
```

```js
const MoveAssetsPlugin = require("move-assets-webpack-plugin")

new MoveAssetsPlugin({
  clean: true,
  patterns: [
    {
      from: 'dist/static',
      // files in `to` will be deleted
      // unless `clean` is set to `false`
      to: '../be/public/static'
    },
    {
      from: 'dist/index.html',
      to: '../be/view/index.html'
    },
  ]
})
```

## Options

### patterns

Type: Array

Default: `[]`

Required: false

Match Rules. Wildcard characters like `js/*.js` are not supported yet. The plugin will not work if `patterns` is an empty array.

All the paths are relative to the `context` of `webpack.config.js`.

### clean

Type: Boolean

Default: `true`

Required: false

Whether delete old files. Old files are files the `to` field given in the option `patterns` refer to.

`false` could not guarantee that the old files would always be kept. If new files have same names as the old files, old files will be overwritten.

## Attention

### The Order of Plugins

**In short, always put this plugin at the end of the `plugins` option.**

This plugin must be placed after plugins that may add files to `compilation.assets`, or when this plugin is called, files not added are unable to be processed.

For example, [html-webpack-plugin](https://github.com/jantimon/html-webpack-plugin) adds a html file to `compilation.assets`. If MoveAssetsPlugin is called before HtmlWebpackPlugin, the rules operating html files will not work because the html file is not added to `compilation.assets` yet.

### The Order of Patterns

Rules that are more specific should be placed ahead.

```js
const patterns = [
  {
    from: 'dist/js/libs',
    to: '../be/public/libs'
  },
  {
    from: 'dist/js',
    to: '../be/public/js'
  }
]
```

In this case `dist/js/libs` is more specific than `dist/js`, so it should be in front of `dist/js`.

## Why Using This Plugin

Why not write a script, or just edit `webpack.config`/`vue.config.js`?

The shortcoming of writing a script is that the script is out of the webpack build process, making the webpack environment variables inaccessible.

When using `webpack.config.js`, it does work by editing the config file, however the config will become complicated if there are too many paths to edit. This plugin offers an interface so that you don't have to change the original config.

For cli users, such as `@vue/cli`, it does not offer many relative options. Basically you can only move the entire `dist`, and it's hard to move files in it.

## Development

### Why Changing the Compiling Process?

It seems an easy and efficient way to move the outputs using modules like `fs` in a `hook` after all files are written to the disk.

So why modifying the asset's path during compiling process instead of moving after the build process?

Here's the problem, `@vue/cli` and `create-react-app` will calculate the gzipped sizes of files after the build, and this is after the webpack build process and will use the `assets` data returned by webpack. An error will be thrown if files are moved to other directories.

### The Differences Between @vue/cli And create-react-app

The conclusion is: **When using `create-react-app`, this plugin is unable to move files copied from `public` to `build`.**

This is because those two take different measures to process the `public` files.

`@vue/cli` uses [copy-webpack-plugin](https://github.com/webpack-contrib/copy-webpack-plugin) to handle files in `public` directory, which adds `public` files to `compilation.assets`. With the ability of webpack the files are written to new directories. This is not a real copy-paste process.

In other words, all files in the `dist` existed in `compilation.assets`, so this plugin is able to operate all of them.

`create-react-app` does a real copy-paste to `public`. There is a function used to copy files in the build script, and the webpack build process is after the copy process.

Now that `public` files will not be added to `compilation.assets`, this plugin is unable to process those files.
