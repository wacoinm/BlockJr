import {createBrowserRouter} from "react-router";
import App from "../App";
import ErrorPage from "../pages/Error";

const router = createBrowserRouter([
  {
    path: "/",
    element: <h1>Hello Router</h1>,
    errorElement: <ErrorPage  />
  },
  {
    path: "/project/:id",
    element: <App/>,
    errorElement: <ErrorPage/>
  }
])

export default router;
