import {createBrowserRouter} from "react-router";
import App from "../App";
import ErrorPage from "../pages/Error";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    errorElement: <ErrorPage  />
  },
  {
    path: "/project/:id",
    element: <h1>Hello Router</h1>,
    errorElement: <ErrorPage/>
  }
])

export default router;
