// src/main.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import SafeLayout from "./layouts/SafeLayout";
import ToastContain from "./ToastContain";
import { DialogueProvider } from "dialogue-story";
import App from "./App";
import { store } from "./store";
import "dialogue-story/style.css"
import "./index.css";

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
        <SafeLayout>
          <App />
        </SafeLayout>
        <ToastContain />
      </DialogueProvider>
    </Provider>
  </React.StrictMode>
);
