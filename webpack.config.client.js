/**
 * webpack config for client files
 */

import fs from 'fs';
import path from 'path';
import webpack from 'webpack';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import sourceMapping from './scripts/sourceMapping.js';
import LicenseListWebpackPlugin from './scripts/LicenseListWebpackPlugin.cjs';
import JavaScriptObfuscator from 'webpack-obfuscator';

/*
 * make sure we build in root dir
 */
process.chdir(import.meta.dirname);

const pkg = JSON.parse(
  fs.readFileSync(path.resolve('package.json')),
);

export default ({ development, analyze}) => {
  const babelPlugins = [];
  /*
   * In development mode, we resolve translations to the default english.
   * In production mode we remove the ttag import and build the tags into the
   * bundle (as if they would be globals) and then resolve translations in
   * post-processing to build language based bundles.
   *
   * NOTE: The production output bundle isn't useable without processing it
   * first
   */
  if (development) {
    babelPlugins.push([
      'ttag', { resolve: { translations: 'default' } },
    ]);
  } else {
    babelPlugins.push([
      'ttag', {
        extract: { output: path.resolve('i18n', 'template.pot') },
        addComments: 't:',
        sortByMsgid: true,
      },
    ]);
    // babelPlugins.push([
    //   "transform-remove-imports", { "test": "^ttag$" },
    // ]);
  }

  return {
    name: 'client',
    target: 'web',

    mode: (development) ? 'development' : 'production',
    devtool: (development) ? 'source-map' : false,

    entry: {
      client:
        [path.resolve('src', 'client.js')],
      globe:
        [path.resolve('src', 'globe.js')],
      popup:
        [path.resolve('src', 'popup.js')],
    },

    output: {
      path: path.resolve('dist', 'public', 'assets'),
      publicPath: '/assets/',
      /*
       * chunkReason is set if it is a split chunk like vendor or three, which
       * will not include any translation strings.
       * All other js assets will get the language attached to their name, with
       * a WPLANGCODE placer if its in production, because we postprocess that,
       * and generate language bundles out of it.
       */
      filename: (pathData) => (pathData.chunk.chunkReason)
        ? '[name].[chunkhash:8].js'
        : `[name].${(development) ? 'en' : 'WPLANGCODE'}.[chunkhash:8].js`,
      chunkFilename: `[name].${(development) ? 'en' : 'WPLANGCODE'}.[chunkhash:8].js`,
    },

    resolve: {
      alias: {
        /*
         * if we don't do that,we might load different versions of three
         */
        three: path.resolve('node_modules', 'three'),
      },
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
    },

    module: {
      rules: [
        {
          test: /\.svg$/,
          use: [
            'babel-loader',
            {
              loader: 'react-svg-loader',
              options: {
                svgo: {
                  plugins: [
                    { removeViewBox: false },
                    { removeDimensions: true },
                  ],
                },
                jsx: false,
              },
            },
          ],
        },
        {
          test: /\.(js|jsx|ts|tsx)$/,
          use: [
            {
              loader: 'babel-loader',
              options: {
                plugins: babelPlugins,
              },
            },
          ],
          include: [
            path.resolve('src'),
            ...['image-q'].map((moduleName) => (
              path.resolve('node_modules', moduleName)
            )),
          ],
        },
      ],
    },

    plugins: [
      // Define free variables
      // https://webpack.github.io/docs/list-of-plugins.html#defineplugin
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': development ? '"development"' : '"production"',
        'process.env.BROWSER': true,
        'process.env.PKG_NAME': `"${pkg.name}"`,
        'process.env.PKG_VERSION': `"${pkg.version}"`,
        'process.env.FILE_STORAGE_ORIGIN': `"${process.env.FILE_STORAGE_ORIGIN}"`,
      }),
      
      ...(!development ? [
        new JavaScriptObfuscator({
          // Базовые настройки (безопасные)
          compact: true,
          controlFlowFlattening: true,
          controlFlowFlatteningThreshold: 0.75, // 75% кода будет преобразовано
          deadCodeInjection: true,
          // deadCodeInjectionThreshold: 0.4, // Добавит мертвый код в 40% функций
          debugProtection: false, // ОСТОРОЖНО: может вызывать проблемы с отладкой
          // debugProtectionInterval: 0, // ОСТОРОЖНО: может вызывать проблемы с отладкой
          disableConsoleOutput: false, // Не отключаем console.log для отладки
          identifierNamesGenerator: 'hexadecimal', // Используем hex имена переменных
          
          // Настройки для строк (хорошо запутывают, но безопасны)
          log: false,
          numbersToExpressions: true, // Преобразует числа в выражения
          simplify: true, // Упрощает некоторые выражения
          stringArray: true,
          stringArrayEncoding: ['base64'], // Кодирует строки в base64
          stringArrayIndexShift: true, // Сдвигает индексы массива строк
          stringArrayWrappersCount: 2, // Добавляет обертки для доступа к строкам
          stringArrayWrappersChainedCalls: true,
          stringArrayWrappersParametersMaxCount: 4,
          stringArrayWrappersType: 'function',
          stringArrayThreshold: 0.75, // 75% строк будут помещены в массив
          
          // Другие преобразования
          rotateStringArray: true, // Перемешивает массив строк
          selfDefending: false, // ОСТОРОЖНО: может вызывать проблемы
          shuffleStringArray: true, // Перемешивает массив строк
          splitStrings: true,
          splitStringsChunkLength: 10, // Разбивает длинные строки
          unicodeEscapeSequence: false, // Лучше false для совместимости
          
          // Безопасные настройки для переименования
          renameGlobals: false, // ОПАСНО: может сломать интеграцию с другими скриптами
          renameProperties: false, // ОПАСНО: может сломать доступ к свойствам объектов
          transformObjectKeys: false, // ОПАСНО: может сломать доступ по ключам

          // Настройки source map (если нужны для отладки)
          sourceMap: false, // В production обычно false
          sourceMapBaseUrl: '',
          sourceMapFileName: '',
          sourceMapMode: 'separate',

          // Настройки для domain lock (если нужно)
          domainLock: [], // Оставить пустым для всех доменов

          seed: 0,

          target: 'browser',

          exclude: [
            /node_modules/,
            /\.map$/,
            /\.css$/,
            /\.svg$/,
            /\.json$/,
            /\.html$/,
          ]
        }, [
          // Исключите определенные файлы из обфускации (опционально)
          'vendor.js',
          'pvendor.js', 
          'three.js',
          'vendor.*.js',
          'pvendor.*.js', 
          'three.*.js',
        ])
      ] : []),

      // Output license informations
      new LicenseListWebpackPlugin({
        name: 'Client Scripts',
        htmlFilename: 'index.html',
        outputDir: path.join('..', 'legal'),
        includeLicenseFiles: true,
        override: sourceMapping,
        processOutput: (out) => {
          /*
           * add language scripts that might be built later
           */
          const clientScripts = out.find(({ name }) => name === 'Client Scripts').scripts;
          const scriptAmount = clientScripts.length;
          const langs = fs.readdirSync(path.resolve('i18n'))
            .filter((e) => (e.endsWith('.po') && !e.startsWith('ssr')))
            .map((l) => l.slice(0, -3));
          for (let i = 0; i < scriptAmount; i += 1) {
            const script = clientScripts[i];
            if (script.url.includes('.en.')) {
              for (let j = 0; j < langs.length; j += 1) {
                const replaceStr = '.' + langs[j] + '.';
                clientScripts.push({
                  ...script,
                  assets: script.assets.map(({ name, url }) => ({
                    name: name.replace('.en.', replaceStr),
                    url: url.replace('.en.', replaceStr),
                  })),
                  url: script.url.replace('.en.', replaceStr),
                });
              }
            }
          }
          /*
           * build a second summarized html output, because LibreJS doesn't
           * understand this and we still want it
           * TODO: replace it with the mergeByChunnkName option once LibreJS
           *       supports it
           */
          let secondOut = out.map((buildObj) => {
            const newBuildObj = {
              ...buildObj,
              scripts: [],
            }
            buildObj.scripts.forEach((scriptObj) => {
              let targetInd = newBuildObj.scripts.findIndex(
                (s) => s.name === scriptObj.name,
              );
              if (targetInd === -1) {
                newBuildObj.scripts.push({ ...scriptObj, url: null });
              } else {
                newBuildObj.scripts[targetInd] = LicenseListWebpackPlugin
                  .deepMergeNamedArrays(
                    newBuildObj.scripts[targetInd],
                    { ...scriptObj, url: null },
                   );
              }
            });
            return newBuildObj;
          });
          secondOut = LicenseListWebpackPlugin.summarizeOutput(secondOut);
          secondOut = LicenseListWebpackPlugin.generateHTML(secondOut);
          fs.writeFileSync(
            path.resolve('dist', 'public', 'legal', 'summarized.html'),
            secondOut,
          );
          return out;
        },
      }),
      // Webpack Bundle Analyzer
      // https://github.com/th0r/webpack-bundle-analyzer
      ...analyze ? [new BundleAnalyzerPlugin({ analyzerPort: 8889 })] : [],
    ],

    optimization: {
      splitChunks: {
        chunks: 'all',
        name: false,
        cacheGroups: {
          default: false,
          defaultVendors: false,

          /*
           * this layout of chunks is also assumed in src/core/assets.js
           * client -> client.js + vendor.js
           * globe -> globe.js + three.js
           */
          vendor: {
            name: 'vendor',
            chunks: (chunk) => chunk.name.startsWith('client'),
            test: /[\\/]node_modules[\\/]/,
          },
          pvendor: {
            name: 'pvendor',
            chunks: (chunk) => chunk.name.startsWith('popup'),
            test: /[\\/]node_modules[\\/]/,
          },
          three: {
            name: 'three',
            chunks: 'all',
            test: /[\\/]node_modules[\\/]three[\\/]/,
          },
        },
      },
      /*
       * we post-process the bundle in production ourselves, so no need for
       * minimization here
       */
      minimize: false,
    },

    recordsPath: path.resolve('records.json'),

    stats: {
      colors: true,
      reasons: false,
      hash: false,
      version: false,
      chunkModules: false,
    },

    performance: {
      /*
       * since we minimize in production in post processing, those hints
       * are useless
       */
      hints: false,
    },

    cache: {
      type: 'filesystem',
    },
  };
}

