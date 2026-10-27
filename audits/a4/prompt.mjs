import {readFileSync} from 'node:fs';
import {VERSION,ARTIFACTS} from './artifacts.mjs';
export const PROMPT_VERSION=VERSION;
export const SYSTEM_PROMPT=readFileSync(new URL('./prompts/0.2.0.md',import.meta.url),'utf8');
export const PROMPT_HASH=ARTIFACTS['prompts/0.2.0.md'];
export {ARTIFACTS};
