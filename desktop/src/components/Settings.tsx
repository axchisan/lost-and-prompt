import { useState } from "react";
import { History, Paintbrush, Settings2, X } from "lucide-react";
import { useApp } from "../state";

type Pane = "general" | "history" | "appearance";

export function Settings({ initialPane, onClose }: { initialPane: Pane; onClose: () => void }) {
  const { t } = useApp();
  const [pane, setPane] = useState<Pane>(initialPane);
  const tabs: [Pane, string, React.ReactNode][] = [
    ["general", t("general"), <Settings2 key="g" />],
    ["history", t("history"), <History key="h" />],
    ["appearance", t("appearance"), <Paintbrush key="a" />],
  ];
  return (
    <div className="overlay" onClick={onClose}>
      <div className="settings" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t("settings")}>
        <div className="tabs">
          {tabs.map(([id, label, icon]) => (
            <button key={id} className={pane === id ? "on" : ""} onClick={() => setPane(id)}>
              {icon}
              {label}
            </button>
          ))}
          <button className="icon-btn close" onClick={onClose} aria-label={t("cancel")}>
            <X />
          </button>
        </div>
        <div className="pane">
          {pane === "general" && <General />}
          {pane === "history" && <HistoryPane />}
          {pane === "appearance" && <Appearance />}
        </div>
      </div>
    </div>
  );
}

const examples: Record<string, string> = {
  windows: "wt -d {cwd} pwsh -NoExit -Command {command}",
  macos: "open -na WezTerm --args start --cwd {cwd} -- zsh -lc \"{command}; exec zsh\"",
  linux: "foot --working-directory={cwd} bash -lc \"{command}; exec bash\"",
};

function General() {
  const { t, prefs, setPrefs, terminals, library } = useApp();
  const current = terminals.find((x) => x.id === prefs.terminal)?.id ?? terminals.find((x) => x.installed)?.id ?? "";
  const example = examples[library.platform] ?? examples.linux;
  return (
    <div className="form-group">
      <h5>{t("terminal")}</h5>
      <div className="form-box">
        <div className="form-row">
          <label htmlFor="terminal">{t("resumeWith")}</label>
          <select id="terminal" value={current} onChange={(e) => setPrefs({ terminal: e.target.value })}>
            {terminals.map((x) => (
              <option key={x.id} value={x.id}>
                {x.id === "custom" ? t("customTerminal") : x.installed ? x.name : `${x.name} (${t("notDetected")})`}
              </option>
            ))}
          </select>
        </div>
        {current === "custom" && (
          <div className="form-row column-row">
            <label htmlFor="custom-terminal">{t("terminalCommand")}</label>
            <input
              id="custom-terminal"
              type="text"
              className="mono"
              value={prefs.customTerminal}
              placeholder={example}
              onChange={(e) => setPrefs({ customTerminal: e.target.value })}
              spellCheck={false}
            />
            <span className="hint">{t("terminalCommandHint")}</span>
          </div>
        )}
        <div className="form-row">
          <label htmlFor="extra">{t("extraArguments")}</label>
          <input
            id="extra"
            type="text"
            value={prefs.extraArguments}
            placeholder={t("extraPlaceholder")}
            onChange={(e) => setPrefs({ extraArguments: e.target.value })}
            spellCheck={false}
          />
        </div>
        <div className="form-row">
          <label>{t("command")}</label>
          <code className="selectable">claude --resume &lt;id&gt; {prefs.extraArguments}</code>
        </div>
      </div>
    </div>
  );
}

const options = [30, 90, 180, 365];

function HistoryPane() {
  const { t, library, actions, prefs, setPrefs, open } = useApp();
  const current = library.retentionDays;
  const [choice, setChoice] = useState(current === null ? 30 : options.includes(current) ? current : 0);
  const [custom, setCustom] = useState(current && !options.includes(current) ? current : 90);
  const days = choice === 0 ? custom : choice;
  return (
    <>
      <div className="form-group">
        <h5>{t("claudeHistory")}</h5>
        <div className="form-box">
          <div className="form-row">
            <label htmlFor="retention">{t("keepSessions")}</label>
            <select id="retention" value={choice} onChange={(e) => setChoice(Number(e.target.value))}>
              <option value={30}>{t("month1")}</option>
              <option value={90}>{t("months3")}</option>
              <option value={180}>{t("months6")}</option>
              <option value={365}>{t("year1")}</option>
              <option value={0}>{t("custom")}</option>
            </select>
          </div>
          {choice === 0 && (
            <div className="form-row">
              <label htmlFor="days">{t("daysLabel")}</label>
              <input id="days" type="number" min={1} max={3650} value={custom} onChange={(e) => setCustom(Math.max(1, Number(e.target.value)))} />
            </div>
          )}
          <div className="form-row">
            <label>{t("currentSetting")}</label>
            <span>{current === null ? t("defaultDays") : t("nDays", { n: current })}</span>
          </div>
        </div>
        <div className="form-footer">
          <span>{t("retentionExplain")}</span>
          <button
            className="btn small right"
            disabled={days === current}
            onClick={() => open.confirm(t("confirmRetention", { n: days }), t("apply"), () => actions.applyRetention(days))}
          >
            {t("apply")}
          </button>
        </div>
      </div>
      <div className="form-group">
        <h5>{t("list")}</h5>
        <div className="form-box">
          <div className="form-row">
            <label htmlFor="hide-empty">{t("hideEmpty")}</label>
            <input id="hide-empty" className="switch" type="checkbox" checked={prefs.hideEmpty} onChange={(e) => setPrefs({ hideEmpty: e.target.checked })} />
          </div>
        </div>
      </div>
    </>
  );
}

function Appearance() {
  const { t, prefs, setPrefs } = useApp();
  return (
    <div className="form-group">
      <div className="form-box">
        <div className="form-row">
          <label>{t("theme")}</label>
          <div className="segmented text">
            {(["system", "light", "dark"] as const).map((value) => (
              <button key={value} className={prefs.theme === value ? "on" : ""} onClick={() => setPrefs({ theme: value })}>
                {t(value)}
              </button>
            ))}
          </div>
        </div>
        <div className="form-row">
          <label htmlFor="language">{t("language")}</label>
          <select id="language" value={prefs.language} onChange={(e) => setPrefs({ language: e.target.value as typeof prefs.language })}>
            <option value="system">{t("system")}</option>
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </div>
        <div className="form-row">
          <label>{t("listView")}</label>
          <div className="segmented text">
            <button className={prefs.listStyle === "rows" ? "on" : ""} onClick={() => setPrefs({ listStyle: "rows" })}>
              {t("rows")}
            </button>
            <button className={prefs.listStyle === "cards" ? "on" : ""} onClick={() => setPrefs({ listStyle: "cards" })}>
              {t("cards")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
