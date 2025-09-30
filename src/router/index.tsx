import {createBrowserRouter} from "react-router";
import App from "../App";
import ProjectManager from "../pages/ProjectManager";
import ErrorPage from "../pages/Error";

const router = createBrowserRouter([
  {
    path: "/",
    element: <ProjectManager/>,
    errorElement: <ErrorPage  />
  },
  {
    path: "/project/:id",
    element: <App />,
    errorElement: <ErrorPage/>
  }
])

export default router;
