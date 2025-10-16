// src/router/index.tsx
import { createBrowserRouter } from "react-router";
import App from "../App";
import ProjectManager from "../pages/ProjectManager";
import ProjectSelection from "../pages/ProjectSelection";
import PacksPage from "../pages/Packs";
import ErrorPage from "../pages/Error";
import GamepadPage from "../pages/Gamepad"; // <-- new page
import GamePadPage from "../pages/test";

const router = createBrowserRouter([
  {
    path: "/",
    element: <PacksPage />,
    errorElement: <ErrorPage />,
  },
  {
    path: "/manage",
    element: <ProjectManager />,
    errorElement: <ErrorPage />,
  },
  {
    path: "/project/p/:packId",
    element: <ProjectSelection />,
    errorElement: <ErrorPage />,
  },
  {
    path: "/project",
    element: <ProjectSelection />,
    errorElement: <ErrorPage />,
  },
  // NEW: gamepad page for project control
  {
    path: "/gamepad/:id",
    element: <GamepadPage />,
    errorElement: <ErrorPage />,
  },
  // project viewer/player (single project)
  {
    path: "/project/:id",
    element: <App />,
    errorElement: <ErrorPage />,
  },
]);

export default router;
