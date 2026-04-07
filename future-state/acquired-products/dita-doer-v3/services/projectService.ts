import { Project, DitaFile } from '../types';
import JSZip from 'jszip';

const STORAGE_KEY = 'dita-doer-projects';

export const getProjects = (): Project[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to load projects", e);
    return [];
  }
};

export const saveProject = (project: Project): void => {
  const projects = getProjects();
  const index = projects.findIndex(p => p.id === project.id);
  
  if (index >= 0) {
    projects[index] = project;
  } else {
    projects.push(project);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
};

export const createProject = (name: string): Project => {
  const newProject: Project = {
    id: crypto.randomUUID(),
    name,
    files: [],
    createdAt: new Date().toISOString()
  };
  saveProject(newProject);
  return newProject;
};

export const deleteProject = (projectId: string): void => {
  const projects = getProjects().filter(p => p.id !== projectId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
};

export const addFileToProject = (projectId: string, fileName: string, content: string): Project | null => {
  const projects = getProjects();
  const projectIndex = projects.findIndex(p => p.id === projectId);
  
  if (projectIndex === -1) return null;
  
  const project = projects[projectIndex];
  
  // Check if file exists, update it if so
  const existingFileIndex = project.files.findIndex(f => f.fileName === fileName || f.fileName === `${fileName}.dita`);
  
  const cleanFileName = fileName.endsWith('.dita') ? fileName : `${fileName}.dita`;
  
  const newFile: DitaFile = {
    id: existingFileIndex >= 0 ? project.files[existingFileIndex].id : crypto.randomUUID(),
    fileName: cleanFileName,
    content,
    lastModified: new Date().toISOString()
  };

  if (existingFileIndex >= 0) {
    project.files[existingFileIndex] = newFile;
  } else {
    project.files.push(newFile);
  }
  
  projects[projectIndex] = project;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  
  return project;
};

export const exportProjectToZip = async (project: Project): Promise<void> => {
  const zip = new JSZip();
  
  // Add files to zip
  project.files.forEach(file => {
    zip.file(file.fileName, file.content);
  });
  
  // Generate blob
  const content = await zip.generateAsync({ type: "blob" });
  
  // Trigger download
  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${project.name.replace(/\s+/g, '_')}_DITA_Project.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};