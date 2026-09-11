export const WORLD = { width: 1200, height: 760, floor: 700 };
export const PARTS = {
  marble: { name: 'Marble', category: 'motion', width: 32, height: 32, description: 'A little ball with big ambitions. Falls, rolls, and sets things in motion.' },
  ramp: { name: 'Ramp', category: 'motion', width: 230, height: 14, description: 'A wooden shortcut downhill. Rotate it to steer your marble.' },
  domino: { name: 'Domino', category: 'motion', width: 16, height: 68, description: 'One small nudge. A whole lot of falling over. Place them close together.' },
  seesaw: { name: 'Seesaw', category: 'motion', width: 180, height: 14, description: 'A balanced beam. Land on one end and send the other end up.' },
  trampoline: { name: 'Trampoline', category: 'magic', width: 100, height: 14, description: 'Gravity, with a plot twist. Bounces a marble away from its top.' },
  fan: { name: 'Fan', category: 'magic', width: 65, height: 80, description: 'A steady breeze pushes nearby marbles. Rotate to point the airflow.' },
  bumper: { name: 'Bumper', category: 'magic', width: 52, height: 52, description: 'A spring-loaded pinball bumper. A very enthusiastic change of direction.' },
  platform: { name: 'Platform', category: 'motion', width: 220, height: 16, description: 'A sturdy shelf for lining things up. Works at any angle.' },
  funnel: { name: 'Funnel', category: 'motion', width: 100, height: 85, description: 'Catch a falling marble and guide it through the narrow opening.' },
  bell: { name: 'Bell', category: 'magic', width: 68, height: 72, description: 'The grand finale. Hit the bell with a marble or domino to celebrate.' },
};
export function part(type, x, y, angle = 0, extra = {}) {
  return { id: crypto.randomUUID(), type, x, y, angle, ...extra };
}
export function preset(name) {
  if (name === 'bounce') return { name: 'A spring in its step', number: '02', parts: [
    part('marble', 320, 140), part('trampoline', 320, 535, 18, { width: 145 }),
    part('ramp', 690, 430, 13, { width: 270 }), part('bell', 960, 530),
    part('platform', 960, 578, 0, { width: 180 }),
  ] };
  if (name === 'wind') return { name: 'A lovely little breeze', number: '03', parts: [
    part('marble', 225, 445), part('fan', 140, 445),
    part('platform', 350, 470, 0, { width: 430 }), part('ramp', 685, 535, 18, { width: 240 }),
    part('bell', 960, 620), part('platform', 950, 672, 0, { width: 240 }),
  ] };
  return { name: 'The scenic route', number: '01', parts: [
    part('marble', 140, 100),
    part('ramp', 245, 262.5, 15.52, { width: 280.22, height: 10 }),
    part('ramp', 515, 395, 15.64, { width: 259.62, height: 10 }),
    part('ramp', 777.5, 530, 15.35, { width: 264.43, height: 10 }),
    part('platform', 1050, 671, 0, { width: 260 }),
    ...[0, 1, 2, 3, 4].map(i => part('domino', 984 + i * 29, 629, 0, { colorIndex: i })),
    part('bell', 1160, 618),
    part('seesaw', 272, 594, -10), part('bumper', 530, 621),
  ] };
}
export function dimensions(piece) { return { width: piece.width ?? PARTS[piece.type].width, height: piece.height ?? PARTS[piece.type].height }; }
export function bounds(piece) {
  const { width, height } = dimensions(piece);
  if (piece.type === 'seesaw') return { width, height: 55 };
  if (piece.type === 'trampoline') return { width, height: 40 };
  return { width, height };
}
