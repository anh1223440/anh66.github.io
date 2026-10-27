/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState, useEffect } from "react";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Albums from "./pages/Albums";
import DriveFolder from "./pages/DriveFolder";
import Notes from "./pages/Notes";
import Schedule from "./pages/Schedule";

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    if (saved !== null) {
      return JSON.parse(saved);
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    localStorage.setItem("darkMode", JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  return (
    <BrowserRouter>
      <div className={`min-h-screen ${darkMode ? "dark bg-gray-900 text-white" : "bg-gray-50 text-gray-900"}`}>
        <Layout darkMode={darkMode} setDarkMode={setDarkMode}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/albums" element={<Albums />} />
            <Route path="/drive" element={<DriveFolder />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/schedule" element={<Schedule />} />
          </Routes>
        </Layout>
      </div>
    </BrowserRouter>
  );
}
