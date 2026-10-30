/** Styles for the side tab and panel, injected into their shadow root. */
export const PANEL_CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
.tab, .panel { font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; color: #17233A; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }

.tab {
  position: fixed; right: 0; top: 38vh;
  writing-mode: vertical-rl; transform: rotate(180deg);
  background: #17233A; color: #fff; border: 0; cursor: pointer;
  font-weight: 650; letter-spacing: 0.02em;
  padding: 14px 7px; border-radius: 0 8px 8px 0;
  box-shadow: 0 4px 14px rgba(23, 35, 58, 0.25);
}
.tab:hover { padding-right: 10px; }
.tab:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, .btn:focus-within {
  outline: 2px solid #2450C8; outline-offset: 2px;
}

.panel {
  position: fixed; top: 0; right: 0; height: 100vh; width: min(390px, 100vw);
  background: #EEF2F6; border-left: 1px solid #D3DAE4;
  box-shadow: -10px 0 30px rgba(23, 35, 58, 0.18);
  display: flex; flex-direction: column;
}
@media (prefers-reduced-motion: no-preference) {
  .panel { animation: slide 160ms ease-out; }
  @keyframes slide { from { transform: translateX(20px); opacity: 0.5; } }
}

.head { display: flex; align-items: center; gap: 10px; background: #17233A; color: #fff; padding: 12px 14px; }
.head strong { font-size: 16px; }
.status { flex: 1; font-size: 12.5px; color: #B9CCF7; }
.close { background: none; border: 0; color: #C9D2E0; font-size: 22px; line-height: 1; cursor: pointer; padding: 0 2px; }
.close:hover { color: #fff; }

.actions { display: flex; gap: 8px; padding: 12px 14px 4px; }
.summary { margin: 6px 14px 10px; color: #5B6880; font-size: 12.5px; }

.btn {
  font: inherit; font-weight: 600; font-size: 13.5px; cursor: pointer;
  border: 1px solid #B9C3D1; background: #fff; color: #17233A;
  border-radius: 6px; padding: 7px 12px; display: inline-flex; align-items: center; gap: 6px;
}
.btn:hover { border-color: #4A5468; }
.btn.primary { background: #17233A; border-color: #17233A; color: #fff; }
.btn.primary:disabled { opacity: 0.5; cursor: default; }
.btn.small { padding: 5px 10px; font-size: 13px; align-self: flex-start; }

.body { overflow-y: auto; padding: 0 14px 28px; flex: 1; }
.section { margin-top: 10px; }
.section h3 { display: flex; align-items: center; gap: 8px; font-size: 13.5px; margin: 6px 0 4px; }
.section h3 .n { margin-left: auto; color: #5B6880; font-weight: 500; }
.note { margin: 0 0 8px; color: #5B6880; font-size: 12.5px; }
.section ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }

.row { background: #fff; border: 1px solid #D3DAE4; border-radius: 8px; padding: 9px 11px; display: flex; flex-direction: column; gap: 5px; }
.row-head { display: flex; align-items: baseline; gap: 8px; }
.q { flex: 1; font-weight: 600; overflow-wrap: anywhere; }
.req { color: #A8404A; }
.source { margin: 0; font-size: 12px; color: #5B6880; }
.value { margin: 0; overflow-wrap: anywhere; }
.muted { color: #5B6880; }

.dot { width: 8px; height: 8px; border-radius: 50%; flex: none; display: inline-block; transform: translateY(-1px); }
.dot.missing { background: #D99A1E; }
.dot.unknown { background: #9AA3B2; }
.dot.ready { background: #2F9461; }
.dot.onPage { background: #2450C8; }

.link { background: none; border: 0; padding: 0; font: inherit; font-size: 12.5px; font-weight: 600; color: #2450C8; cursor: pointer; align-self: flex-start; }
.link:hover { text-decoration: underline; }

input, select, textarea {
  font: inherit; color: #17233A; background: #fff;
  border: 1px solid #B9C3D1; border-radius: 6px; padding: 6px 9px; width: 100%; min-width: 0;
}
textarea { resize: vertical; }
.pair { display: flex; gap: 6px; }
.empty { background: #fff; border: 1px dashed #B9C3D1; border-radius: 8px; padding: 16px; margin-top: 10px; }
.empty p { margin: 0 0 6px; }
`;
