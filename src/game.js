// --- GAME CONFIGURATION ---
const GENERATOR_COST_MULTIPLIER = 1.15;
const SUNDAE_MULTIPLIER_VALUE = 10;
const GAME_TICK_RATE = 10; // 10 ticks per second

const GENERATORS_CONFIG = [
    { id: 'taster_spoon', name: 'Taster Spoon', base_cost: 15, base_output_sps: 0.1 },
    { id: 'parlor_nonna', name: 'Parlor Nonna', base_cost: 100, base_output_sps: 1 },
    { id: 'freezer', name: 'Freezer', base_cost: 1100, base_output_sps: 8 },
    { id: 'mixer', name: 'Mixer', base_cost: 12000, base_output_sps: 47 },
    { id: 'ice_cream_truck', name: 'Ice Cream Truck', base_cost: 130000, base_output_sps: 260 },
];

const UPGRADES_CONFIG = [
    { id: 'waffle_cones', name: 'Waffle Cones', cost: 500, effect: { type: 'click_mult', value: 2 }, description: 'Doubles click power.' },
    { id: 'extra_scoop', name: 'Extra Scoop', cost: 1000, effect: { type: 'click_add', value: 1 }, description: 'Adds +1 to each click.' },
    { id: 'insulated_spoons', name: 'Insulated Spoons', cost: 100, effect: { type: 'generator_mult', target: 'taster_spoon', value: 2 }, description: 'Taster Spoon output x2.' },
    { id: 'family_recipe', name: 'Family Recipe', cost: 1000, effect: { type: 'generator_mult', target: 'parlor_nonna', value: 2 }, description: 'Parlor Nonna output x2.' },
    { id: 'deep_chill', name: 'Deep Chill', cost: 10000, effect: { type: 'generator_mult', target: 'freezer', value: 2 }, description: 'Freezer output x2.' },
    { id: 'high_speed_whisks', name: 'High-Speed Whisks', cost: 100000, effect: { type: 'generator_mult', target: 'mixer', value: 2 }, description: 'Mixer output x2.' },
    { id: 'route_optimization', name: 'Route Optimization', cost: 1000000, effect: { type: 'generator_mult', target: 'ice_cream_truck', value: 2 }, description: 'Ice Cream Truck output x2.' },
    { id: 'premium_cream', name: 'Premium Cream', cost: 50000, effect: { type: 'global_mult', value: 1.2 }, description: 'Global production x1.2.' },
];


export class Game {
    constructor() {
        this.state = {
            scoops_banked: 0,
            lifetime_scoops: 0,
            sps: 0,
            click_power: 1,
            last_save_timestamp: Date.now(),
            owned_generators: {},
            owned_upgrades: {},
            sundae: { active: false, multiplier_until: 0 }
        };

        GENERATORS_CONFIG.forEach(gen => { this.state.owned_generators[gen.id] = 0; });
        UPGRADES_CONFIG.forEach(upg => { this.state.owned_upgrades[upg.id] = false; });

        this.recalculateStats();
    }

    // --- PUBLIC METHODS ---

    // Returns a copy of the state for rendering
    getState() {
        return { ...this.state };
    }

    // Returns a copy of the config for rendering
    getConfig() {
        return {
            generators: GENERATORS_CONFIG,
            upgrades: UPGRADES_CONFIG,
        }
    }

    // Main update function, called by the game loop
    update(timestep) {
        const scoopsToAdd = this.state.sps * timestep;
        this.state.scoops_banked += scoopsToAdd;
        this.state.lifetime_scoops += scoopsToAdd;
        this.checkSundaeMultiplier();
    }

    clickScoop() {
        const clickValue = this.state.click_power;
        this.state.scoops_banked += clickValue;
        this.state.lifetime_scoops += clickValue;
    }

    buyGenerator(id) {
        const config = GENERATORS_CONFIG.find(g => g.id === id);
        const cost = this.getGeneratorCost(config);
        if (this.state.scoops_banked >= cost) {
            this.state.scoops_banked -= cost;
            this.state.owned_generators[id]++;
            this.recalculateStats();
            return true;
        }
        return false;
    }

    buyUpgrade(id) {
        const config = UPGRADES_CONFIG.find(u => u.id === id);
        if (this.state.scoops_banked >= config.cost && !this.state.owned_upgrades[id]) {
            this.state.scoops_banked -= config.cost;
            this.state.owned_upgrades[id] = true;
            this.recalculateStats();
            return true;
        }
        return false;
    }

    clickSundae() {
        if (Math.random() < 0.5) {
            // Instant windfall
            const windfall = 60 * this.state.sps;
            this.state.scoops_banked += windfall;
            this.state.lifetime_scoops += windfall;
            return { type: 'windfall', amount: windfall };
        } else {
            // Production multiplier
            this.state.sundae.multiplier_until = Date.now() + 30000;
            this.recalculateStats();
            return { type: 'multiplier', value: SUNDAE_MULTIPLIER_VALUE };
        }
    }

    // --- PERSISTENCE ---

    loadState(loadedState) {
        // A simple merge; a real project might need migration logic
        Object.assign(this.state, loadedState);
        this.recalculateStats();
    }

    setSaveTimestamp() {
        this.state.last_save_timestamp = Date.now();
    }

    // --- PRIVATE METHODS / CALCULATIONS ---

    recalculateStats() {
        this.calculateClickPower();
        this.calculateSps();
    }

    calculateClickPower() {
        let power = 1;
        let multiplier = 1;
        UPGRADES_CONFIG.forEach(upg => {
            if (this.state.owned_upgrades[upg.id]) {
                if (upg.effect.type === 'click_add') power += upg.effect.value;
                if (upg.effect.type === 'click_mult') multiplier *= upg.effect.value;
            }
        });
        this.state.click_power = power * multiplier;
    }

    calculateSps() {
        let totalSps = 0;
        let globalMultiplier = 1;

        UPGRADES_CONFIG.forEach(upg => {
            if (this.state.owned_upgrades[upg.id] && upg.effect.type === 'global_mult') {
                globalMultiplier *= upg.effect.value;
            }
        });

        GENERATORS_CONFIG.forEach(gen => {
            totalSps += this.state.owned_generators[gen.id] * this.getGeneratorOutput(gen);
        });

        let finalSps = totalSps * globalMultiplier;
        if (this.state.sundae.multiplier_until > Date.now()) {
            finalSps *= SUNDAE_MULTIPLIER_VALUE;
        }
        this.state.sps = finalSps;
    }

    getGeneratorOutput(generatorConfig) {
        let multiplier = 1;
        UPGRADES_CONFIG.forEach(upg => {
            if (this.state.owned_upgrades[upg.id] && upg.effect.type === 'generator_mult' && upg.effect.target === generatorConfig.id) {
                multiplier *= upg.effect.value;
            }
        });
        return generatorConfig.base_output_sps * multiplier;
    }

    getGeneratorCost(generatorConfig) {
        const count = this.state.owned_generators[generatorConfig.id] || 0;
        return Math.round(generatorConfig.base_cost * Math.pow(GENERATOR_COST_MULTIPLIER, count));
    }

    checkSundaeMultiplier() {
        if (this.state.sundae.multiplier_until > 0 && Date.now() > this.state.sundae.multiplier_until) {
            this.state.sundae.multiplier_until = 0;
            this.recalculateStats();
            // The UIManager will be responsible for notifying the user
        }
    }
}
