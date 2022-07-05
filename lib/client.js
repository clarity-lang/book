import Misbehave from 'misbehave';
import {handle_command,init_session,on_ready} from './clarity_repl';
import {json_parse_safe,render_events,ansi_codes_to_html,prism} from './util';

let repl_ready = false;
let queued_evaluations = [];

on_ready(() =>
	{
	repl_ready = true;
	queued_evaluations.forEach(([code,result_container,options]) => eval_clarity_code(code,result_container,options));
	queued_evaluations = [];
	});

async function eval_clarity_code(code,result_container,options)
	{
	if (!options)
		options = {};
	if (!repl_ready)
		return queued_evaluations.push([code,result_container,options]);
	await init_session();
	if (options.setup)
		options.setup.forEach(command => handle_command(command));
	let result = code.substr(0,2) === '::' ? '()' : handle_command(code + (options.validation_code ? "\n\n;; --- Exercise validation code ---\n" + options.validation_code : ''));
	//FIXME- These tests are pretty error-prone. Can also be optimised.
	const analysis_error = result.substr(0,15) === 'Analysis error:';
	const runtime_error = result.substr(0,14) === 'Runtime Error:';
	const parsing_error = result.substr(0,14) === 'Parsing error:';
	if (runtime_error)
		{
		const match = result.match(/^Runtime Error: ShortReturn\(AssertionFailed\(Sequence\(String\("(.+?)"\)\)\)\)$/);
		if (match && match[1])
			result = match[1];
		}
	const events = !analysis_error && result.indexOf('Events emitted') !== -1 && result.match(/^({.+?})$/gm).map(entry => json_parse_safe(entry)).filter(r => !!r);
	const deploy_success = !events && result.indexOf('contract successfully stored. Use (contract-call? ...) for invoking the public functions:') !== -1;
	if (options.expected_output || options.validation_code)
		{
		result_container.classList.remove('pass','fail');
		result_container.classList.add(!analysis_error && !runtime_error && !parsing_error && (!options.expected_output || (result === options.expected_output || (events.length && events[0].contract_event && events[0].contract_event.value === options.expected_output))) ? 'pass' : 'fail');
		}
	result_container.innerHTML = 
		events && events.length
		? render_events(events)
		: analysis_error || runtime_error || parsing_error
			? '<span class="error">' + ansi_codes_to_html(result) + '</span>'
			//? '<span class="error">' + ansi_codes_to_html((analysis_error || parsing_error) && options.validation_code ? result.substr(0,result.length-options.validation_code.length-2) : result) + '</span>'
			: prism.highlight(deploy_success ? '()' : result,prism.languages.clarity,'Clarity');
	}

function copy_clipboard(text)
	{
	navigator.clipboard.writeText(text);
	}

function new_line()
	{
	var ta = document.createElement('textarea');
	ta.value = '\n';
	return ta.value.length === 2 ? '\r\n' : '\n';
	}

async function start()
	{
	const fields = document.querySelectorAll('pre[class*="language-"]');
	const ln = new_line();
	fields.forEach(field =>
		{
		field.parentElement.querySelector('.copy').addEventListener('click',() => copy_clipboard(field.textContent));
		const play_button = field.parentElement.querySelector('.play');
		if (play_button)
			{
			const options = field.parentElement.dataset.options && JSON.parse(field.parentElement.dataset.options) || {};
			if (options.validation_code)
				{
				const validation_code_container = document.createElement('pre');
				validation_code_container.className = ' language-clarity validation_code';
				validation_code_container.innerHTML = prism.highlight(";; --- Exercise validation code ---\n" + options.validation_code,prism.languages.clarity,'Clarity');
				field.parentElement.appendChild(validation_code_container);
				}
			const result_container = document.createElement('pre');
			const code_container = field.querySelector('code');
			result_container.className = 'result';
			field.parentElement.appendChild(result_container);
			play_button.addEventListener('click',() => eval_clarity_code(field.textContent,result_container,options));
			if (options.expected_output || options.validation_code)
				{
				field.parentElement.classList.add('exercise');
				field.parentElement.dataset.hint = options.hint;
				if (options.expected_output)
					result_container.dataset.expected_output = options.expected_output;
				}
			if (!options.noneditable)
				{
				const reset_button = field.parentElement.querySelector('.reset');
				if (reset_button)
					{
					const original_content = code_container.innerHTML;
					reset_button.addEventListener('click',() => code_container.innerHTML = original_content);
					}
				const share_button = field.parentElement.querySelector('.share');
				if (share_button)
					share_button.addEventListener('click',() =>
						{
						let link = document.location.href.split('#')[0] + '#e' + encodeURIComponent(code_container.innerText);
						copy_clipboard(link);
						alert("A shareable link for this snippet was copied to clipboard.");
						});
				const editor = new Misbehave(code_container,
					{
					//autoIndent: false, // This breaks newlines for some reason.
					autoOpen: true,
					autoStrip: true,
					overwrite: true,
					replaceTab: true,
					softTabs: false,
					oninput: code => code_container.innerHTML = prism.highlight(code,prism.languages.clarity,'Clarity')
					});
				// custom autoIndent handler to allow newlines but not auto-indent.
				editor.handler.autoIndent = (prefix, selected, suffix) => ({prefix: prefix + ln, selected: '', suffix: suffix || ''});
				field.addEventListener('click',event =>
					{
					if (event.target === field)
						editor.focus(); //TODO- set caret to end if clicked after the code block.
					});
				}
			}
		});
	}

document.readyState === 'loading'
	? document.addEventListener("DOMContentLoaded", start)
	: setTimeout(start,1);
