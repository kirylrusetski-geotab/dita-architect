import React from 'react';

export const Tooltip = ({
  children,
  content,
  placement = 'bottom'
}: {
  children: React.ReactNode,
  content: string,
  placement?: 'top' | 'bottom' | 'right' | 'left'
}) => {
  const positionClasses = placement === 'right'
    ? 'left-full ml-2 top-1/2 -translate-y-1/2'
    : placement === 'left'
    ? 'right-full mr-2 top-1/2 -translate-y-1/2'
    : placement === 'top'
    ? 'bottom-full mb-2 left-1/2 -translate-x-1/2'
    : 'top-full mt-2 left-1/2 -translate-x-1/2';

  return (
    <div className="group/tooltip relative flex items-center justify-center">
      {children}
      <div className={`absolute ${positionClasses} px-2 py-1 bg-slate-900 text-slate-200 text-[11px] font-medium rounded opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg border border-slate-700`}>
        {content}
      </div>
    </div>
  );
};
