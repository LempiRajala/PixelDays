import { readFileSync } from 'fs';
import path from 'path';

const pkg = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, './package.json')),
);

export default function (api) {
  const plugins = [
    // react-optimize
    '@babel/transform-react-constant-elements',
    '@babel/transform-react-inline-elements',
  ];

  const presets = [
    [
      "@babel/preset-env",
      api.caller(caller => caller && caller.target === "node")
        ? {
          targets: {
            node: pkg.engines.node.replace(/^\D+/g, ''),
          },
          modules: false,
        }
        : {
          targets: {
            browsers: pkg.browserslist,
          },
        }
    ],
    '@babel/preset-typescript',
    '@babel/react',
  ];

  return {
    presets,
    plugins
  };
}
