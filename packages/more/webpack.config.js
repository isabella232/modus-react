/* eslint-disable indent */
const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const AddAssetHtmlPlugin = require('add-asset-html-webpack-plugin');

const projectRoot = process.env.INIT_CWD;

const sourceDir = path.join(projectRoot, process.env.SOURCE_DIR);
const buildDir = path.join(projectRoot, process.env.BUILD_DIR);
const dllDir = path.join(__dirname, 'dll');
const dllManifest = require(path.join(dllDir, 'libs-manifest.json'));

const shouldUseSourceMap =
  process.env.SOURCEMAPS.toLowerCase() === 'false' || false;

const { NODE_ENV = 'production' } = process.env;

const stats = {
  assets: true,
  children: false,
  chunks: false,
  hash: false,
  modules: false,
  publicPath: false,
  timings: true,
  version: false,
  warnings: true,
  colors: {
    green: '\u001b[32m',
  },
};

process.noDeprecation = true;

const isProd = NODE_ENV === 'production';
const isDev = !isProd;

// style files regexes
const cssRegex = /\.css$/;
const cssModuleRegex = /\.module\.css$/;
const sassRegex = /\.(scss|sass)$/;
const sassModuleRegex = /\.module\.(scss|sass)$/;

const babelCacheDirectory = path.join(
  __dirname,
  '.cache',
  'babel',
  isProd ? 'prod' : 'dev'
);
const cacheLoaderDirectory = path.join(
  __dirname,
  '.cache',
  'cache-loader',
  isProd ? 'prod' : 'dev'
);

// common function to get style loaders
const getStyleLoaders = (cssOptions, preProcessor) => {
  const loaders = [
    isDev && {
      loader: require.resolve('cache-loader'),
      options: { cacheDirectory: cacheLoaderDirectory },
    },
    isDev && require.resolve('style-loader'),
    isProd && {
      loader: MiniCssExtractPlugin.loader,
    },
    {
      loader: require.resolve('css-loader'),
      options: cssOptions,
    },
    {
      loader: require.resolve('postcss-loader'),
      options: {
        ident: 'postcss',
        plugins: () => [
          require('postcss-flexbugs-fixes'),
          require('postcss-preset-env')({
            autoprefixer: {
              flexbox: 'no-2009',
            },
            stage: 3,
          }),
        ],
        sourceMap: isProd && shouldUseSourceMap,
      },
    },
  ].filter(Boolean);
  if (preProcessor) {
    loaders.push({
      loader: require.resolve(preProcessor),
      options: {
        sourceMap: isProd && shouldUseSourceMap,
      },
    });
  }
  return loaders;
};

module.exports = {
  mode: isProd ? 'production' : 'development',
  optimization: {
    namedModules: true,
    noEmitOnErrors: true,
  },
  entry: {
    app: [
      // activate HMR for React
      isDev && 'react-hot-loader/patch',

      // the entry point of our app
      sourceDir,
    ].filter(Boolean),
  },

  output: {
    path: isProd ? buildDir : undefined,
    filename: isProd ? '[name].[contenthash:6].js' : '[name].js',
    chunkFilename: isProd
      ? '[name].[contenthash:6].chunk.js'
      : '[chunkname].chunk.js',
  },

  plugins: [
    // setting production environment will strip out
    // some of the development code from the app
    // and libraries
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify(NODE_ENV),
      },
    }),

    // import dll manifest
    isDev &&
      new webpack.DllReferencePlugin({
        context: path.resolve(__dirname), //path.resolve(projectRoot), //path.resolve(__dirname, '.'),
        manifest: dllManifest,
      }),

    new HtmlWebpackPlugin(
      Object.assign(
        {},
        {
          inject: true,
        },
        isProd
          ? {
              minify: {
                removeComments: true,
                collapseWhitespace: true,
                removeRedundantAttributes: true,
                useShortDoctype: true,
                removeEmptyAttributes: true,
                removeStyleLinkTypeAttributes: true,
                keepClosingSlash: true,
                minifyJS: true,
                minifyCSS: true,
                minifyURLs: true,
              },
            }
          : undefined
      )
    ),

    // make DLL assets available for the app to download
    isDev &&
      new AddAssetHtmlPlugin([
        {
          filepath: path.join(dllDir, 'libs.dll.js'),
          includeSourcemap: false,
        },
      ]),

    isDev && new webpack.HotModuleReplacementPlugin(),
  ].filter(Boolean),

  module: {
    strictExportPresence: true,
    rules: [
      // Disable require.ensure as it's not a standard language feature.
      { parser: { requireEnsure: false } },
      {
        // "oneOf" will traverse all following loaders until one will
        // match the requirements. When no loader matches it will fall
        // back to the "file" loader at the end of the loader list.
        oneOf: [
          // "url" loader works like "file" loader except that it embeds assets
          // smaller than specified limit in bytes as data URLs to avoid requests.
          // A missing `test` is equivalent to a match.
          {
            test: [/\.bmp$/, /\.gif$/, /\.jpe?g$/, /\.png$/],
            loader: require.resolve('url-loader'),
            options: {
              limit: 10000,
              name: 'static/media/[name].[hash:8].[ext]',
            },
          },
          // Process application JS with Babel.
          // The preset includes JSX, Flow, TypeScript, and some ESnext features.
          {
            test: /\.(js|mjs|jsx|ts|tsx)$/,
            include: sourceDir,
            use: [
              {
                loader: require.resolve('cache-loader'),
                options: { cacheDirectory: cacheLoaderDirectory },
              },
              {
                loader: require.resolve('babel-loader'),
                options: {
                  cacheDirectory: babelCacheDirectory,
                  // cacheCompression: isProd,
                  compact: isProd,
                },
              },
            ],
          },
          // Process any JS outside of the app with Babel.
          // Unlike the application JS, we only compile the standard ES features.
          {
            test: /\.(js|mjs)$/,
            exclude: /@babel(?:\/|\\{1,2})runtime/,
            use: [
              {
                loader: require.resolve('cache-loader'),
                options: { cacheDirectory: cacheLoaderDirectory },
              },
              {
                loader: require.resolve('babel-loader'),
                options: {
                  cacheDirectory: path.join(
                    __dirname,
                    '.cache',
                    isProd ? 'prod' : 'dev'
                  ),
                  cacheCompression: isProd,
                  compact: isProd,
                  sourceMaps: false,
                },
              },
            ],
          },
          // "postcss" loader applies autoprefixer to our CSS.
          // "css" loader resolves paths in CSS and adds assets as dependencies.
          // "style" loader turns CSS into JS modules that inject <style> tags.
          // In production, we use MiniCSSExtractPlugin to extract that CSS
          // to a file, but in development "style" loader enables hot editing
          // of CSS.
          // By default we support CSS Modules with the extension .module.css
          {
            test: cssRegex,
            exclude: cssModuleRegex,
            use: getStyleLoaders({
              importLoaders: 1,
              sourceMap: isProd && shouldUseSourceMap,
            }),
            // Don't consider CSS imports dead code even if the
            // containing package claims to have no side effects.
            // Remove this when webpack adds a warning or an error for this.
            // See https://github.com/webpack/webpack/issues/6571
            sideEffects: true,
          },
          // Adds support for CSS Modules (https://github.com/css-modules/css-modules)
          // using the extension .module.css
          {
            test: cssModuleRegex,
            use: getStyleLoaders({
              importLoaders: 1,
              sourceMap: isProd && shouldUseSourceMap,
              modules: true,
              getLocalIdent: isProd
                ? '[hash:base64:5]'
                : '[path][name]__[local]',
            }),
          },
          // Opt-in support for SASS (using .scss or .sass extensions).
          // By default we support SASS Modules with the
          // extensions .module.scss or .module.sass
          {
            test: sassRegex,
            exclude: sassModuleRegex,
            use: getStyleLoaders(
              {
                importLoaders: 2,
                sourceMap: isProd && shouldUseSourceMap,
              },
              'sass-loader'
            ),
            // Don't consider CSS imports dead code even if the
            // containing package claims to have no side effects.
            // Remove this when webpack adds a warning or an error for this.
            // See https://github.com/webpack/webpack/issues/6571
            sideEffects: true,
          },
          // Adds support for CSS Modules, but using SASS
          // using the extension .module.scss or .module.sass
          {
            test: sassModuleRegex,
            use: getStyleLoaders(
              {
                importLoaders: 2,
                sourceMap: isProd && shouldUseSourceMap,
                modules: true,
                getLocalIdent: isProd
                  ? '[hash:base64:5]'
                  : '[path][name]__[local]',
              },
              'sass-loader'
            ),
          },
          // "file" loader makes sure those assets get served by WebpackDevServer.
          // When you `import` an asset, you get its (virtual) filename.
          // In production, they would get copied to the `build` folder.
          // This loader doesn't use a "test" so it will catch all modules
          // that fall through the other loaders.
          {
            loader: require.resolve('file-loader'),
            // Exclude `js` files to keep "css" loader working as it injects
            // its runtime that would otherwise be processed through "file" loader.
            // Also exclude `html` and `json` extensions so they get processed
            // by webpacks internal loaders.
            exclude: [/\.(js|mjs|jsx|ts|tsx)$/, /\.html$/, /\.json$/],
            options: {
              name: 'static/media/[name].[hash:8].[ext]',
            },
          },
          // ** STOP ** Are you adding a new loader?
          // Make sure to add the new loader(s) before the "file" loader.
        ],
      },
    ],
  },

  resolve: {
    modules: [path.resolve(__dirname, './node_modules'), sourceDir],
    symlinks: false,
  },

  stats,

  node: {
    dgram: 'empty',
    fs: 'empty',
    net: 'empty',
    tls: 'empty',
    child_process: 'empty',
  },

  devServer: {
    contentBase: sourceDir,
    publicPath: '/',
    historyApiFallback: {
      rewrites: [{ from: /./, to: '/index.html' }],
    },
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
    watchOptions: {
      ignored: ['node_modules', '*.svg'],
    },
    hot: true,
    inline: true,
    compress: false,
    disableHostCheck: true,
    stats,
  },
};
