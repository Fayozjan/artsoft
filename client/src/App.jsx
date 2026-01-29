import { Routes, Route } from "react-router-dom";

import Alert from "./components/Alert";
import AuthPage from "./pages/AuthPage";

import Layout from "./layout";
import routes from "./routes";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<AuthPage />} key="/" />,
        <Route path="/*" element={<Layout />}>
          {routes}
        </Route>
      </Routes>
      <Alert />
    </>
  );
}
