(function() {
    'use strict';

    const Estimator = {
        methodologies: {
            'chatgpt': { energyBase: 0.34, waterBase: 0.32 },
            'gemini': { energyBase: 0.24, waterBase: 0.26 }
        },
        calculate: function(provider, charCount) {
            const params = this.methodologies[provider] || this.methodologies['chatgpt'];
            const workloadMultiplier = 1 + (charCount / 1000) * 0.1; 
            return {
                energy: (params.energyBase * workloadMultiplier).toFixed(2),
                water: (params.waterBase * workloadMultiplier).toFixed(2),
                type: 'estimated' 
            };
        }
    };

    const UI = {
        hud: null,
        inject: function() {
            if (document.getElementById('waterprint-hud')) return;
            this.hud = document.createElement('div');
            this.hud.id = 'waterprint-hud';
            this.hud.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#1a1a1a;color:#fff;padding:12px 16px;border-radius:8px;font-family:monospace;font-size:13px;z-index:999999;box-shadow:0 4px 12px rgba(0,0,0,0.5);border:1px solid #333;pointer-events:auto;';
            document.body.appendChild(this.hud);
            this.update('0.00', '0.00');
        },
        update: function(wh, ml) {
            this.hud.innerHTML = `💧 WaterPrint ⚡ ${wh} Wh   💧 ${ml} mL <span style="color:#aaa">estimated · medium confidence</span> <a href="#" style="color:#00ffcc;margin-left:8px;text-decoration:none">[ⓘ Info]</a> <a href="#" style="color:#ffcc00;margin-left:4px;text-decoration:none">[⚡ Optimize]</a>`;
        }
    };

    const Adapters = {
        init: function() {
            const provider = window.location.hostname.includes('gemini') ? 'gemini' : 'chatgpt';
            
            document.addEventListener('input', (e) => {
                const target = e.target;
                const isChatGPT = target.tagName === 'TEXTAREA' && target.id === 'prompt-textarea';
                const isGemini = target.hasAttribute('contenteditable') || target.classList.contains('ql-editor');
                
                if (isChatGPT || isGemini) {
                    const textLength = target.value ? target.value.length : (target.innerText ? target.innerText.length : 0);
                    const estimate = Estimator.calculate(provider, textLength);
                    UI.update(estimate.energy, estimate.water);
                }
            }, true);
        }
    };

    UI.inject();
    Adapters.init();
})();
