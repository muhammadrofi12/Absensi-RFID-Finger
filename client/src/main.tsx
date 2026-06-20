import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Apply theme before React renders to avoid FOUC
const stored = localStorage.getItem("theme");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
// Default to dark if no preference stored
const initialTheme = stored ?? (prefersDark ? "dark" : "dark");
document.documentElement.classList.toggle("dark", initialTheme === "dark");
if (!stored) localStorage.setItem("theme", "dark");

createRoot(document.getElementById("root")!).render(<App />);
