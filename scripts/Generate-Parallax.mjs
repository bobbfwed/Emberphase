import fs from 'node:fs';
import {watchFace} from './lib/parallax-scene.mjs';
const output=new URL('../watchface/src/main/res/raw/watchface.xml',import.meta.url);
fs.mkdirSync(new URL('.',output),{recursive:true});
fs.writeFileSync(output,watchFace());
console.log('Generated PARALLAX native WFF scene.');
