#!/usr/bin/env -S npx ts-node
import repl from "repl";
import ts from "typescript";
import * as tsnode from "ts-node";
import { chromium, Browser, BrowserContext, Page, expect, Expect, APIRequest, request } from "@playwright/test";
import * as fs from 'fs';
const figlet = await import('figlet');
import { Command } from "commander";
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pkgJson = require("./package.json");

type Options = {
  storageState?: string,
  baseURL?: string,
  ignoreHTTPSErrors?: boolean,
  extraHTTPHeaders?: {[key: string]: string}
}

type Props = {
  browser: Browser,
  context: BrowserContext,
  page: Page,
  expect: Expect<{}>,
  request: APIRequest,
}

let _exitRepl = true;

async function initPlaywright(options: Options): Promise<Props> {
  const browser = await chromium.launch({headless: false});
  const context = await browser.newContext(options);
  const page = await context.newPage();
  page.on('close', async() => {
    await browser.close();
    if(_exitRepl) {
      process.exit(0);
    }
    _exitRepl = true;
  });

  if(options.baseURL) {
    await page.goto('/');
  }
  return {browser, context, page, expect, request}
}

function printTextLogo() {
  console.log('---------------------------------------------------------------------------------------------');
  console.log(figlet.default.textSync(pkgJson.name, {font: 'ANSI Shadow'}).trim());
  console.log('---------------------------------------------------------------------------------------------');
}

const options: Options = {ignoreHTTPSErrors: true}

const program = new Command();
program
  .name(pkgJson.name)
  .version(pkgJson.version)
  .description(pkgJson.description)
  .option('-u, --url <baseUrl>', 'The url to be opened by the browser')
  .option('-e, --extraHttpHeaders <prop>', 'extra http headers, use the format name:value',
    (value: string, previous: string[]) => previous.concat([value]), [])
  .option('-s, --storageState <path>', 'path to storage state');

program.parse();
const opts = program.opts();
if(opts.url) {
  options.baseURL = opts.url;
}
if(opts.storageState && fs.existsSync(opts.storageState)) {
  options.storageState = opts.storageState;
}
if(opts.extraHttpHeaders.length > 0) {
  options.extraHTTPHeaders = {};
  opts.extraHttpHeaders.forEach(header => {
    const h = header.split(':');
    options.extraHTTPHeaders[h[0]] = h[1];
  });
}

console.clear();
printTextLogo();
const props = await initPlaywright(options);

const replService: tsnode.ReplService = tsnode.createRepl();
const service = tsnode.create({ ...replService.evalAwarePartialHost });
service.ts = ts;
replService.setService(service);

const replServer = repl.start({
  prompt: "-> ",
  ignoreUndefined: true,
  eval: replService.nodeEval,
  useColors: true,
  preview: false,
});

Object.assign(replServer.context, props);

replServer.on('exit', async() => {
  await props.browser.close();
});

replServer.on('reset', async() => {
    _exitRepl = false;
    await props.browser.close();
    const newPops = await initPlaywright(options);
    Object.assign(replServer.context, newPops);
});

replServer.defineCommand('showLogo', {
  help: 'Show the amazing playwrepl.ts logo',
  action() {
    this.clearBufferedCommand();
    printTextLogo();
    const pic = fs.readFileSync('pics/playwright-logo.txt', {encoding: 'utf-8'})
    console.log(pic);
    this.displayPrompt();
  }
});

replServer.defineCommand('saveStorageState', {
  help: 'Save current storage state ',
  async action(path) {
    this.clearBufferedCommand();
    if(!opts.storageState && path.length === 0) {
      console.log('Please provide a path, run the command like this: .storageState storageStates/auth.json')
    } else {
      const storageStatePath = opts.storageState || path ;
      await props.page.context().storageState({path: storageStatePath});
      console.log(`Saved ${storageStatePath}`)  
    }
    this.displayPrompt();
  }
});

replServer.setupHistory(".history", () => {});

