import React from "react";
import { useDialogue, DialogueMessage } from "dialogue-story";
// NOTE: We intentionally avoid importing DialogueMessage type for the
// messages array so we can attach `characterInfo` helper field without
// causing strict type errors (cast to `any` when calling dialogue).

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
    // raw messages: you may use "woody", "woody:left" or "woody:right"
    const rawMessages: DialogueMessage[] = [
      {
        text: "سلام! به پروژهٔ تله‌کابین خوش اومدی. امروز قراره با هم مسیر و کابین‌ها رو بسازیم.",
        charecter: "woody", // will default to left => {name:"woody", forcedSide:"left"}
        mode: "happy",
        typeSpeed: 30,
        textColor: "#ffffff",
        bgColor: "#1f6feb",
        showTimes: true,
        bgImage: "/scenes/1.Metting/default.png",
        filter: { fade: 0, blur: 0 },
      },
      {
        text: "اول باید ستون‌ها و قرقره‌ها رو درست کنیم — زیگ و خانم سیب برنامه دارن.",
        charecter: "buzz:right", // explicit: force buzz to the right side
        mode: "brave",
        typeSpeed: 28,
        textColor: "#000000",
        bgColor: "#ffd27f",
        bgImage: "/scenes/1.Metting/busy.png",
        filter: { fade: 0.15, blur: 0.6 },
        forcedSide: "right",
      },
      {
        text: "من کتاب‌ها و بلوک‌ها رو چیدم تا برج‌ها شکل بگیرن — پایه‌ها آماده است.",
        charecter: "andy:left", // explicit left
        mode: "proud",
        typeSpeed: 28,
        textColor: "#000000",
        bgColor: "#d1f7c4",
        bgImage: "/scenes/1.Metting/minimalist.png",
        filter: { fade: 0.05, blur: 0.2 },
      },
      {
        text: "من قرقره‌ها و نخ‌ها رو چک می‌کنم؛ مطمئن می‌شم که همه محکم باشن.",
        charecter: "slinky", // defaults to left
        mode: "proud",
        typeSpeed: 32,
        textColor: "#ffffff",
        bgColor: "#6aa84f",
      },
      {
        text: "اگه گره بخوره چی؟ من یه کم نگرانم...",
        charecter: "rex:right", // send rex to the right side explicitly
        mode: "nervous",
        typeSpeed: 30,
        textColor: "#000000",
        bgColor: "#ffd27f",
        bgImage: "/scenes/1.Metting/evening-quiet.png",
        filter: { fade: 0.65, blur: 1.0 },
      },
      {
        text: "نترس رکس، همه با هم گره‌ها رو باز می‌کنیم — بزن بریم ساخت رو شروع کنیم!",
        charecter: "ms-potato", // defaults to left
        mode: "warm",
        typeSpeed: 26,
        textColor: "#ffffff",
        bgColor: "#2a9d8f",
        showTimes: true,
        bgImage: "/scenes/1.Metting/busy.png",
        filter: { fade: 0.0, blur: 0.3 },
      },
    ];

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
