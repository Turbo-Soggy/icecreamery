import { Game } from './game.js';
import { UIManager } from './ui.js';

const SAVE_KEY = 'iceCreamParlorSave';
const AUTOSAVE_INTERVAL = 30000;
const OFFLINE_PROGRESS_CAP_SECONDS = 2 * 60 * 60;
const GAME_TICK_INTERVAL = 100; // ms, for 10 ticks per second

class App {
    constructor() {
        this.game = new Game();
        this.ui = new UIManager();
        this.lastTick = Date.now();

        this.ui.bind(this.game);
        this.load();

        // Bind save/reset buttons
        const saveButton = document.getElementById('save-button');
        const resetButton = document.getElementById('reset-button');
        saveButton.addEventListener('click', () => {
            this.save();
            this.ui.showNotification('Game Saved!');
        });
        resetButton.addEventListener('click', () => this.reset());

        window.addEventListener('beforeunload', () => this.save());

        this.startGameLoops();
    }

    startGameLoops() {
        // Main game loop
        setInterval(() => {
            const now = Date.now();
            const timestep = (now - this.lastTick) / 1000; // seconds
            this.lastTick = now;

            this.game.update(timestep);
            this.ui.render(this.game.getState(), this.game.getConfig(), this.game);
        }, GAME_TICK_INTERVAL);

        // Autosave loop
        setInterval(() => this.save(), AUTOSAVE_INTERVAL);

        // Golden Sundae loop
        this.scheduleNextSundae();
    }

    save() {
        this.game.setSaveTimestamp();
        localStorage.setItem(SAVE_KEY, JSON.stringify(this.game.getState()));
    }

    load() {
        const savedData = localStorage.getItem(SAVE_KEY);
        if (!savedData) return;

        const loadedState = JSON.parse(savedData);

        // Calculate offline progress before loading state
        const timeElapsed = Date.now() - loadedState.last_save_timestamp;
        const offlineSeconds = Math.min(Math.floor(timeElapsed / 1000), OFFLINE_PROGRESS_CAP_SECONDS);

        if (offlineSeconds > 0) {
            // Temporarily load state to calculate offline SPS correctly
            const tempGame = new Game();
            tempGame.loadState(loadedState);
            const offlineGains = offlineSeconds * tempGame.getState().sps;

            // Add gains to the loaded state before applying it
            loadedState.scoops_banked += offlineGains;
            loadedState.lifetime_scoops += offlineGains;
            this.ui.showNotification(`Welcome back! You earned ${this.ui.formatNumber(Math.floor(offlineGains))} scoops while away.`);
        }

        this.game.loadState(loadedState);
    }

    reset() {
        if (confirm('Are you sure you want to reset all your progress? This cannot be undone!')) {
            localStorage.removeItem(SAVE_KEY);
            location.reload();
        }
    }

    scheduleNextSundae() {
        const minWait = 120 * 1000;
        const maxWait = 360 * 1000;
        const waitTime = Math.random() * (maxWait - minWait) + minWait;

        setTimeout(() => this.spawnSundae(), waitTime);
    }

    spawnSundae() {
        const sundaeEl = this.ui.spawnGoldenSundae(() => {
            const reward = this.game.clickSundae();
            if (reward.type === 'windfall') {
                this.ui.showNotification(`Golden Sundae! +${this.ui.formatNumber(Math.floor(reward.amount))} scoops!`);
            } else {
                this.ui.showNotification(`Golden Sundae! Production x${reward.value} for 30s!`);
            }
            clearTimeout(despawnTimer);
            this.scheduleNextSundae();
        });

        const despawnTimer = setTimeout(() => {
            sundaeEl.remove();
            this.scheduleNextSundae();
        }, 13000);
    }
}

// Entry point
window.addEventListener('DOMContentLoaded', () => {
    new App();
});
