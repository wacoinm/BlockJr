// src/router/index.tsx
import { createBrowserRouter } from "react-router";
import App from "../App";
import ProjectManager from "../pages/ProjectManager";
import ProjectSelection from "../pages/ProjectSelection";
import ErrorPage from "../pages/Error";

const router = createBrowserRouter([
  {
    path: "/",
    element: <ProjectSelection />,
    errorElement: <ErrorPage />
  },
  {
    path: "/project",
    element: <ProjectManager />,
    errorElement: <ErrorPage />
  },
  {
    path: "/project/:id",
    element: <App />,
    errorElement: <ErrorPage />
  }
]);

export default router;
