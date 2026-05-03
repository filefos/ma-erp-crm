import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter, setActiveCompanyGetter } from "@workspace/api-client-react";

setAuthTokenGetter(() => localStorage.getItem("erp_token"));
setActiveCompanyGetter(() => {
  const v = localStorage.getItem("erp_active_company_id");
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
});

createRoot(document.getElementById("root")!).render(<App />);
