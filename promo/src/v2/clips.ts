// Datos de las tomas grabadas (capture/record.mjs). Se importan en el build: los tiempos y las
// zonas de interés quedan fijos dentro del vídeo.
import esReveal from "../../public/clips/es/reveal.json";
import esSearch from "../../public/clips/es/search.json";
import esConversation from "../../public/clips/es/conversation.json";
import esResume from "../../public/clips/es/resume.json";
import esOrganize from "../../public/clips/es/organize.json";
import esCards from "../../public/clips/es/cards.json";
import esActivity from "../../public/clips/es/activity.json";
import esExport from "../../public/clips/es/exportmd.json";
import esGuide from "../../public/clips/es/guide.json";
import esDark from "../../public/clips/es/dark.json";
import esWindows from "../../public/clips/es/windows.json";
import enReveal from "../../public/clips/en/reveal.json";
import enSearch from "../../public/clips/en/search.json";
import enConversation from "../../public/clips/en/conversation.json";
import enResume from "../../public/clips/en/resume.json";
import enOrganize from "../../public/clips/en/organize.json";
import enCards from "../../public/clips/en/cards.json";
import enActivity from "../../public/clips/en/activity.json";
import enExport from "../../public/clips/en/exportmd.json";
import enGuide from "../../public/clips/en/guide.json";
import enDark from "../../public/clips/en/dark.json";
import enWindows from "../../public/clips/en/windows.json";

export const CLIPS = {
  es: { reveal: esReveal, search: esSearch, conversation: esConversation, resume: esResume, organize: esOrganize, cards: esCards, activity: esActivity, exportmd: esExport, guide: esGuide, dark: esDark, windows: esWindows },
  en: { reveal: enReveal, search: enSearch, conversation: enConversation, resume: enResume, organize: enOrganize, cards: enCards, activity: enActivity, exportmd: enExport, guide: enGuide, dark: enDark, windows: enWindows },
};
