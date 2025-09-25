import {createBrowserRouter} from "react-router";
import App from "../App";

const router = createBrowserRouter([
  {
    path: "/",
    element: <h1>Hello Router</h1>
  },
  {
    path: "/project/:id",
    element: <App/>
  }
])

export default router;
