import React from 'react';

const XmlIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    className={className}
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

const Header: React.FC = () => {
  return (
    <header className="bg-gray-900 text-white shadow-md z-10">
      <div className="w-full px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <XmlIcon className="h-8 w-8 text-cyan-400"/>
            <h1 className="text-2xl font-bold tracking-tight text-gray-100">
              VibeEtto
            </h1>
          </div>
          <p className="text-sm text-gray-400 hidden sm:block">
            Powered by Monaco, React & Gemini
          </p>
        </div>
      </div>
    </header>
  );
};

export default Header;