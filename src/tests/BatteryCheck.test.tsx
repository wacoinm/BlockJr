import React from "react";
import { useDialogue, DialogueMessage } from "dialogue-story";

const SampleDialogue: React.FC<React.PropsWithChildren> = ({children}) => {
  const { dialogue } = useDialogue();

  const start = async () => {
    const messages: DialogueMessage[] = [
      {
        text: "سلام! میزان باتری رو چک کنیم.",
        charecter: "Eddy",
        mode: "happy",
        typeSpeed: 30,
        textColor: "#fff",
        bgColor: "#1f6feb",
        showTimes: true,
      },
      {
        text: "ما بهت نیاز داریم تا مصرف انرژی رو مدیریت کنی.",
        charecter: "Ali",
        typeSpeed: 28,
        textColor: "#000",
        bgColor: "#ffd27f",
      },
      {
        text: "باشه — دارم شارژ رو پایش می‌کنم.",
        charecter: "Eddy",
        mode: "angry",
        typeSpeed: 32,
        textColor: "#fff",
        bgColor: "#d9534f",
      },
      {
        text: "خوبه. من سطح باتری رو بررسی می‌کنم.",
        charecter: "Ali",
        typeSpeed: 28,
      },
      {
        text: "دارم داده‌های باتری رو بارگذاری می‌کنم...",
        charecter: "Eddy",
        typeSpeed: 18,
      },
      { text: "تقریباً آماده‌ست!", charecter: "Eddy", typeSpeed: 10 },
    ];

    await dialogue(messages);
    console.log("dialog finished");
  };

  return <button onClick={start}>{children}</button>;
};

export default SampleDialogue;
