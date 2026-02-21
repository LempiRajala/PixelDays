/*
 * minify js files with Terser,
 * this is the same thing webpack would do, but we do it manually after
 * resolving translations in production builds
 */
import fs from 'fs';
import path from 'path';
import * as esbuild from 'esbuild';
import { spawn } from 'child_process';

const assetdir = path.resolve(
  import.meta.dirname, '..', 'dist', 'public', 'assets',
);

/**
 * minify list of js files
 * @param assetList list of filepaths to js files
 * @param callback(error, assetFile) called whenever an asset got built, or on error
 */
async function minifyAssets(assetList, callback) {
  try {
    for (let i = 0; i < assetList.length; i += 1) {
      const asset = assetList[i];
      const inputPath = path.join(assetdir, asset);
      
      await esbuild.build({
        entryPoints: [inputPath],
        minify: true,
        allowOverwrite: true,
        write: true,
        outfile: inputPath,
        logLevel: 'silent',
      });
      
      callback(null, asset);
    }
  } catch (error) {
    callback(error);
  }
}

async function minifyAssetsInProcess(assetList, callback) {
  if (!assetList.length) {
    return;
  }
  const minifyProcess = spawn('node', [import.meta.filename, ...assetList], {
    shell: process.platform == 'win32',
  });
  minifyProcess.stdout.on('data', (data) => {
    callback(null, data.toString());
  });
  minifyProcess.stderr.on('data', (data) => {
    console.error(data.toString());
  });
  minifyProcess.on('close', (code) => {
    if (code) {
      callback(new Error('Minifying assets failed!'));
    }
  });
}

/**
 * minify js assets
 * @param langs null | array of lanugages we built, to filter out previously
 *   existing bundles
 * @param parallel in how many processess we minify, or null if only this one
 */
function minifyJs(langs, parallel = false) {
  const ts = Date.now();
  process.stdout.write(`\x1b[33mMinifying JS assets\x1b[0m\n`);

  let fsFiles = fs.readdirSync(assetdir).filter((e) => e.endsWith('.js') && !e.includes('WPLANGCODE'));
  if (langs?.length) {
    fsFiles = fsFiles.filter((e) => {
      const parts = e.split('.');
      return parts.length !== 4 || parts[1] === 'en' || langs.includes(parts[1])
    });
  }

  const amountOfAssets = fsFiles.length;

  return new Promise((resolve, reject) => {
    let i = 0;
    let cursorPosition = 0;
    const callback = (error, asset) => {
      if (error) {
        reject(error);
        return;
      }

      if (i > 0) {
        /* move back 5 columns and clean till EOL */
        process.stdout.write('\x1b[5D\x1b[0K');
      }
      i += 1;

      const assetName = asset.trim().split('.').slice(0, -2).join('.');
      /*
      if (assetName.includes('globe.de')) {
        console.log('DE FOUND');
      }*/
      /* calculate the current cursor position, because querying for it is hard */
      if (cursorPosition + assetName.length + 1 >= process.stdout.columns) {
        cursorPosition = 0;
        process.stdout.write('\n');
      }
      cursorPosition += assetName.length + 1;
      process.stdout.write('\x1b[32m' + assetName + ' ');
      if (cursorPosition + 5 >= process.stdout.columns) {
        cursorPosition = 0;
        process.stdout.write('\n');
      }
      /* write progress */
      process.stdout.write('\x1b[0m' + `  ${Math.floor(i / amountOfAssets * 100)}%`.slice(-4) + ' ');

      if (i === amountOfAssets) {
        process.stdout.write(`\x1b[5D\x1b[0K\n\x1b[33mMinifying took ${Math.round((Date.now() - ts) / 1000)}s\x1b[0m\n`);
        resolve();
      }
    };

    parallel = parseInt(parallel, 10);
    if (Number.isNaN(parallel) || parallel < 1) {
      parallel = false;
    }
    if (!parallel) {
      /*
       * minify in current process
       */
      minifyAssets(fsFiles, callback);
    } else {
      /*
       * split into multiple other processes
       */
      const partSize = Math.ceil(amountOfAssets / parallel);

      for (let i = 0; i < parallel; i++) {
        const start = i * partSize;
        const end = start + partSize;
        minifyAssetsInProcess(fsFiles.slice(start, end), callback);
      }
    }
  });
}

async function doMinifyJs() {
  /*
   * if there are any arguments, they are filenames to js files
   */
  if (process.argv.length > 1) {
    let files = process.argv.slice(2).filter((a) => !a.startsWith('-'));
    if (files.length) {
      minifyAssets(files, (error, assetFile) => {
        if (error) {
          console.error(error.message);
          process.exit(1);
        } else {
          console.log(assetFile);
        }
      });
      return;
    }
  }

  try {
    await minifyJs();
  } catch (e) {
    console.log('ERROR while minifying js', e);
    process.exit(1);
  }
}

if (import.meta.url.endsWith(process.argv[1])) {
  doMinifyJs();
}

export default minifyJs;
