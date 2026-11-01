const fs=require('fs'),sharp=require('sharp'),path=require('path');
const out=path.resolve(__dirname,'..');
const left='M 500 100 L 382 100 Q 374 100 374 108 L 374 119 L 380 126 L 380 135 Q 365.6 136 365.6 145 Q 365.6 154 380 155 L 380 181 Q 365.6 182 365.6 191 Q 365.6 200 380 201 L 380 265 Q 380 277 369 280 Q 325.4 284 325.4 304.3 L 325.4 1125 Q 325.4 1150 350.4 1150 L 500 1150';
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1250" viewBox="0 0 1000 1250"><rect width="1000" height="1250" fill="white"/><g fill="#d5d5d5" stroke="#555" stroke-width="2"><path d="${left} Z"/><path d="${left} Z" transform="translate(1000 0) scale(-1 1)"/></g><path d="M 500 102 V 1148" stroke="#d5d5d5" stroke-width="4"/></svg>`;
fs.writeFileSync(out+'/measured-outline.svg',svg);sharp(Buffer.from(svg)).png().toFile(out+'/measured-outline.png');
