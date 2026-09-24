'use strict';
/* Cinderfall — cosmetics: the skin catalog (mirrors server/worker.js SKINS, CRATES, economy), materials for weapon
   finishes and operative suits, accessories, and the per-frame animation of the fancy ones. */
(function (CF) {
  const U = CF.U;
  const K = CF.Skins = {};

  // ------------------------------------------------------------ catalog (ids, slots and rarities must match the server)
  K.RARITY = {
    common: { label: 'Common', css: '#b8c2cc', rgb: [0.72, 0.76, 0.8], weight: 0 },
    rare: { label: 'Rare', css: '#3fa2ff', rgb: [0.25, 0.63, 1], weight: 1 },
    epic: { label: 'Epic', css: '#b35cff', rgb: [0.7, 0.36, 1], weight: 2 },
    legendary: { label: 'Legendary', css: '#ffb62e', rgb: [1, 0.71, 0.18], weight: 3 },
    champion: { label: 'Champion', css: '#ffe27a', rgb: [1, 0.89, 0.48], weight: 4 }
  };
  const W = (id, rarity, name, desc) => ({ id, slot: 'w', rarity, name, desc });
  const P = (id, rarity, name, desc) => ({ id, slot: 'p', rarity, name, desc });
  K.list = [
    W('w_desert', 'common', 'Desert Tan', 'Sand-and-khaki blotch camouflage.'),
    W('w_urban', 'common', 'Urban Digital', 'Grey pixel camo for concrete and steel.'),
    W('w_woodland', 'common', 'Woodland', 'Classic four-colour forest pattern.'),
    W('w_arctic', 'common', 'Arctic Splinter', 'White and ice-grey splinter shards.'),
    W('w_carbon', 'rare', 'Carbon Weave', 'Woven carbon fibre with a cold blue sheen.'),
    W('w_cobalt', 'rare', 'Anodized Cobalt', 'Deep blue anodized metal, polished edges.'),
    W('w_tiger', 'rare', 'Tiger Stripe', 'Hot orange with black brush stripes.'),
    W('w_redline', 'rare', 'Redline', 'Black polymer cut by red racing lines.'),
    W('w_circuit', 'epic', 'Neon Circuit', 'Live circuit traces that pulse with current.'),
    W('w_damascus', 'epic', 'Damascus', 'Folded steel, every layer visible.'),
    W('w_hologram', 'epic', 'Hologram', 'An iridescent film that shifts with every move.'),
    W('w_frostbite', 'epic', 'Frostbite', 'Glacier-blue crystal with a glow inside the ice.'),
    W('w_inferno', 'legendary', 'Inferno', 'Obsidian shell over molten cracks that breathe.'),
    W('w_void', 'legendary', 'Void', 'A drifting nebula held in black glass.'),
    W('w_dragon', 'legendary', 'Dragonscale', 'Jade and gold scales with a moving shimmer.'),
    W('w_champion', 'champion', 'Champion', 'Mirror gold with a travelling shine. Only for players who took #1 on a leaderboard.'),
    P('p_ranger', 'common', 'Ranger', 'Olive drab fatigues and a boonie hat.'),
    P('p_urban', 'common', 'Urban Ops', 'Charcoal gear, beanie and a patrol pack.'),
    P('p_sand', 'common', 'Sandstorm', 'Desert kit, shemagh and dust goggles.'),
    P('p_navy', 'common', 'Harbor Patrol', 'Navy and white with a peaked cap.'),
    P('p_hazmat', 'rare', 'Hazmat', 'Yellow containment suit, respirator and air tank.'),
    P('p_arctic', 'rare', 'Polar Recon', 'White parka with a fur-lined hood and goggles.'),
    P('p_crimson', 'rare', 'Crimson Guard', 'Red lacquered plates and heavy pauldrons.'),
    P('p_stealth', 'rare', 'Nightshade', 'Matte black, hooded, one green lens.'),
    P('p_oni', 'epic', 'Oni', 'Black lacquer armour under a horned red demon mask.'),
    P('p_chrome', 'epic', 'Chrome', 'Mirror-polished armour with a crest fin.'),
    P('p_samurai', 'epic', 'Ronin', 'Woven kasa hat and layered shoulder guards.'),
    P('p_cyber', 'epic', 'Synthwave', 'Neon stripes that cycle through the spectrum, and a mohawk to match.'),
    P('p_phantom', 'legendary', 'Phantom', 'A glowing ghost of an operative, trailing wisps.'),
    P('p_inferno', 'legendary', 'Hellfire', 'Armour cracked with living magma under a crown of flame.'),
    P('p_mech', 'legendary', 'Warframe', 'Heavy exo-armour with a humming reactor on the back.'),
    P('p_champion', 'champion', 'Champion', 'Gold armour, crown and cape. Only for players who took #1 on a leaderboard.')
  ];
  K.byId = {}; for (const s of K.list) K.byId[s.id] = s;
  K.get = (id) => K.byId[id] || null;
  K.CRATES = {
    field: { id: 'field', name: 'Field crate', price: 300, desc: 'A standard issue crate. Anything but Champion gear can drop.', odds: [['common', 0.62], ['rare', 0.27], ['epic', 0.09], ['legendary', 0.02]] },
    elite: { id: 'elite', name: 'Elite crate', price: 750, desc: 'No commons. Much better odds at Epic and Legendary.', odds: [['rare', 0.55], ['epic', 0.33], ['legendary', 0.12]] }
  };
  K.DUP_REFUND = { common: 60, rare: 125, epic: 275, legendary: 600 };
  K.ECON = { phase: 40, finish: { foundry: 250, halden: 300 }, diff: { recruit: 0.75, veteran: 1, elite: 1.5 }, welcome: 300 };
  /** Coins for clearing a campaign part (the server computes the same numbers; this is for offline play and display). */
  K.phaseCoins = (campaign, diff, phase, total) => {
    const mul = K.ECON.diff[diff] || 1;
    let c = Math.round(K.ECON.phase * mul);
    if (phase + 1 >= total) c += Math.round((K.ECON.finish[campaign] || 250) * mul);
    return c;
  };
  /** Local crate roll (offline play only; online the server rolls). */
  K.roll = (crate) => {
    const c = K.CRATES[crate]; let r = Math.random(), rarity = c.odds[c.odds.length - 1][0];
    for (const [k, w] of c.odds) { if (r < w) { rarity = k; break; } r -= w; }
    const pool = K.list.filter((s) => s.rarity === rarity);
    return pool[Math.floor(Math.random() * pool.length)];
  };
})(window.CF);
