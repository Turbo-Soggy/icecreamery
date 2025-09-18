// IIFE to encapsulate game logic
(function() {
    'use strict';

    const SAVE_KEY = 'iceCreamParlorSave';
    const AUTOSAVE_INTERVAL = 30000; // 30 seconds
    const OFFLINE_PROGRESS_CAP_SECONDS = 2 * 60 * 60; // 2 hours

    // GAME STATE
    let gameState = {
        scoops_banked: 0,
        lifetime_scoops: 0,
        sps: 0,
        click_power: 1,
        last_save_timestamp: Date.now(),
        owned_generators: {},
        owned_upgrades: {},
        sundae: { active: false, multiplier_until: 0 }
    };

    // GAME DATA
    const GENERATOR_COST_MULTIPLIER = 1.15;
    const SUNDAE_DESPAWN_TIME = 13000;
    const SUNDAE_MULTIPLIER_DURATION = 30000;
    const SUNDAE_MULTIPLIER_VALUE = 10;
    const generators = [
        { id: 'taster_spoon', name: 'Taster Spoon', base_cost: 15, base_output_sps: 0.1 },
        { id: 'parlor_nonna', name: 'Parlor Nonna', base_cost: 100, base_output_sps: 1 },
        { id: 'freezer', name: 'Freezer', base_cost: 1100, base_output_sps: 8 },
        { id: 'mixer', name: 'Mixer', base_cost: 12000, base_output_sps: 47 },
        { id: 'ice_cream_truck', name: 'Ice Cream Truck', base_cost: 130000, base_output_sps: 260 },
    ];
    const upgrades = [
        { id: 'waffle_cones', name: 'Waffle Cones', cost: 500, effect: { type: 'click_mult', value: 2 }, description: 'Doubles click power.' },
        { id: 'extra_scoop', name: 'Extra Scoop', cost: 1000, effect: { type: 'click_add', value: 1 }, description: 'Adds +1 to each click.' },
        { id: 'insulated_spoons', name: 'Insulated Spoons', cost: 100, effect: { type: 'generator_mult', target: 'taster_spoon', value: 2 }, description: 'Taster Spoon output x2.' },
        { id: 'family_recipe', name: 'Family Recipe', cost: 1000, effect: { type: 'generator_mult', target: 'parlor_nonna', value: 2 }, description: 'Parlor Nonna output x2.' },
        { id: 'deep_chill', name: 'Deep Chill', cost: 10000, effect: { type: 'generator_mult', target: 'freezer', value: 2 }, description: 'Freezer output x2.' },
        { id: 'high_speed_whisks', name: 'High-Speed Whisks', cost: 100000, effect: { type: 'generator_mult', target: 'mixer', value: 2 }, description: 'Mixer output x2.' },
        { id: 'route_optimization', name: 'Route Optimization', cost: 1000000, effect: { type: 'generator_mult', target: 'ice_cream_truck', value: 2 }, description: 'Ice Cream Truck output x2.' },
        { id: 'premium_cream', name: 'Premium Cream', cost: 50000, effect: { type: 'global_mult', value: 1.2 }, description: 'Global production x1.2.' },
    ];

    // DOM ELEMENTS
    const dom = {};
    let sundaeDespawnTimer = null;

    // INITIALIZATION
    function init() {
        populateDomElements();
        setupEventListeners();
        if (!loadGame()) {
            initializeGameState();
        }
        recalculateAndRender();
        setInterval(gameLoop, 100);
        setInterval(saveGame, AUTOSAVE_INTERVAL);
        scheduleNextSundae();
        console.log("Game Initialized");
    }

    function populateDomElements() {
        dom.scoopsBanked = document.getElementById('scoops-banked');
        dom.sps = document.getElementById('sps');
        dom.lifetimeScoops = document.getElementById('lifetime-scoops');
        dom.bigIceCream = document.getElementById('big-ice-cream');
        dom.leftPanel = document.getElementById('left-panel');
        dom.generatorsList = document.getElementById('generators-list');
        dom.upgradesList = document.getElementById('upgrades-list');
        dom.shopTabs = document.getElementById('shop-tabs');
        dom.goldenSundaeContainer = document.getElementById('golden-sundae-container');
        dom.saveButton = document.getElementById('save-button');
        dom.resetButton = document.getElementById('reset-button');
    }

    function initializeGameState() {
        generators.forEach(gen => { gameState.owned_generators[gen.id] = 0; });
        upgrades.forEach(upg => { gameState.owned_upgrades[upg.id] = false; });
    }

    // EVENT LISTENERS
    function setupEventListeners() {
        dom.bigIceCream.addEventListener('click', handleIceCreamClick);
        dom.generatorsList.addEventListener('click', (e) => handleShopItemBuy(e, 'generator'));
        dom.upgradesList.addEventListener('click', (e) => handleShopItemBuy(e, 'upgrade'));
        dom.shopTabs.addEventListener('click', handleTabSwitch);
        dom.saveButton.addEventListener('click', () => { saveGame(); showNotification('Game Saved!'); });
        dom.resetButton.addEventListener('click', resetGame);
        window.addEventListener('beforeunload', saveGame);
        document.addEventListener('keydown', handleKeyPress);
    }

    function handleKeyPress(event) {
        if (event.code === 'Space' && event.target.tagName !== 'BUTTON') {
            event.preventDefault();
            dom.bigIceCream.click();
            dom.bigIceCream.classList.add('active-feedback');
            setTimeout(() => dom.bigIceCream.classList.remove('active-feedback'), 100);
        }
    }

    // GAME LOOP
    function gameLoop() {
        checkSundaeMultiplier();
        const scoopsToAdd = gameState.sps / 10;
        gameState.scoops_banked += scoopsToAdd;
        gameState.lifetime_scoops += scoopsToAdd;
        updateScoopsDisplay();
        updateShopAvailability();
    }

    // PERSISTENCE
    function saveGame() {
        gameState.last_save_timestamp = Date.now();
        localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
    }

    function loadGame() {
        const savedData = localStorage.getItem(SAVE_KEY);
        if (!savedData) return false;
        const loadedState = JSON.parse(savedData);
        Object.assign(gameState, loadedState);
        recalculateSps();
        const timeElapsed = Date.now() - loadedState.last_save_timestamp;
        const offlineSeconds = Math.min(Math.floor(timeElapsed / 1000), OFFLINE_PROGRESS_CAP_SECONDS);
        if (offlineSeconds > 0) {
            const offlineGains = offlineSeconds * gameState.sps;
            gameState.scoops_banked += offlineGains;
            gameState.lifetime_scoops += offlineGains;
            showNotification(`Welcome back! You earned ${formatNumber(Math.floor(offlineGains))} scoops while away.`);
        }
        return true;
    }

    function resetGame() {
        if (confirm('Are you sure you want to reset all your progress? This cannot be undone!')) {
            localStorage.removeItem(SAVE_KEY);
            location.reload();
        }
    }

    // UI & RENDERING
    function renderGenerators() {
        dom.generatorsList.innerHTML = '';
        generators.forEach(gen => {
            const cost = getGeneratorCost(gen);
            const owned = gameState.owned_generators[gen.id];
            const individualSps = getGeneratorOutput(gen);
            const totalSpsFromGen = owned * individualSps;

            const li = document.createElement('li');
            li.className = 'shop-item';
            li.title = `${gen.name}: Each produces ${formatNumber(individualSps)} SpS. You own ${owned}, producing ${formatNumber(totalSpsFromGen)} SpS total.`;

            li.innerHTML = `
                <div class="item-info">
                    <strong>${gen.name}</strong>
                    <span>Owned: ${owned}</span>
                    <span>+${formatNumber(individualSps)} SpS each</span>
                </div>
                <button class="buy-button" data-id="${gen.id}" disabled>Cost: ${formatNumber(cost)}</button>
            `;
            dom.generatorsList.appendChild(li);
        });
    }

    function renderUpgrades() {
        dom.upgradesList.innerHTML = '';
        upgrades.forEach(upg => {
            if (!gameState.owned_upgrades[upg.id]) {
                const li = document.createElement('li');
                li.className = 'shop-item upgrade-item';
                li.title = `${upg.name}: ${upg.description}`;
                li.innerHTML = `
                    <div class="item-info">
                        <strong>${upg.name}</strong>
                        <span>${upg.description}</span>
                    </div>
                    <button class="buy-button" data-id="${upg.id}" disabled>Cost: ${formatNumber(upg.cost)}</button>
                `;
                dom.upgradesList.appendChild(li);
            }
        });
    }

    function getGeneratorOutput(generator) {
        let multiplier = 1;
        // Check for specific generator multipliers
        upgrades.forEach(upg => {
            if (gameState.owned_upgrades[upg.id] && upg.effect.type === 'generator_mult' && upg.effect.target === generator.id) {
                multiplier *= upg.effect.value;
            }
        });
        return generator.base_output_sps * multiplier;
    }

    function calculateSps() {
        let totalSps = 0;
        let globalMultiplier = 1;
        upgrades.forEach(upg => {
            if (gameState.owned_upgrades[upg.id] && upg.effect.type === 'global_mult') {
                globalMultiplier *= upg.effect.value;
            }
        });

        generators.forEach(gen => {
            totalSps += gameState.owned_generators[gen.id] * getGeneratorOutput(gen);
        });

        let finalSps = totalSps * globalMultiplier;
        if (gameState.sundae.multiplier_until > Date.now()) {
            finalSps *= SUNDAE_MULTIPLIER_VALUE;
        }
        gameState.sps = finalSps;
    }

    // UTILITY
    function formatNumber(num) {
        if (num < 1000) return num.toLocaleString(undefined, {maximumFractionDigits: 1});
        const suffixes = ["", "k", "M", "B", "T"];
        const suffixNum = Math.floor(String(Math.floor(num)).length / 3);
        if (suffixNum >= suffixes.length) return num.toExponential(2);
        const shortValue = parseFloat((num / Math.pow(1000, suffixNum)).toPrecision(3));
        const suffix = suffixes[suffixNum];
        return shortValue + suffix;
    }

    // Stubs for functions that exist but are omitted for brevity
    function handleTabSwitch(event) { if (!event.target.classList.contains('tab-button')) return; const tab = event.target.dataset.tab; document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active')); event.target.classList.add('active'); document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active')); document.getElementById(`${tab}-tab`).classList.add('active'); }
    function handleShopItemBuy(event, itemType) { if (event.target.classList.contains('buy-button')) { const itemId = event.target.dataset.id; if (itemType === 'generator') buyGenerator(itemId); else if (itemType === 'upgrade') buyUpgrade(itemId); } }
    function checkSundaeMultiplier() { if (gameState.sundae.multiplier_until > 0 && Date.now() > gameState.sundae.multiplier_until) { gameState.sundae.multiplier_until = 0; recalculateSps(); showNotification("Production multiplier wore off!"); } }
    function handleIceCreamClick(event) { const clickValue = gameState.click_power; gameState.scoops_banked += clickValue; gameState.lifetime_scoops += clickValue; updateScoopsDisplay(); updateShopAvailability(); showFloatingText(clickValue, event); }
    function buyGenerator(id) { const generator = generators.find(g => g.id === id); const cost = getGeneratorCost(generator); if (gameState.scoops_banked >= cost) { gameState.scoops_banked -= cost; gameState.owned_generators[id]++; recalculateAndRender(); } }
    function buyUpgrade(id) { const upgrade = upgrades.find(u => u.id === id); if (gameState.scoops_banked >= upgrade.cost && !gameState.owned_upgrades[id]) { gameState.scoops_banked -= upgrade.cost; gameState.owned_upgrades[id] = true; recalculateAndRender(); } }
    function recalculateAll() { calculateClickPower(); calculateSps(); }
    function recalculateAndRender() { recalculateAll(); renderAll(); }
    function calculateClickPower() { let power = 1; let multiplier = 1; upgrades.forEach(upg => { if (gameState.owned_upgrades[upg.id]) { if (upg.effect.type === 'click_add') power += upg.effect.value; if (upg.effect.type === 'click_mult') multiplier *= upg.effect.value; } }); gameState.click_power = power * multiplier; }
    function scheduleNextSundae() { const minWait = 120 * 1000; const maxWait = 360 * 1000; const waitTime = Math.random() * (maxWait - minWait) + minWait; setTimeout(spawnSundae, waitTime); }
    function spawnSundae() { if (gameState.sundae.active) { scheduleNextSundae(); return; } gameState.sundae.active = true; const sundaeEl = document.createElement('button'); sundaeEl.id = 'golden-sundae'; sundaeEl.textContent = '🍨'; sundaeEl.onclick = handleSundaeClick; const containerRect = dom.goldenSundaeContainer.getBoundingClientRect(); const x = Math.random() * (containerRect.width - 50); const y = Math.random() * (containerRect.height - 50); sundaeEl.style.left = `${x}px`; sundaeEl.style.top = `${y}px`; dom.goldenSundaeContainer.appendChild(sundaeEl); sundaeDespawnTimer = setTimeout(() => despawnSundae(false), SUNDAE_DESPAWN_TIME); }
    function handleSundaeClick() { despawnSundae(true); if (Math.random() < 0.5) { const windfall = 60 * gameState.sps; gameState.scoops_banked += windfall; gameState.lifetime_scoops += windfall; showNotification(`Golden Sundae! +${formatNumber(Math.floor(windfall))} scoops!`); } else { gameState.sundae.multiplier_until = Date.now() + SUNDAE_MULTIPLIER_DURATION; recalculateSps(); showNotification(`Golden Sundae! Production x${SUNDAE_MULTIPLIER_VALUE} for 30s!`); } recalculateAndRender(); }
    function despawnSundae(wasClicked) { if (!gameState.sundae.active) return; clearTimeout(sundaeDespawnTimer); const sundaeEl = document.getElementById('golden-sundae'); if (sundaeEl) sundaeEl.remove(); gameState.sundae.active = false; scheduleNextSundae(); }
    function renderAll() { updateScoopsDisplay(); renderGenerators(); renderUpgrades(); updateShopAvailability(); }
    function updateScoopsDisplay() { dom.scoopsBanked.textContent = formatNumber(Math.floor(gameState.scoops_banked)); dom.lifetimeScoops.textContent = formatNumber(Math.floor(gameState.lifetime_scoops)); let spsText = formatNumber(gameState.sps); if (gameState.sundae.multiplier_until > Date.now()) { spsText += ` (x${SUNDAE_MULTIPLIER_VALUE}!)`; dom.sps.classList.add('multiplier-active'); } else { dom.sps.classList.remove('multiplier-active'); } dom.sps.textContent = spsText; }
    function showNotification(message) { const note = document.createElement('div'); note.className = 'notification'; note.textContent = message; document.body.appendChild(note); setTimeout(() => note.remove(), 4000); }
    function getGeneratorCost(generator) { const count = gameState.owned_generators[generator.id] || 0; return Math.round(generator.base_cost * Math.pow(GENERATOR_COST_MULTIPLIER, count)); }
    function updateShopAvailability() { document.querySelectorAll('.buy-button').forEach(button => { const id = button.dataset.id; const isGenerator = !!generators.find(g => g.id === id); let cost; if (isGenerator) { cost = getGeneratorCost(generators.find(g => g.id === id)); } else { const upgrade = upgrades.find(u => u.id === id); if(upgrade) cost = upgrade.cost; } if(cost) { button.disabled = gameState.scoops_banked < cost; } }); }
    function showFloatingText(amount, event) { const floatText = document.createElement('div'); floatText.textContent = `+${formatNumber(amount)}`; floatText.className = 'click-text'; const rect = dom.leftPanel.getBoundingClientRect(); const x = event.clientX - rect.left; const y = event.clientY - rect.top; floatText.style.left = `${x}px`; floatText.style.top = `${y}px`; dom.leftPanel.appendChild(floatText); floatText.addEventListener('animationend', () => floatText.remove()); }

    document.addEventListener('DOMContentLoaded', init);
})();
