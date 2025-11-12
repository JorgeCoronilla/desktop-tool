const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const ReactRefreshTypeScript = require('react-refresh-typescript');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const dotenv = require('dotenv');
const env = dotenv.config().parsed || {};

module.exports = (envArgs, argv) => {
  const isDev = argv && argv.mode === 'development';
  const isAnalyze = process.env.ANALYZE === 'true' || argv.analyze;

  return {
    mode: isDev ? 'development' : 'production',
    entry: './src/renderer/index.tsx',
    target: 'web',
    externalsPresets: {
      electronRenderer: false,
    },
    devtool: isDev ? 'source-map' : false,
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: {
            loader: 'ts-loader',
            options: {
              configFile: 'tsconfig.renderer.json',
              transpileOnly: true,
              ...(isDev ? { getCustomTransformers: () => ({ before: [ReactRefreshTypeScript()] }) } : {}),
            }
          },
          exclude: /node_modules/,
        },
        {
          test: /\.module\.css$/,
          use: [
            'style-loader',
            {
              loader: 'css-loader',
              options: {
                esModule: true,
                modules: {
                  mode: 'local',
                  localIdentName: '[name]__[local]--[hash:base64:5]',
                  exportLocalsConvention: 'camelCase',
                },
              },
            },
          ],
        },
        {
          test: /\.css$/,
          exclude: /\.module\.css$/,
          use: ['style-loader', 'css-loader'],
        },
      ],
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      fallback: {
        "global": false,
        "events": require.resolve('events/'),
        "path": false,
        "fs": false
      }
    },
    // Do not externalize Node built-ins for renderer; allow bundling/polyfills for dev server
    node: {
      __dirname: false,
      __filename: false
    },
    output: {
      filename: isDev ? '[name].bundle.js' : '[name].[contenthash].js',
      path: path.resolve(__dirname, 'dist'),
      clean: true,
    },
    optimization: {
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
            name: 'react',
            chunks: 'all',
          },
        },
      },
      usedExports: true,
      sideEffects: false,
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/renderer/index.html',
      }),
      new webpack.DefinePlugin({
        global: 'globalThis',
        'process.env.OPENAI_API_KEY': JSON.stringify(env.OPENAI_API_KEY || ''),
        'process.env.OPENAI_MODEL': JSON.stringify(env.OPENAI_MODEL || 'gpt-4o'),
      }),
      ...(isDev ? [new ReactRefreshWebpackPlugin()] : []),
      ...(isAnalyze ? [new BundleAnalyzerPlugin({
        analyzerMode: 'static',
        openAnalyzer: false,
        reportFilename: 'bundle-report.html',
      })] : []),
    ],
    ...(isDev ? {
      devServer: {
        static: {
          directory: path.join(__dirname, 'dist'),
        },
        compress: true,
        port: 3002,
        hot: true,
        liveReload: true,
        client: {
          overlay: true,
        },
      }
    } : {}),
  };
};