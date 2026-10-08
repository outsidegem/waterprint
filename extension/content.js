(function() {
    'use strict';

    // 1. Core Methodology parameters
    const Estimator = {
        methodologies: {
            'chatgpt': { energyBase: 0.34, waterBase: 0.32 },
            'gemini': { energyBase: 0.24, waterBase: 0.26 }
        },
        calculate: function(provider, charCount) {
            const params = this.methodologies[provider] || this.methodologies['chatgpt'];
            const tokenEst = Math.max(1, Math.ceil(charCount / 4));
            const workloadMultiplier = 1 + (tokenEst / 100) * 0.15;
            return {
                tokens: tokenEst,
                energyWh: params.energyBase * workloadMultiplier,
                waterMl: params.waterBase * workloadMultiplier
            };
        },
        optimize: function(rawText) {
            return rawText
                .replace(/\b(As an AI( language model)?|Certainly!?|I'?d be happy to help|Sure thing!?|Here is the( information)?)\b/gi, '')
                .replace(/\b(please\s+(can\s+you\s+)?(kindly\s+)?|can\s+you\s+(please\s+)?|thank\s+you(\s+so\s+much)?(\s+in\s+advance)?|you\s+see\s+what\s+i\s+mean\??)\b/gi, '')
                .replace(/\b(it is (important|crucial) to note that|as a matter of fact|at the end of the day|due to the fact that|needless to say|for the purpose of|in order to)\b/gi, '')
                .replace(/\b(very|really|basically|essentially|literally|totally|definitely|actually|just|simply)\b/gi, '')
                .replace(/([.?!])\1+/g, '$1')
                .replace(/\s{2,}/g, ' ')
                .trim();
        }
    };

    // 2. Local Ledger
    const Ledger = {
        totalUsedWh: 0.0,
        totalUsedMl: 0.0,
        totalAvoidedMWh: 0,
        totalAvoidedUml: 0,
        lastAvoidedMWh: 0,
        lastAvoidedUml: 0,
        load: function() {
            try {
                const saved = localStorage.getItem('waterprint_ledger_v6');
                if (saved) {
                    const data = JSON.parse(saved);
                    this.totalUsedWh = data.usedWh || 0;
                    this.totalUsedMl = data.usedMl || 0;
                    this.totalAvoidedMWh = data.mwh || 0;
                    this.totalAvoidedUml = data.uml || 0;
                }
            } catch (e) {}
        },
        save: function() {
            localStorage.setItem('waterprint_ledger_v6', JSON.stringify({
                usedWh: this.totalUsedWh,
                usedMl: this.totalUsedMl,
                mwh: this.totalAvoidedMWh,
                uml: this.totalAvoidedUml
            }));
        },
        addUsage: function(wh, ml) {
            this.totalUsedWh += parseFloat(wh);
            this.totalUsedMl += parseFloat(ml);
            this.save();
        },
        addSavings: function(mwh, uml) {
            this.lastAvoidedMWh = mwh;
            this.lastAvoidedUml = uml;
            this.totalAvoidedMWh += mwh;
            this.totalAvoidedUml += uml;
            this.save();
        }
    };

    async function sha256(message) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        return '0x' + Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // 3. User Interface & Touch Drag Logic
    const UI = {
        hud: null,
        attestModal: null,
        infoModal: null,
        reviewModal: null,
        provider: 'chatgpt',
        currentDraftEnergy: 0.0,
        currentDraftWater: 0.0,
        autoMode: false,
        
        pendingSavedMWh: 0,
        pendingSavedUml: 0,
        pendingOptimizedText: "",
        
        dragState: { active: false, initialX: 0, initialY: 0, xOffset: 0, yOffset: 0 },

        inject: function(provider) {
            if (document.getElementById('waterprint-hud')) return;
            this.provider = provider;
            Ledger.load();
            this.autoMode = localStorage.getItem('waterprint_automode') === 'true';

            this.hud = document.createElement('div');
            this.hud.id = 'waterprint-hud';
            this.hud.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#161b22;color:#c9d1d9;padding:12px;border-radius:8px;font-family:monospace;font-size:12px;z-index:999999;box-shadow:0 8px 24px rgba(0,0,0,0.8);border:1px solid #30363d;display:flex;flex-direction:column;gap:8px;user-select:none;-webkit-user-select:none;touch-action:none;transform:translate3d(0px,0px,0px);width:max-content;';
            document.body.appendChild(this.hud);

            this.attestModal = document.createElement('div');
            this.attestModal.style.cssText = 'position:fixed;bottom:70px;right:24px;background:#0d1117;color:#c9d1d9;padding:16px;border-radius:8px;font-family:-apple-system,sans-serif;font-size:12px;z-index:999999;box-shadow:0 8px 32px rgba(0,0,0,0.8);border:1px solid #30363d;width:320px;display:none;';
            document.body.appendChild(this.attestModal);

            this.infoModal = document.createElement('div');
            this.infoModal.style.cssText = 'position:fixed;bottom:70px;right:24px;background:#0d1117;color:#c9d1d9;padding:20px;border-radius:12px;font-family:-apple-system,sans-serif;font-size:12px;z-index:999999;box-shadow:0 12px 48px rgba(0,0,0,0.9);border:1px solid #30363d;width:340px;display:none;line-height:1.5;';
            this.infoModal.innerHTML = `
                <div style="font-size:14px;font-weight:bold;color:#58a6ff;margin-bottom:12px;border-bottom:1px solid #30363d;padding-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
                    <span>💧 Methodology & Disclaimer</span>
                    <span class="wp-close" style="cursor:pointer;color:#8b949e;font-size:16px;">✕</span>
                </div>
                <div style="color:#c9d1d9;">
                    <p style="margin-bottom:10px;"><strong>IMPORTANT DISCLAIMER:</strong> WaterPrint values are workload estimates, not physical sensor measurements.</p>
                    <p style="margin-bottom:10px;"><strong>2025 Baseline Assumptions:</strong><br>OpenAI: ~0.34 Wh / ~0.32 mL<br>Google: ~0.24 Wh / ~0.26 mL</p>
                    <p style="margin-bottom:10px;color:#8b949e;font-size:11px;">Actual resource consumption varies based on factors including model architecture, hardware, datacenter efficiency, and geographic location.</p>
                    <p style="margin-bottom:0;color:#39d353;font-size:11px;"><strong>Future Telemetry:</strong> Future versions could integrate direct telemetry or infrastructure-level measurements to replace these estimates with verified physical metrics.</p>
                </div>
            `;
            document.body.appendChild(this.infoModal);

            this.reviewModal = document.createElement('div');
            this.reviewModal.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%, -50%);background:#0d1117;color:#c9d1d9;padding:20px;border-radius:12px;border:1px solid #30363d;box-shadow:0 12px 48px rgba(0,0,0,0.9);z-index:9999999;width:90vw;max-width:700px;display:none;font-family:-apple-system,sans-serif;max-height:85vh;overflow-y:auto;';
            document.body.appendChild(this.reviewModal);

            this.render();
            this.initInteractions();
        },

        initInteractions: function() {
            this.hud.addEventListener('click', async (e) => {
                const target = e.target.closest('.wp-btn');
                if (!target) return;
                e.preventDefault();
                e.stopPropagation();
                
                if (target.id === 'wp-btn-opt') Adapters.runOptimization(false);
                else if (target.id === 'wp-btn-info') this.toggleModal(this.infoModal);
                else if (target.id === 'wp-btn-attest') await this.showAttestation();
                else if (target.id === 'wp-btn-auto') {
                    this.autoMode = !this.autoMode;
                    localStorage.setItem('waterprint_automode', this.autoMode);
                    this.render();
                }
            });

            this.reviewModal.addEventListener('click', (e) => {
                const target = e.target.closest('.wp-btn');
                if (!target) return;
                e.preventDefault();
                e.stopPropagation();

                if (target.id === 'wp-btn-rev-cancel') {
                    this.reviewModal.style.display = 'none';
                } else if (target.id === 'wp-btn-rev-accept') {
                    const input = Adapters.getInputElement();
                    if (input) {
                        if (input.tagName === 'TEXTAREA') input.value = this.pendingOptimizedText;
                        else input.innerText = this.pendingOptimizedText;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    Ledger.addSavings(this.pendingSavedMWh, this.pendingSavedUml);
                    
                    const currentEst = Estimator.calculate(this.provider, this.pendingOptimizedText.length);
                    this.currentDraftEnergy = currentEst.energyWh;
                    this.currentDraftWater = currentEst.waterMl;
                    this.render();
                    
                    this.reviewModal.style.display = 'none';
                }
            });

            document.querySelectorAll('.wp-close').forEach(el => el.addEventListener('click', () => {
                this.infoModal.style.display = 'none';
                this.attestModal.style.display = 'none';
            }));

            const dragItem = this.hud;
            const startDrag = (e) => {
                if (e.target.id !== 'wp-drag-handle') return;
                this.dragState.active = true;
                let clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
                let clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
                this.dragState.initialX = clientX - this.dragState.xOffset;
                this.dragState.initialY = clientY - this.dragState.yOffset;
                dragItem.style.boxShadow = '0 12px 32px rgba(0,0,0,0.9)';
            };

            const doDrag = (e) => {
                if (!this.dragState.active) return;
                e.preventDefault();
                let clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
                let clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
                this.dragState.xOffset = clientX - this.dragState.initialX;
                this.dragState.yOffset = clientY - this.dragState.initialY;
                dragItem.style.transform = `translate3d(${this.dragState.xOffset}px, ${this.dragState.yOffset}px, 0)`;
            };

            const endDrag = () => {
                this.dragState.active = false;
                dragItem.style.boxShadow = '0 8px 24px rgba(0,0,0,0.8)';
            };

            dragItem.addEventListener('touchstart', startDrag, { passive: false });
            document.addEventListener('touchmove', doDrag, { passive: false });
            document.addEventListener('touchend', endDrag);
            document.addEventListener('touchcancel', endDrag);

            dragItem.addEventListener('mousedown', startDrag);
            document.addEventListener('mousemove', doDrag);
            document.addEventListener('mouseup', endDrag);
        },

        toggleModal: function(modal) {
            this.infoModal.style.display = 'none';
            this.attestModal.style.display = 'none';
            this.reviewModal.style.display = 'none';
            modal.style.display = 'block';
        },

        showReview: function(baseEst, optEst, originalText, optimizedText, savedMWh, savedUml) {
            this.pendingSavedMWh = savedMWh;
            this.pendingSavedUml = savedUml;
            this.pendingOptimizedText = optimizedText;
            this.infoModal.style.display = 'none';
            this.attestModal.style.display = 'none';

            this.reviewModal.innerHTML = `
                <div style="font-size:16px;font-weight:bold;color:#58a6ff;margin-bottom:12px;border-bottom:1px solid #30363d;padding-bottom:8px;">⚡ Optimization Review</div>
                <div style="display:flex;gap:12px;flex-wrap:wrap;">
                    <div style="flex:1;min-width:250px;background:#161b22;padding:12px;border-radius:6px;border:1px solid #30363d;">
                        <div style="color:#8b949e;margin-bottom:6px;font-size:11px;font-weight:bold;">ORIGINAL (${baseEst.energyWh.toFixed(2)} Wh / ${baseEst.waterMl.toFixed(2)} mL)</div>
                        <div style="font-family:monospace;font-size:11px;white-space:pre-wrap;color:#c9d1d9;">${originalText}</div>
                    </div>
                    <div style="flex:1;min-width:250px;background:#161b22;padding:12px;border-radius:6px;border:1px solid #2ea043;">
                        <div style="color:#39d353;margin-bottom:6px;font-size:11px;font-weight:bold;">OPTIMIZED (${optEst.energyWh.toFixed(2)} Wh / ${optEst.waterMl.toFixed(2)} mL)</div>
                        <div style="font-family:monospace;font-size:11px;white-space:pre-wrap;color:#fff;">${optimizedText}</div>
                    </div>
                </div>
                <div style="margin-top:16px;text-align:center;font-size:14px;background:#1c2128;padding:10px;border-radius:6px;">
                    Estimated Savings: <strong style="color:#39d353;">-${savedMWh} mWh</strong> | <strong style="color:#39d353;">-${savedUml} µL</strong>
                </div>
                <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px;">
                    <button class="wp-btn" id="wp-btn-rev-cancel" style="background:#21262d;border:1px solid #30363d;color:#c9d1d9;padding:8px 16px;border-radius:6px;cursor:pointer;font-family:inherit;">Keep Original</button>
                    <button class="wp-btn" id="wp-btn-rev-accept" style="background:#238636;border:1px solid #2ea043;color:#fff;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:bold;font-family:inherit;">✔ Use Suggestion</button>
                </div>
            `;
            this.reviewModal.style.display = 'block';
        },

        showAttestation: async function() {
            if (this.attestModal.style.display === 'block') {
                this.attestModal.style.display = 'none';
                return;
            }
            this.infoModal.style.display = 'none';
            this.reviewModal.style.display = 'none';

            const timestamp = Math.floor(Date.now() / 1000);
            const canonicalString = `node=0x1111|mwh=${Ledger.lastAvoidedMWh}|uml=${Ledger.lastAvoidedUml}|v=1|ts=${timestamp}`;
            const hash = await sha256(canonicalString);
            
            this.attestModal.innerHTML = `
                <div style="font-weight:bold;color:#58a6ff;margin-bottom:8px;display:flex;justify-content:space-between;">
                    <span>📜 Attestation Payload</span>
                    <span class="wp-close" style="cursor:pointer;color:#8b949e;font-size:14px;">✕</span>
                </div>
                <div style="background:#161b22;padding:10px;border-radius:4px;border:1px solid #30363d;margin-bottom:10px;font-family:monospace;font-size:11px;word-break:break-all;">
                    <strong>Hash:</strong><br><span style="color:#39d353;">${hash}</span><br><br>
                    <strong>Energy Avoided:</strong> ${Ledger.lastAvoidedMWh} mWh<br>
                    <strong>Water Avoided:</strong> ${Ledger.lastAvoidedUml} µL
                </div>
                <div id="wp-btn-copy" style="background:#21262d;border:1px solid #30363d;color:#c9d1d9;padding:8px;border-radius:4px;cursor:pointer;text-align:center;font-weight:bold;">Copy JSON</div>
            `;
            this.attestModal.style.display = 'block';

            this.attestModal.querySelector('.wp-close').addEventListener('click', () => {
                this.attestModal.style.display = 'none';
            });

            document.getElementById('wp-btn-copy').addEventListener('click', (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(JSON.stringify({
                    canonicalHash: hash,
                    energyAvoidedMWh: Ledger.lastAvoidedMWh,
                    waterAvoidedUml: Ledger.lastAvoidedUml,
                    timestamp: timestamp,
                    accountingType: "estimated_avoided"
                }, null, 2));
                e.target.innerText = '✔ Copied!';
            });
        },

        render: function() {
            const liveWh = this.currentDraftEnergy.toFixed(4);
            const liveMl = this.currentDraftWater.toFixed(4);
            const totalUsedWh = Ledger.totalUsedWh.toFixed(4);
            const totalUsedMl = Ledger.totalUsedMl.toFixed(4);
            
            const autoColor = this.autoMode ? '#238636' : '#21262d';
            const autoBorder = this.autoMode ? '#2ea043' : '#30363d';

            this.hud.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:bold;color:#fff;">💧 WaterPrint</span>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <button class="wp-btn" id="wp-btn-auto" style="background:${autoColor};border:1px solid ${autoBorder};color:#fff;padding:2px 6px;border-radius:4px;cursor:pointer;font-family:inherit;font-size:10px;font-weight:bold;">🤖 Auto: ${this.autoMode ? 'ON' : 'OFF'}</button>
                        <span id="wp-drag-handle" style="cursor:grab;font-size:16px;color:#8b949e;padding:0 4px;" title="Drag to move">⋮</span>
                    </div>
                </div>
                <div style="display:grid; grid-template-columns:40px 1fr; gap:4px; font-size:11px;">
                    <span style="color:#8b949e;">Draft</span>
                    <span style="color:#58a6ff;">${liveWh} Wh - ${liveMl} mL</span>
                    <span style="color:#8b949e;">Total</span>
                    <span style="color:#ff7b72;">${totalUsedWh} Wh - ${totalUsedMl} mL</span>
                </div>
                <div style="display:flex; gap:8px; align-items:center; margin-top:2px;">
                    <button class="wp-btn" id="wp-btn-opt" style="background:#21262d;border:1px solid #30363d;color:#f0883e;padding:5px 10px;border-radius:4px;cursor:pointer;font-family:inherit;font-size:11px;font-weight:bold;">⚡ Optimize</button>
                    <button class="wp-btn" id="wp-btn-attest" style="background:#238636;border:1px solid #2ea043;color:#fff;padding:5px 10px;border-radius:4px;cursor:pointer;font-family:inherit;font-size:11px;font-weight:bold;">📜 Attest</button>
                    <button class="wp-btn" id="wp-btn-info" style="background:transparent;border:none;color:#8b949e;cursor:pointer;font-size:15px;padding:0;border-radius:50%;" title="Info">ⓘ</button>
                </div>
            `;
        }
    };

    const Adapters = {
        provider: 'chatgpt',

        getInputElement: function() {
            return document.querySelector('#prompt-textarea') || document.querySelector('.ql-editor') || document.querySelector('div[contenteditable="true"]');
        },

        getRawText: function() {
            const input = this.getInputElement();
            let text = '';
            if (input) text = input.tagName === 'TEXTAREA' ? input.value : input.innerText;
            return text.trim();
        },

        runOptimization: function(isSilentAuto) {
            const input = this.getInputElement();
            if (!input) return false;

            const rawText = input.tagName === 'TEXTAREA' ? input.value : input.innerText;
            if (!rawText || rawText.trim().length === 0) return false;

            const optimizedText = Estimator.optimize(rawText);
            if (rawText === optimizedText) return false;
            
            const baseEst = Estimator.calculate(this.provider, rawText.length);
            const optEst = Estimator.calculate(this.provider, optimizedText.length);

            const avoidedMWh = Math.max(0, Math.round((baseEst.energyWh - optEst.energyWh) * 1000));
            const avoidedUml = Math.max(0, Math.round((baseEst.waterMl - optEst.waterMl) * 1000));

            if (isSilentAuto) {
                if (avoidedMWh > 0 || avoidedUml > 0) Ledger.addSavings(avoidedMWh, avoidedUml);
                
                if (input.tagName === 'TEXTAREA') input.value = optimizedText;
                else input.innerText = optimizedText;
                
                input.dispatchEvent(new Event('input', { bubbles: true }));

                UI.currentDraftEnergy = optEst.energyWh;
                UI.currentDraftWater = optEst.waterMl;
                UI.render();
                return true;
            } else {
                UI.showReview(baseEst, optEst, rawText, optimizedText, avoidedMWh, avoidedUml);
                return true;
            }
        },

        init: function() {
            this.provider = window.location.hostname.includes('gemini') ? 'gemini' : 'chatgpt';
            UI.inject(this.provider);

            document.addEventListener('input', () => {
                const text = this.getRawText();
                if (!text) {
                    UI.currentDraftEnergy = 0;
                    UI.currentDraftWater = 0;
                    UI.render();
                    return;
                }
                const estimate = Estimator.calculate(this.provider, text.length);
                UI.currentDraftEnergy = estimate.energyWh;
                UI.currentDraftWater = estimate.waterMl;
                UI.render();
            }, true);

            const commitOdometer = () => {
                if (UI.currentDraftEnergy > 0 || UI.currentDraftWater > 0) {
                    Ledger.addUsage(UI.currentDraftEnergy, UI.currentDraftWater);
                    UI.currentDraftEnergy = 0;
                    UI.currentDraftWater = 0;
                    UI.render();
                }
            };

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    if (UI.autoMode) Adapters.runOptimization(true);
                    commitOdometer();
                }
            }, true);
            
            document.addEventListener('click', (e) => {
                const sendBtn = e.target.closest('button[data-testid="send-button"], button[aria-label*="Send"], button[class*="send"]');
                if (sendBtn) {
                    if (UI.autoMode) Adapters.runOptimization(true);
                    commitOdometer();
                }
            }, true);
        }
    };

    Adapters.init();
})();
