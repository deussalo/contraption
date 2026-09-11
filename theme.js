const palettes={
  dark:{background:'#151e27',dots:'#33424d',ground:'#657b7c',groundFill:'#25323a',goal:'#a6bd84',goalFill:'#98b97b13',selection:'#afd093',handle:'#25343c',rope:'#dbb576'},
  light:{background:'#f5f5ec',dots:'#c9d2bd',ground:'#b6c3a8',groundFill:'#dbe1cc35',goal:'#849971',goalFill:'#9eb58c17',selection:'#6e9464',handle:'#faf9eb',rope:'#a88650'},
};
let current='dark';
export function setTheme(name){if(!Object.hasOwn(palettes,name))throw Error('Unknown color theme.');current=name;document.documentElement.dataset.theme=name;document.querySelector('meta[name="theme-color"]').content=palettes[name].background;}
export const themeName=()=>current;
export const canvasTheme=()=>palettes[current];
