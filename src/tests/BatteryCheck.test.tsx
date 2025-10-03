import React from "react";
import { useDialogue, DialogueMessage } from "dialogue-story";
// NOTE: We intentionally avoid importing DialogueMessage type for the
// messages array so we can attach `characterInfo` helper field without
// causing strict type errors (cast to `any` when calling dialogue).

// <-- NEW: load elevator story (adjust path if your file lives elsewhere)
import { elevator } from "../assets/stories/elevator";

const SampleDialogue: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { dialogue } = useDialogue();

  // normalize function: parse "name" or "name:left" / "name:right"
  const normalizeMessagesForSides = (raw: DialogueMessage[]) => {
    return raw.map((m) => {
      const input = (m.charecter || "").trim();
      let name = input;
      let forcedSide: "left" | "right" | undefined = undefined;

      // split by ":" to detect explicit side suffix
      if (input.includes(":")) {
        const [base, suffix] = input.split(":");
        name = base;
        if (suffix === "left" || suffix === "right") {
          forcedSide = suffix;
        }
      } else {
        // default mapping: plain name -> forcedSide "left" (per your rule)
        forcedSide = "left";
      }

      // return a new message object with:
      // - charecter set to base name (no suffix)
      // - we add characterInfo helper containing {name, forcedSide}
      // - we keep any existing mode (so expression/mode images still work)
      const normalized: any = {
        ...m,
        charecter: name,
        characterInfo: { name, forcedSide },
      };

      // (optional) If you want to also set mode to left/right automatically
      // when mode is not already provided, uncomment the block below:
      // if (!normalized.mode && forcedSide) {
      //   normalized.mode = forcedSide;
      // }

      return normalized;
    });
  };

  const start = async () => {
    // --- CHANGED: load rawMessages from elevator story's first chapter ---
    // Find the first top-level chapter key in the elevator object
    const chapterKeys = Object.keys(elevator);
    if (chapterKeys.length === 0) {
      console.warn("elevator story has no chapters");
      return;
    }
    const firstChapterKey = chapterKeys[0];
    const firstChapter = elevator[firstChapterKey];

    // defensive check: ensure it's an array of messages
    const rawMessages: DialogueMessage[] = Array.isArray(firstChapter) ? (firstChapter as DialogueMessage[]) : [];

    // Normalize them into messages that also contain characterInfo
    const normalized = normalizeMessagesForSides(rawMessages);

    // Debug: print mapping so you can verify forced sides in the console
    // (you can remove or keep this)
    console.table(
      normalized.map((m: any) => ({
        charecter_sent: m.charecter,
        mode: m.mode,
        forcedSide: m.characterInfo?.forcedSide ?? null,
      }))
    );

    // If your dialogue provider/library expects 'mode' to be set to the
    // forced side (so it can look up left/right variants by mode), you
    // can map forcedSide into mode for messages that lack mode.
    // Uncomment the following block if your provider uses mode for side-resolution:
    /*
    const mappedForProvider = normalized.map((m: any) => {
      if (!m.mode && m.characterInfo?.forcedSide) {
        return { ...m, mode: m.characterInfo.forcedSide };
      }
      return m;
    });
    await dialogue(mappedForProvider as any);
    */

    // Otherwise, pass normalized as-is. We cast to `any` to avoid TS errors
    // because we added a helper field `characterInfo`.
    await dialogue(normalized as any);

    console.log("dialog finished");
  };

  return <button onClick={start}>{children ?? "شروع دیالوگ اول"}</button>;
};

export default SampleDialogue;
