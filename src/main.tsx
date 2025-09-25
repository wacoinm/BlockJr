// src/main.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { Provider } from "react-redux";
import ToastContain from "./ToastContain";
import { DialogueProvider } from "dialogue-story";
import router from "./router";
import { store } from "./store";
import "dialogue-story/style.css";
import "./index.css";
import '@capacitor-community/safe-area';

const container = document.getElementById("root")!;
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <Provider store={store}>
      <DialogueProvider
        leftCharacters={[{ name: "Eddy", src: "/avatars/left.png" }]}
        rightCharacters={[{ name: "Ali", src: "/avatars/right.png" }]}
        mode="comic"
        speed={40}
        onFinished={() => {
          console.log("Dialogue finished (onFinished prop)");
        }}
        rtl={true}
      >
        <RouterProvider router={router} />
        <ToastContain />
      </DialogueProvider>
    </Provider>
  </React.StrictMode>
);
