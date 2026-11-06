import { useEffect, useState } from "react";
import { api } from "../api";
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
  const { t, prefs, setPrefs, terminals, library, editors, editor } = useApp();
  const current = terminals.find((x) => x.id === prefs.terminal)?.id ?? terminals.find((x) => x.installed)?.id ?? "";
  const example = examples[library.platform] ?? examples.linux;
  return (
    <div className="form-group">
      <h2>{t("terminal")}</h2>
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
      <h2>{t("editor")}</h2>
      <div className="form-box">
        <div className="form-row">
          <label htmlFor="editor">{t("openFoldersIn")}</label>
          <select id="editor" value={editor?.id ?? ""} disabled={editors.length === 0} onChange={(e) => setPrefs({ editor: e.target.value })}>
            {editors.length === 0 && <option value="">{t("noEditor")}</option>}
            {editors.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <span className="hint">{t("editorHint")}</span>
        </div>
      </div>
      <Launcher />
      <Updates />
    </div>
  );
}

function Launcher() {
  const { t, prefs, setPrefs, library, modKey } = useApp();
  const [autostart, setAutostart] = useState(false);
  useEffect(() => {
    api.autostartEnabled().then(setAutostart).catch(() => {});
  }, []);
  return (
    <>
      <h2 style={{ margin: "10px 0 2px" }}>{t("launcher")}</h2>
      <div className="form-box">
        <div className="form-row">
          <label htmlFor="tray">{t("showInTray")}</label>
          <input id="tray" className="switch" type="checkbox" checked={prefs.showInTray} onChange={(e) => setPrefs({ showInTray: e.target.checked })} />
        </div>
        <div className="form-row">
          <label>{t("globalShortcut")}</label>
          <span>{modKey === "⌘" ? "⌥⌘K" : "Ctrl+Alt+K"}</span>
        </div>
        <div className="form-row">
          <label htmlFor="autostart">{t("openAtLogin")}</label>
          <input
            id="autostart"
            className="switch"
            type="checkbox"
            checked={autostart}
            onChange={(e) => {
              const value = e.target.checked;
              api.setAutostart(value).then(() => setAutostart(value)).catch(() => setAutostart(!value));
            }}
          />
        </div>
        {library.platform === "windows" && (
          <div className="form-row">
            <label htmlFor="wsl">
              {t("includeWsl")}
              <span className="hint" style={{ display: "block" }}>{t("includeWslHint")}</span>
            </label>
            <input id="wsl" className="switch" type="checkbox" checked={prefs.includeWsl} onChange={(e) => setPrefs({ includeWsl: e.target.checked })} />
          </div>
        )}
      </div>
    </>
  );
}

function Updates() {
  const { t, prefs, setPrefs, actions } = useApp();
  return (
    <>
      <h2 style={{ margin: "10px 0 2px" }}>{t("updates")}</h2>
      <div className="form-box">
        <div className="form-row">
          <label htmlFor="auto-update">{t("autoUpdate")}</label>
          <input id="auto-update" className="switch" type="checkbox" checked={prefs.autoUpdate} onChange={(e) => setPrefs({ autoUpdate: e.target.checked })} />
        </div>
        <div className="form-row">
          <label>{t("checkUpdates")}</label>
          <button className="btn small" onClick={() => actions.checkForUpdates(true)}>{t("checkNow")}</button>
        </div>
      </div>
    </>
  );
}

const options = [30, 90, 180, 365];

function HistoryPane() {
  const app = useApp();
  const { t, library, prefs, setPrefs } = app;
  // Cuentas cuya retención se puede cambiar desde aquí (las de este equipo, no las de WSL).
  const local = library.accounts.filter((a) => !a.environment && !a.hidden);
  const [target, setTarget] = useState(app.account?.id ?? local.find((a) => a.isDefault)?.id ?? "");
  const account = local.find((a) => a.id === target) ?? local[0];
  return (
    <>
      <div className="form-group">
        <h2>{t("claudeHistory")}</h2>
        {local.length > 1 && (
          <div className="form-box" style={{ marginBottom: 8 }}>
            <div className="form-row">
              <label htmlFor="retention-account">{t("account")}</label>
              <select id="retention-account" value={account?.id} onChange={(e) => setTarget(e.target.value)}>
                {local.map((a) => (
                  <option key={a.id} value={a.id}>
                    {app.accountName(a.id)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        <Retention key={account?.id} account={account?.id ?? null} current={account ? account.retentionDays : library.retentionDays} />
      </div>
      <Accounts />
      <div className="form-group">
        <h2>{t("list")}</h2>
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

/** Plazo de `cleanupPeriodDays` de una cuenta. */
function Retention({ account, current }: { account: string | null; current: number | null }) {
  const { t, actions, open } = useApp();
  const [choice, setChoice] = useState(current === null ? 30 : options.includes(current) ? current : 0);
  const [custom, setCustom] = useState(current && !options.includes(current) ? current : 90);
  const days = choice === 0 ? custom : choice;
  return (
    <>
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
          onClick={() => open.confirm(t("confirmRetention", { n: days }), t("apply"), () => actions.applyRetention(days, account))}
        >
          {t("apply")}
        </button>
      </div>
          </>
  );
}

/** Cuentas de Claude Code: carpetas de configuración que se leen. */
function Accounts() {
  const app = useApp();
  const { t, library, actions } = app;
  return (
    <div className="form-group">
      <h2>{t("accounts")}</h2>
      <div className="form-box">
        {library.accounts.map((a) => (
          <div className="form-row" key={a.id}>
            <label htmlFor={`account-${a.id}`} style={{ minWidth: 0, flex: 1 }}>
              <input
                className="inline-name"
                defaultValue={a.name}
                placeholder={t("mainAccount")}
                aria-label={t("accountName")}
                onBlur={(e) => e.target.value.trim() !== a.name && actions.renameAccount(a.id, e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              />
              <span className="hint selectable" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis" }} title={a.configDir}>
                {a.environment ? `WSL · ${a.environment} · ${a.configDir}` : a.configDir} · {t("sessions", { n: a.sessionCount })}
              </span>
            </label>
            {a.manual && (
              <button className="btn small" onClick={() => actions.removeAccount(a.id)}>
                {t("removeAccount")}
              </button>
            )}
            {!a.isDefault && !a.environment && (
              <input
                id={`account-${a.id}`}
                className="switch"
                type="checkbox"
                aria-label={t("showAccount")}
                title={t("showAccount")}
                checked={!a.hidden}
                onChange={(e) => actions.setAccountHidden(a.id, !e.target.checked)}
              />
            )}
          </div>
        ))}
      </div>
      <div className="form-footer">
        <span>{t("accountsHint")}</span>
        <button className="btn small right" onClick={() => actions.addAccount()}>
          {t("addAccount")}
        </button>
      </div>
    </div>
  );
}
