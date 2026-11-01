import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { relaunch } from "@tauri-apps/plugin-process";
import type { Update } from "@tauri-apps/plugin-updater";
import { api, links } from "../api";
import { useApp } from "../state";
import { isConnectionError } from "../App";
import { releasesSince, type Release } from "../releaseNotes";
import { Markdown } from "./Markdown";

/** Aviso de versión nueva: se instala y reinicia sola (Windows y AppImage) o enlaza la descarga. */
export function UpdateSheet({ update, onClose }: { update: Update; onClose: () => void }) {
  const { t, language } = useApp();
  const [current, setCurrent] = useState("");
  const [kind, setKind] = useState<string>("nsis");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getVersion().then(setCurrent).catch(() => {});
    api.installKind().then(setKind).catch(() => {});
  }, []);

  const canInstall = kind === "nsis" || kind === "appimage";

  // Lo que trajo cada versión desde la instalada: quien se salta varias ve también las intermedias.
  // `history` lo publican las versiones desde la 0.4.3; antes solo estaban las notas de la última.
  const history = (update.rawJson as { history?: Release[] }).history ?? [{ version: update.version, date: "", notes: update.body ?? "" }];
  const releases = current ? releasesSince(history, current, language) : [];

  const install = async () => {
    setError(null);
    let total = 0;
    let done = 0;
    setProgress(0);
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") total = event.data.contentLength ?? 0;
        if (event.event === "Progress") {
          done += event.data.chunkLength;
          setProgress(total ? Math.round((done / total) * 100) : 0);
        }
        if (event.event === "Finished") setProgress(100);
      });
      await relaunch();
    } catch (e) {
      setProgress(null);
      setError(isConnectionError(e) ? `${t("updateConnectionHint")}\n\n${e}` : String(e));
    }
  };

  return (
    <div className="overlay" onClick={progress === null ? onClose : undefined}>
      <div className="sheet" role="dialog" aria-label={t("updateAvailable")} onClick={(e) => e.stopPropagation()} style={{ width: 460 }}>
        <h2>{t("updateAvailable")}</h2>
        <p>{t("updateVersion", { new: update.version, current })}</p>
        {releases.length > 0 && (
          <div className="update-notes selectable">
            {releases.length > 1 && <p className="update-count">{t("updateVersionsSince", { n: releases.length, current })}</p>}
            {releases.map((release) => (
              <section key={release.version}>
                <h3>Lost &amp; Prompt {release.version}</h3>
                <Markdown text={release.notes} query="" current={0} />
              </section>
            ))}
          </div>
        )}
        {!canInstall && <p>{kind === "scoop" ? t("updateScoopHint") : t("updatePackageHint")}</p>}
        {progress !== null && (
          <>
            <div className="progress">
              <div style={{ width: `${progress}%` }} />
            </div>
            <p>{t("updating", { percent: progress })}</p>
          </>
        )}
        {error && <p className="selectable" style={{ color: "#ff453a" }}>{error}</p>}
        <div className="buttons">
          <button className="btn" onClick={onClose} disabled={progress !== null}>
            {t("updateLater")}
          </button>
          {canInstall ? (
            <button className="btn primary" onClick={install} disabled={progress !== null}>
              {t("updateNow")}
            </button>
          ) : (
            <button className="btn primary" onClick={() => openUrl(links.releases)}>
              {t("downloadUpdate")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
