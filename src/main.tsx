import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Ensure i18n is initialized before any components render
import "@/i18n/config";

createRoot(document.getElementById("root")!).render(<App />);
