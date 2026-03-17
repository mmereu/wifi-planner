import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProjectsPage from './pages/ProjectsPage';
import EditorPage from './pages/EditorPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProjectsPage />} />
        <Route path="/projects/:id" element={<EditorPage />} />
      </Routes>
    </BrowserRouter>
  );
}
