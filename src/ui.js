export class UIManager {
    constructor() {
        this.elements = {
            scoopsBanked: document.getElementById('scoops-banked'),
            sps: document.getElementById('sps'),
            lifetimeScoops: document.getElementById('lifetime-scoops'),
            bigIceCream: document.getElementById('big-ice-cream'),
            leftPanel: document.getElementById('left-panel'),
            generatorsList: document.getElementById('generators-list'),
            upgradesList: document.getElementById('upgrades-list'),
            shopTabs: document.getElementById('shop-tabs'),
            goldenSundaeContainer: document.getElementById('golden-sundae-container'),
        };
        this.lastRenderedState = {}; // For performance checks
    }

    // --- PUBLIC METHODS ---

    bind(game) {
        this.elements.bigIceCream.addEventListener('click', (event) => {
            game.clickScoop();
            this.showFloatingText(game.getState().click_power, event);
            this.render(game.getState(), game.getConfig(), game);
        });

        document.addEventListener('keydown', (event) => {
            if (event.code === 'Space' && event.target.tagName !== 'BUTTON') {
                event.preventDefault();
                this.elements.bigIceCream.click();
                this.elements.bigIceCream.classList.add('active-feedback');
                setTimeout(() => this.elements.bigIceCream.classList.remove('active-feedback'), 100);
            }
        });

        this.elements.shopTabs.addEventListener('click', this.handleTabSwitch);

        this.elements.generatorsList.addEventListener('click', (e) => {
            if (e.target.classList.contains('buy-button')) {
                game.buyGenerator(e.target.dataset.id);
            }
        });

        this.elements.upgradesList.addEventListener('click', (e) => {
            if (e.target.classList.contains('buy-button')) {
                game.buyUpgrade(e.target.dataset.id);
            }
        });
    }

    render(state, config, game) {
        this.updateStats(state);
        this.renderGenerators(state, config.generators, game);
        this.renderUpgrades(state, config.upgrades);
        this.updateShopAvailability(state, config, game);
    }

    showNotification(message) {
        const note = document.createElement('div');
        note.className = 'notification';
        note.textContent = message;
        document.body.appendChild(note);
        setTimeout(() => note.remove(), 4000);
    }

    spawnGoldenSundae(onClick) {
        const sundaeEl = document.createElement('button');
        sundaeEl.id = 'golden-sundae';
        sundaeEl.textContent = '🍨';

        const containerRect = this.elements.goldenSundaeContainer.getBoundingClientRect();
        sundaeEl.style.left = `${Math.random() * (containerRect.width - 50)}px`;
        sundaeEl.style.top = `${Math.random() * (containerRect.height - 50)}px`;

        sundaeEl.addEventListener('click', () => {
            onClick();
            sundaeEl.remove();
        }, { once: true });

        this.elements.goldenSundaeContainer.appendChild(sundaeEl);

        return sundaeEl; // Return element so main can set despawn timer
    }

    // --- PRIVATE/INTERNAL METHODS ---

    updateStats(state) {
        const roundedScoops = Math.floor(state.scoops_banked);
        if (this.lastRenderedState.scoops_banked !== roundedScoops) {
            this.elements.scoopsBanked.textContent = this.formatNumber(roundedScoops);
            this.lastRenderedState.scoops_banked = roundedScoops;
        }

        const roundedLifetime = Math.floor(state.lifetime_scoops);
        if (this.lastRenderedState.lifetime_scoops !== roundedLifetime) {
            this.elements.lifetimeScoops.textContent = this.formatNumber(roundedLifetime);
            this.lastRenderedState.lifetime_scoops = roundedLifetime;
        }

        if (this.lastRenderedState.sps !== state.sps) {
            let spsText = this.formatNumber(state.sps);
            if (state.sundae.multiplier_until > Date.now()) {
                spsText += ` (x10!)`;
                this.elements.sps.classList.add('multiplier-active');
            } else {
                this.elements.sps.classList.remove('multiplier-active');
            }
            this.elements.sps.textContent = spsText;
            this.lastRenderedState.sps = state.sps;
        }
    }

    renderGenerators(state, generatorsConfig, game) {
        this.elements.generatorsList.innerHTML = '';
        generatorsConfig.forEach(gen => {
            const cost = game.getGeneratorCost(gen);
            const owned = state.owned_generators[gen.id];
            const li = document.createElement('li');
            li.className = 'shop-item';
            li.title = `${gen.name}: Each produces ${this.formatNumber(game.getGeneratorOutput(gen))} SpS.`;
            li.innerHTML = `
                <div class="item-info">
                    <strong>${gen.name}</strong>
                    <span>Owned: ${owned}</span>
                    <span>+${this.formatNumber(game.getGeneratorOutput(gen))} SpS each</span>
                </div>
                <button class="buy-button" data-id="${gen.id}">Cost: ${this.formatNumber(cost)}</button>
            `;
            this.elements.generatorsList.appendChild(li);
        });
    }

    renderUpgrades(state, upgradesConfig) {
        this.elements.upgradesList.innerHTML = '';
        upgradesConfig.forEach(upg => {
            if (!state.owned_upgrades[upg.id]) {
                const li = document.createElement('li');
                li.className = 'shop-item upgrade-item';
                li.title = `${upg.name}: ${upg.description}`;
                li.innerHTML = `
                    <div class="item-info">
                        <strong>${upg.name}</strong>
                        <span>${upg.description}</span>
                    </div>
                    <button class="buy-button" data-id="${upg.id}">Cost: ${this.formatNumber(upg.cost)}</button>
                `;
                this.elements.upgradesList.appendChild(li);
            }
        });
    }

    updateShopAvailability(state, config, game) {
        document.querySelectorAll('.buy-button').forEach(button => {
            const id = button.dataset.id;
            const generator = config.generators.find(g => g.id === id);
            const upgrade = config.upgrades.find(u => u.id === id);
            let cost = 0;
            if (generator) cost = game.getGeneratorCost(generator);
            if (upgrade) cost = upgrade.cost;
            button.disabled = state.scoops_banked < cost;
        });
    }

    showFloatingText(amount, event) {
        const floatText = document.createElement('div');
        floatText.textContent = `+${this.formatNumber(amount)}`;
        floatText.className = 'click-text';
        const rect = this.elements.leftPanel.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        floatText.style.left = `${x}px`;
        floatText.style.top = `${y}px`;
        this.elements.leftPanel.appendChild(floatText);
        floatText.addEventListener('animationend', () => floatText.remove());
    }

    handleTabSwitch(event) {
        if (!event.target.classList.contains('tab-button')) return;
        const tab = event.target.dataset.tab;
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${tab}-tab`).classList.add('active');
    }

    formatNumber(num) {
        if (num < 1000) return num.toLocaleString(undefined, { maximumFractionDigits: 1 });
        const suffixes = ["", "k", "M", "B", "T"];
        const suffixNum = Math.floor(String(Math.floor(num)).length / 3);
        if (suffixNum >= suffixes.length) return num.toExponential(2);
        const shortValue = parseFloat((num / Math.pow(1000, suffixNum)).toPrecision(3));
        return shortValue + suffixes[suffixNum];
    }
}
