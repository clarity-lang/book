import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from "rollup-plugin-terser";

export default {
	input: 'lib/client.js',
	output:
		[
			{
				file: 'build/client.min.js',
				sourcemap: true,
				format: 'iife',
				plugins: [terser()]
			}
		],
	plugins: [nodeResolve({ browser: true }), commonjs()],
};
