// src/router/index.tsx
import { createBrowserRouter } from "react-router";
import App from "../App";
import ProjectManager from "../pages/ProjectManager";
import ProjectSelection from "../pages/ProjectSelection";
import PacksPage from "../pages/Packs";
import ErrorPage from "../pages/Error";

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
  // explicit route for project selection by pack ID
  {
    path: "/project/p/:packId",
    element: <ProjectSelection />,
    errorElement: <ErrorPage />,
  },
  // keep original /project for backward compatibility
  {
    path: "/project",
    element: <ProjectSelection />,
    errorElement: <ErrorPage />,
  },
  // project viewer/player route (single project)
  {
    path: "/project/:id",
    element: <App />,
    errorElement: <ErrorPage />,
  },
]);

export default router;
