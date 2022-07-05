#!/usr/bin/env node
const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs/promises');
const {build_page} = require('../lib/builder');

const [,,input,output] = process.argv;
const input_path = path.resolve(__dirname,input || '../src');
const output_path = path.resolve(__dirname,output || '../build');

fs.readFile(path.resolve(__dirname,'../templates/base.html'),'utf8').then(template =>
	{
	console.log(`Watching "${input_path}" for changes`);
	chokidar.watch(input_path).on('change',async (absolute_path) =>
		{
		const summary = await fs.readFile(path.resolve(__dirname,'../src/SUMMARY.md'),'utf8');
		const file_path = absolute_path.substring(input_path.length);
		const output_file_path = path.join(output_path,file_path);
		if (absolute_path.substr(-3) !== '.md')
			return fs.copyFile(absolute_path,output_file_path);
		console.log(`Rebuilding ${file_path}`);
		fs.writeFile(output_file_path.slice(0,-3)+'.html',await build_page(absolute_path,{template,summary}),'utf8');
		});
	});
