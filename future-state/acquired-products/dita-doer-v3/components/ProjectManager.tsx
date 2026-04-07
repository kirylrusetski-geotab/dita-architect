import React, { useState, useEffect } from 'react';
import { FolderPlus, Folder, FileText, Download, Trash2, X, Save, Plus, ArrowLeft, FolderOpen, ChevronRight } from 'lucide-react';
import { Project, DitaFile } from '../types';
import { getProjects, createProject, deleteProject, addFileToProject, exportProjectToZip } from '../services/projectService';

interface ProjectManagerProps {
  isOpen: boolean;
  onClose: () => void;
  currentXml?: string; // If provided, we are in "Save Mode"
  onLoadFile: (file: DitaFile, project: Project) => void; // Callback to load a file into editor
  onSaveSuccess?: (file: DitaFile, project: Project) => void; // Callback when save is successful
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({ isOpen, onClose, currentXml, onLoadFile, onSaveSuccess }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [view, setView] = useState<'list' | 'details'>('list');

  useEffect(() => {
    if (isOpen) {
      loadProjects();
    }
  }, [isOpen]);

  const loadProjects = () => {
    setProjects(getProjects());
  };

  const handleCreateProject = () => {
    if (!newProjectName.trim()) return;
    const project = createProject(newProjectName);
    setProjects(prev => [...prev, project]);
    setNewProjectName('');
    
    // Auto select if we are in save mode to speed up workflow
    if (currentXml) {
       setSelectedProject(project);
       setView('details');
       // Auto-suggest filename based on title in XML
       const titleMatch = currentXml.match(/<title>(.*?)<\/title>/);
       if (titleMatch && titleMatch[1]) {
         setNewFileName(titleMatch[1].replace(/[^a-z0-9]/gi, '_').toLowerCase());
       }
    }
  };

  const handleDeleteProject = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this project and all its files?')) {
      deleteProject(id);
      loadProjects();
      if (selectedProject?.id === id) {
        setSelectedProject(null);
        setView('list');
      }
    }
  };

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
    setView('details');
    
    // Pre-fill filename if saving
    if (currentXml && !newFileName) {
        const titleMatch = currentXml.match(/<title>(.*?)<\/title>/);
        if (titleMatch && titleMatch[1]) {
            setNewFileName(titleMatch[1].replace(/[^a-z0-9]/gi, '_').toLowerCase());
        } else {
            setNewFileName('untitled_topic');
        }
    }
  };

  const handleSaveFile = () => {
    if (!selectedProject || !currentXml || !newFileName) return;
    
    const updatedProject = addFileToProject(selectedProject.id, newFileName, currentXml);
    if (updatedProject) {
      setSelectedProject(updatedProject);
      // Update local project list too
      setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
      
      const savedFile = updatedProject.files.find(f => f.fileName === (newFileName.endsWith('.dita') ? newFileName : `${newFileName}.dita`));
      
      if (onSaveSuccess && savedFile) {
        onSaveSuccess(savedFile, updatedProject);
      } else {
        alert('File saved to project!');
      }
      
      setNewFileName(''); // Reset for next save
    }
  };

  const handleLoadFile = (file: DitaFile) => {
    if (selectedProject) {
      onLoadFile(file, selectedProject);
      onClose();
    }
  };

  const handleDownloadZip = async (project: Project) => {
    await exportProjectToZip(project);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
               <FolderOpen size={20} />
            </div>
            <div>
               <h2 className="text-lg font-bold text-slate-800">Project Manager</h2>
               <p className="text-xs text-slate-500">
                 {currentXml ? 'Select a project to save your work.' : 'Manage, open, or download your DITA projects.'}
               </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-grow overflow-hidden flex">
          
          {/* Navigation / List View */}
          <div className={`flex-col w-full ${view === 'list' ? 'flex' : 'hidden md:flex md:w-1/3 md:border-r border-slate-200'}`}>
             <div className="p-4 bg-slate-50/50 border-b border-slate-100">
                <div className="flex gap-2">
                   <input 
                     type="text" 
                     placeholder="New Project Name..." 
                     value={newProjectName}
                     onChange={(e) => setNewProjectName(e.target.value)}
                     className="flex-grow text-sm p-2 border border-slate-300 rounded-md focus:border-blue-500 outline-none"
                   />
                   <button 
                     onClick={handleCreateProject}
                     disabled={!newProjectName}
                     className="bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                   >
                     <Plus size={18} />
                   </button>
                </div>
             </div>
             
             <div className="flex-grow overflow-y-auto p-2 space-y-2">
                {projects.length === 0 && (
                   <div className="text-center py-8 text-slate-400 text-sm">
                      No projects yet. Create one to get started.
                   </div>
                )}
                {projects.map(project => (
                   <div 
                      key={project.id}
                      onClick={() => handleSelectProject(project)}
                      className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${selectedProject?.id === project.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-50 border border-transparent'}`}
                   >
                      <div className="flex items-center gap-3 overflow-hidden">
                         <Folder size={18} className={selectedProject?.id === project.id ? "text-blue-500" : "text-slate-400"} />
                         <div className="min-w-0">
                            <h3 className={`text-sm font-medium truncate ${selectedProject?.id === project.id ? "text-blue-700" : "text-slate-700"}`}>{project.name}</h3>
                            <span className="text-[10px] text-slate-400">{project.files.length} files</span>
                         </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                            onClick={(e) => { e.stopPropagation(); handleDownloadZip(project); }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded"
                            title="Download ZIP"
                         >
                            <Download size={14} />
                         </button>
                         <button 
                            onClick={(e) => handleDeleteProject(e, project.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded"
                            title="Delete Project"
                         >
                            <Trash2 size={14} />
                         </button>
                         <ChevronRight size={16} className="text-slate-300 md:hidden" />
                      </div>
                   </div>
                ))}
             </div>
          </div>

          {/* Details View */}
          <div className={`flex-col flex-grow bg-white ${view === 'details' ? 'flex' : 'hidden md:flex'}`}>
             {selectedProject ? (
                <>
                   {/* Mobile Header for Details */}
                   <div className="md:hidden p-2 border-b border-slate-100 flex items-center gap-2">
                      <button onClick={() => setView('list')} className="p-1 hover:bg-slate-100 rounded">
                         <ArrowLeft size={18} className="text-slate-500" />
                      </button>
                      <span className="font-bold text-slate-700">{selectedProject.name}</span>
                   </div>

                   {/* Save Area (Only if currentXml provided) */}
                   {currentXml && (
                      <div className="p-4 bg-amber-50 border-b border-amber-100">
                         <h4 className="text-xs font-bold text-amber-700 uppercase mb-2">Save Current File to Project</h4>
                         <div className="flex gap-2">
                            <div className="flex-grow flex items-center">
                               <input 
                                 type="text" 
                                 value={newFileName}
                                 onChange={(e) => setNewFileName(e.target.value)}
                                 placeholder="filename"
                                 className="flex-grow p-2 text-sm border border-amber-300 rounded-l-md focus:border-amber-500 outline-none"
                               />
                               <span className="bg-amber-100 text-amber-700 px-3 py-2 text-sm border border-l-0 border-amber-300 rounded-r-md font-mono">.dita</span>
                            </div>
                            <button 
                              onClick={handleSaveFile}
                              disabled={!newFileName}
                              className="bg-amber-600 text-white px-4 py-2 rounded-md hover:bg-amber-700 text-sm font-medium flex items-center gap-2 shadow-sm disabled:opacity-50"
                            >
                               <Save size={16} /> Save
                            </button>
                         </div>
                      </div>
                   )}

                   {/* Project Files List */}
                   <div className="flex-grow overflow-y-auto p-4">
                      <div className="flex items-center justify-between mb-4">
                         <h3 className="font-bold text-slate-700">Project Files ({selectedProject.files.length})</h3>
                         <button 
                            onClick={() => handleDownloadZip(selectedProject)}
                            className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
                         >
                            <Download size={14} /> Download All (.zip)
                         </button>
                      </div>

                      {selectedProject.files.length === 0 ? (
                         <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
                            <FolderPlus className="mx-auto text-slate-300 mb-2" size={32} />
                            <p className="text-slate-400 text-sm">No files in this project yet.</p>
                         </div>
                      ) : (
                         <div className="space-y-2">
                            {selectedProject.files.map(file => (
                               <div key={file.id} className="group flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-all">
                                  <div className="flex items-center gap-3">
                                     <div className="bg-slate-100 p-2 rounded text-slate-500">
                                        <FileText size={16} />
                                     </div>
                                     <div>
                                        <p className="font-medium text-sm text-slate-700">{file.fileName}</p>
                                        <p className="text-[10px] text-slate-400">Modified: {new Date(file.lastModified).toLocaleDateString()}</p>
                                     </div>
                                  </div>
                                  <button 
                                    onClick={() => handleLoadFile(file)}
                                    className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded text-slate-600 hover:text-blue-600 hover:border-blue-400 transition-colors"
                                  >
                                    Open
                                  </button>
                               </div>
                            ))}
                         </div>
                      )}
                   </div>
                </>
             ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                   <Folder size={48} className="mb-4 opacity-20" />
                   <h3 className="text-lg font-medium text-slate-500">No Project Selected</h3>
                   <p className="text-sm">Select a project from the list to view files or save content.</p>
                </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};