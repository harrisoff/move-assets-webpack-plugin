# move-assets-webpack-plugin

## 作用

效果上来说，是在构建结束后，把构建产物移动到指定目录。

原理上来说，是在构建过程中修改 assets 的输出路径，直接输出到指定目录，而不是在构建完成后再移动。

**如果使用 create-react-app，请务必看一下后面提到的 @vue/cli 和 create-react-appp 的区别**。

## 使用

```bash
npm install move-assets-webpack-plugin -D
```

```js
const MoveAssetsPlugin = require("move-assets-webpack-plugin")

new MoveAssetsPlugin({
  // 原始输出目录，默认为 dist
  outputDir: 'dist',
  // 匹配规则，暂不支持通配符，如 js/*.js
  patterns: [
    {
      from: 'dist/static',
      to: '../be/public/static'
    },
    {
      from: 'dist/index.html',
      to: '../be/view/index.html'
    },
  ]
})
```

## 为什么要用

为什么不编写专门的脚本，或者直接修改 `webpack.config.js`/`vue.config.js` 配置文件呢？

编写额外的脚本，一个比较明显的缺点是脱离了 webpack 的构建流程，无法访问到 webpack 中定义的环境变量。

对于使用 `webpack.config.js` 的场景，确实可以直接修改配置，不过如果涉及到的文件路径比较多，可能会导致配置复杂，可读性变差，插件能够在原始配置不变的条件下提供一个修改的接口。

对于使用脚手架工具的场景，以 `@vue/cli` 为例，`vue.config.js` 提供的相关配置较少，基本只能移动整个 `dist`，无法单独操作其中的文件。

`@vue/cli` 打包出来的 `dist` 通常是这样的：

```
+ dist/
  + js/
  + css/
  + index.html
```

如果后端的目录结构不支持直接把 `dist` 整个复制，比如像这样：

```
+ WebRoot/
  + public/
    + js/
    + css/
  + WEB-INF/
    + view/
      + index.html
```

> 对，说的就是我们公司

这时，可能就需要这个插件了。

## 开发相关

### 为什么要修改构建流程

为什么要在构建过程中修改输出目录，而不是等构建完成之后再移动？

在文件写到硬盘之后的某个 `hook` 里使用 `fs` 等模块移动文件是一个看上去简单可行的做法。

但是问题在于，`@vue/cli` 和 `create-react-app` 等脚手架工具会在构建完成后输出一份经过 gzip 压缩后的文件大小的数据，这部分逻辑是在 webpack 构建流程之后的，并且会使用 webpack 返回的 `assets` 数据。如果在这之前把文件移动到了其他目录，就会报错了。

### @vue/cli 和 create-react-app 的区别

首先说一下结论：**使用 `create-react-app` 时，本插件对从 `public` 复制到 `build` 的文件无效。**

因为这两者对 `public` 中文件的处理是不同的。

`@vue/cli` 使用 [copy-webpack-plugin](https://github.com/webpack-contrib/copy-webpack-plugin) 处理 `public` 中的文件，其原理是把文件添加到 `compilation.assets`，借用 webpack 的能力把文件输出到 `dist`，并不是真的从 `public` 复制到 `dist`。

换句话说，使用 `@vue/cli` 时，所有输出到 `dist` 的文件都会存在于 `compilation.assets` 中，因此本插件可以操作 `dist` 目录中的所有文件。

而 `create-react-app` 对 `public` 的处理就是真的复制粘贴了，其构建脚本中有专门用于复制文件的函数，并且先复制 `public`，然后再启动 webpack 构建流程。

也就是说，使用 `create-react-app` 时，public 中的文件是不会被添加到 `compilation.assets` 的，那么对于这部分文件，本插件就无能为力了。
