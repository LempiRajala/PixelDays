/*
 * webpack config to build server files
 */

import fs from 'fs';
import path from 'path';
import webpack from 'webpack';
import GeneratePackageJsonPlugin from 'generate-package-json-webpack-plugin';
import LicenseListWebpackPlugin from './scripts/LicenseListWebpackPlugin.cjs';
import sourceMapping from './scripts/sourceMapping.js';

/*
 * make sure we build in root dir
 */
process.chdir(import.meta.dirname);

const pkg = JSON.parse(
  fs.readFileSync(path.resolve('package.json')),
);

const basePackageValues = {
  name: pkg.name,
  version: pkg.version,
  license: pkg.license,
  private: true,
  engines: pkg.engines,
  scripts: {
    start: 'node server.js',
    poststop: 'pm2 kill',
    sqlsync: 'node scripts/sqlsync.js',
    'install-pm2': 'npm install -g pm2'
  },
  dependencies: {
    mysql2: '',
    'utf-8-validate': '',
    bufferutil: '',
  },
};

const ttag = {};
const babelPlugins = [
  ['ttag', ttag],
];

export default ({
  development, extract,
}) => {
  /*
   * write template files for translations
   */
  if (extract) {
    ttag.extract = { output: path.resolve('i18n', 'template-ssr.pot') };
    ttag.discover = ['t', 'jt', 'c'];
    ttag.sortByMsgid = true;
    ttag.addComments = 't:';
  }

  /*
   * worker threads need to be their own
   * entry points
   */
  const workersDir = path.resolve('src', 'workers');
  const workerEntries = {};
  fs.readdirSync(workersDir)
    .filter((e) => e.endsWith('.js') || e.endsWith('.ts'))
    .forEach((filename) => {
      const name = `workers/${filename.slice(0, -3)}`;
      const fullPath = path.resolve(workersDir, filename);
      workerEntries[name] = fullPath;
    });

  /*
    * same with scripts that are part of the final package
    */
  const scriptsDir = path.resolve('deployment', 'scripts');
  const scriptsEntries = {};
  fs.readdirSync(scriptsDir)
    .filter((e) => e.endsWith('.js') || e.endsWith('.ts'))
    .forEach((filename) => {
      const name = `scripts/${filename.slice(0, -3)}`;
      const fullPath = path.resolve(scriptsDir, filename);
      scriptsEntries[name] = fullPath;
    });

  return {
    name: 'server',
    target: 'node',

    mode: (development) ? 'development' : 'production',

    entry: {
      server: [path.resolve('src', 'server.js')],
      backup: [path.resolve('src', 'backup.js')],
      ...workerEntries,
      ...scriptsEntries,
    },

    output: {
      clean: false,
    },

    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
    },

    module: {
      rules: [
        {
          test: /\.(js|jsx|ts|tsx)$/,
          loader: 'babel-loader',
          include: [
            path.resolve('src'),
          ],
          options: {
            cacheDirectory: false,
            plugins: babelPlugins,
          },
        },
        {
          test: [/\.po$/],
          loader: path.resolve('scripts/TtagPoLoader.js'),
        },
      ],
    },

    externalsPresets: {
      // exclude built-in node modules (path, fs, etc.)
      node: true,
    },

    externals: [{
        'sharp': 'commonjs sharp',
        'bcrypt': 'commonjs bcrypt',
        'utf-8-validate': 'commonjs utf-8-validate',
        'bufferutil': 'commonjs bufferutil',
        'sequelize': 'commonjs sequelize',
        'mysql2': 'commonjs mysql2',
        'express': 'commonjs express',
        'ppfun-captcha': 'commonjs ppfun-captcha',
        'ws': 'commonjs ws',
        'compression': 'commonjs compression',
        'redis': 'commonjs redis',
        'arctic': 'commonjs arctic',
        'winston': 'commonjs winston',
        'winston-daily-rotate-file': 'commonjs winston-daily-rotate-file',
      },
      // the ./src/funcs folder does not get bundled, but copied
      // into dist/workers/funcs instead to allow overriding
      function ({ context, request }, callback) {
        const funcPathInd = request.indexOf('/funcs/');
        if (request.startsWith('.') && funcPathInd !== -1) {
          const prefix = context.endsWith(path.join('src', 'workers'))
            ? '.' : './workers';
          return callback(
            null, `commonjs ${prefix}${request.substring(funcPathInd)}`,
          );
        }
        callback();
      },
    ],

    plugins: [
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': development ? '"development"' : '"production"',
        'process.env.BROWSER': false,
        'process.env.PKG_NAME': `"${pkg.name}"`,
        'process.env.PKG_VERSION': `"${pkg.version}"`,
      }),
      // create package.json for deployment
      new GeneratePackageJsonPlugin(basePackageValues, {
        sourcePackageFilenames: [ path.resolve('package.json') ],
        // provided by node itself
        excludeDependencies: [
          'node:fs', 'node:path', 'node:stream',
          'node:buffer', 'node:util', 'node:os',
        ],
      }),
      // Output license informations
      new LicenseListWebpackPlugin({
        name: 'Server Scripts',
        id: 'server-licenses',
        outputDir: path.join('public', 'legal'),
        includeLicenseFiles: true,
        override: sourceMapping,
      }),
    ],

    stats: {
      colors: true,
      reasons: false,
      hash: false,
      version: false,
      chunkModules: false,
    },

    node: {
      global: false,
      __dirname: false,
      __filename: false,
    },
  };
};
